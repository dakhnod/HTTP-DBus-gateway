import quart
import asyncio
import json
import dbus
from gi.repository import GLib
from dbus.mainloop.glib import DBusGMainLoop
import threading
import functools

DBusGMainLoop(set_as_default=True)

app = quart.Quart(__name__)
session = dbus.SessionBus()

@app.get('/')
def redirect_index():
    return quart.redirect('/static/index.html')

@app.websocket('/api/signals')
async def handle_signal_websocket():
    await quart.websocket.accept()

    disconnected_event = asyncio.Event()

    event_loop = asyncio.get_running_loop()

    send_json = quart.websocket.send_json

    def signal_handler(*args, **kwargs):
        async def run_async():
            try:
                await send_json({
                    'interface': kwargs.get('_interface'),
                    'path': kwargs.get('_path'),
                    'member': kwargs.get('_member'),
                    'args': args
                })
            except asyncio.CancelledError:
                print(f'WebSocket probably disconnected')
                await disconnected_event.set()
                raise

        asyncio.run_coroutine_threadsafe(run_async(), event_loop)

    connection = session.add_signal_receiver(
        signal_handler,
        **quart.websocket.args,
        interface_keyword='_interface',
        path_keyword='_path',
        member_keyword='_member',
    )
    
    await disconnected_event.wait()

    connection.remove()

@app.post('/api/by-interface/<string:interface>/by-path/<path:path>/methods/<string:method>')
async def call_method(interface: str, path: str, method: str):
    try:
        proxy = session.get_object(
            bus_name=quart.request.args.get('bus_name', interface),
            object_path=f'/{path}',
        )
        method = proxy.get_dbus_method(method, interface)
        payload = await quart.request.json
        response = method(*payload.get('args', []))
        return {
            'response': response 
        }
    except Exception as e:
        return {
            'error': str(e)
        }, 500
    
@app.after_request
def append_cors(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
    response.headers.add('Access-Control-Allow-Methods', 'POST')
    return response

loop_thread = threading.Thread(target=GLib.MainLoop().run)
loop_thread.daemon = True
loop_thread.start()