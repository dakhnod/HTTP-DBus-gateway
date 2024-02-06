import quart
import asyncio
import json
import dbus_next
import threading
import functools
import re


app = quart.Quart(__name__)

to_snake_case = re.compile(r'(?<!^)(?=[A-Z])')

@app.before_serving
async def init():
    print('running init...')
    app.bus = await dbus_next.aio.MessageBus().connect()

@app.get('/')
def redirect_index():
    return quart.redirect('/static/html/index.html')

@app.get('/api/busses/<string:bus>')
async def inspect_bus(bus: str):
    bus_object = {
        'name': bus,
        'paths': []
    }

    async def introspect_path(path=''):
        introspection = await app.bus.introspect(bus, '/' if path == '' else path)

        if len(introspection.interfaces) > 0:
            path_object = {
                'path': '/' if path == '' else path,
                'interfaces': []
            }

            for interface in introspection.interfaces:
                interface_object = {
                    'name': interface.name,
                    'methods': [],
                    'properties': [],
                    'signals': []
                }

                for method in interface.methods:
                    method_object = {
                        'name': method.name,
                        'in_signature': method.in_signature,
                        'out_signature': method.out_signature
                    }
                    interface_object['methods'].append(method_object)

                for property in interface.properties:
                    property_objects = {
                        'name': property.name,
                        'signature': property.signature,
                        'access': property.access.value
                    }
                    interface_object['properties'].append(property_objects)

                for signal in interface.signals:
                    signal_object = {
                        'name': signal.name,
                        'signature': signal.signature
                    }
                    interface_object['signals'].append(signal_object)

                path_object['interfaces'].append(interface_object)

            bus_object['paths'].append(path_object)

        for node in introspection.nodes:
            await introspect_path(f'{path}/{node.name}')

    await introspect_path()
    
    return bus_object

@app.websocket('/api/signals')
async def handle_signal_websocket():
    await quart.websocket.accept()

    disconnected_event = asyncio.Event()

    def signal_handler(*args, **kwargs):
        async def run_async():
            try:
                await quart.websocket.send({
                    'interface': kwargs.get('_interface'),
                    'path': kwargs.get('_path'),
                    'member': kwargs.get('_member'),
                    'args': args
                })
            except asyncio.CancelledError:
                print(f'WebSocket probably disconnected')
                await disconnected_event.set()
                raise

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
        if path == '-':
            path = ''
        path = f'/{path}'
        bus_name = quart.request.args.get('bus_name', interface)

        introspection = await app.bus.introspect(
            bus_name=bus_name,
            path=path
        )
        proxy = app.bus.get_proxy_object(
            bus_name=bus_name,
            path=path,
            introspection=introspection
        )
        interface = proxy.get_interface(interface)
        payload = await quart.request.json
        args = payload.get('args', [])
        for meta in interface.introspection.methods:
            if meta.name == method:
                for i in range(len(meta.in_args)):
                    if meta.in_args[i].signature == 'v':
                        args[i] = dbus_next.signature.Variant(type(args[i]).__name__[0], args[i])

        method = to_snake_case.sub('_', method).lower()
        method = getattr(interface, f'call_{method.lower()}')
        
        response = await method(*args)

        def iterate_fix(object):
            if isinstance(object, dict):
                for key, value in object.items():
                    object[key] = iterate_fix(value)
            elif isinstance(object, list):
                for key, value in enumerate(object):
                    object[key] = iterate_fix(value)
            elif isinstance(object, bytes):
                return list(object)
            elif isinstance(object, dbus_next.signature.Variant):
                return iterate_fix(object.value)

            return object

        return {
            'response': iterate_fix(response) 
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

# asyncio.run_coroutine_threadsafe(init(), asyncio.get_event_loop())