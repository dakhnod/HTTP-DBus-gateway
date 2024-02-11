import quart
import asyncio
import dbus_next
import re
import types
import os

app = quart.Quart(__name__)

to_snake_case = re.compile(r'(?<!^)(?=[A-Z])')

@app.before_serving
async def init():
    connection_string = os.environ.get('DBUS_ADDRESS')
    app.dbus = types.SimpleNamespace()
    if connection_string is None:
        kwargs_key = 'bus_type'
        kwargs_values = dbus_next.constants.BusType
    else:
        kwargs_key = 'bus_address'
        kwargs_values = connection_string.split(';;')

    # do we really need to use asyncio.gather here to parallelise initial, one-time connection establishment to two-ish endpoints?
    # nope.
    # are we still doing it because we can?
    # yes.
    app.dbus.connections = await asyncio.gather(*[dbus_next.aio.MessageBus(**{kwargs_key: value}).connect() for value in kwargs_values])

@app.get('/')
def redirect_index():
    return quart.redirect('/static/html/index.html')

@app.get('/api/connections')
async def connections():
    return [{
        'id': app.dbus.connections.index(connection),
        'name': connection._bus_address[0][1]['path']
    } for connection in app.dbus.connections]

@app.get('/api/connections/<int:connection_id>/busses/<string:bus>')
async def inspect_bus(connection_id: int, bus: str):
    bus_object = {
        'name': bus,
        'paths': []
    }

    connection = app.dbus.connections[connection_id]

    async def introspect_path(path=''):
        introspection = await connection.introspect(bus, '/' if path == '' else path)

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

@app.websocket('/api/connections/<int:connection_id>/signals')
async def handle_signal_websocket(connection_id: int):
    await quart.websocket.accept()


    args = quart.websocket.args

    match_rule = str.join(',', [f'{key}={value}' for key, value in args.items()])

    connection = app.dbus.connections[connection_id]
    
    introspection = await connection.introspect(
        bus_name='org.freedesktop.DBus',
        path='/'
    )
    proxy = connection.get_proxy_object(
        bus_name='org.freedesktop.DBus',
        path='/',
        introspection=introspection
    )
    interface = proxy.get_interface('org.freedesktop.DBus')

    send_json = quart.websocket.send_json
    async def run_async(message: dbus_next.message.Message):
        await send_json({
            'interface': message.interface,
            'path': message.path,
            'member': message.member,
            'sender': message.sender,
            'args': unpack_variants(message.body),
        })

    def message_handler(message: dbus_next.message.Message):
        if message.message_type != dbus_next.constants.MessageType.SIGNAL:
            return
        
        for key, value in args.items():
            if getattr(message, key) != value:
                return
            
        asyncio.create_task(run_async(message))

    connection.add_message_handler(message_handler)
    await interface.call_add_match(match_rule)
    
    try:
        while True:
            await quart.websocket.receive()
            print('received upstream')
    except:
        pass

    print(f'WebSocket probably disconnected')
    connection.remove_message_handler(message_handler)
    await interface.call_remove_match(match_rule)
    raise asyncio.CancelledError


def unpack_variants(object):
    if isinstance(object, dict):
        for key, value in object.items():
            object[key] = unpack_variants(value)
    elif isinstance(object, list):
        for key, value in enumerate(object):
            object[key] = unpack_variants(value)
    elif isinstance(object, bytes):
        return list(object)
    elif isinstance(object, dbus_next.signature.Variant):
        return unpack_variants(object.value)

    return object

@app.post('/api/connections/<int:connection_id>/by-interface/<string:interface>/by-path/<path:path>/methods/<string:method>')
async def call_method(connection_id: int, interface: str, path: str, method: str):
    try:
        if path == '-':
            path = ''
        path = f'/{path}'
        bus_name = quart.request.args.get('bus_name', interface)

        connection = app.dbus.connections[connection_id]

        introspection = await connection.introspect(
            bus_name=bus_name,
            path=path
        )
        proxy = connection.get_proxy_object(
            bus_name=bus_name,
            path=path,
            introspection=introspection
        )
        interface = proxy.get_interface(interface)
        payload = await quart.request.json
        args = payload.get('args', [])
        
        # convert in_args to types that the method expects
        for meta in interface.introspection.methods:
            if meta.name == method:
                for i in range(len(meta.in_args)):
                    if meta.in_args[i].signature == 'v':
                        args[i] = dbus_next.signature.Variant(type(args[i]).__name__[0], args[i])
                    elif meta.in_args[i].signature == 'b':
                        args[i] = bool(args[i])

        method = to_snake_case.sub('_', method).lower()
        method = getattr(interface, f'call_{method.lower()}')
        
        response = await method(*args)

        return {
            'response': unpack_variants(response) 
        }
    except Exception as e:
        return {
            'error': str(e)
        }, 500