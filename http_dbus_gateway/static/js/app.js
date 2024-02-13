async function getAllConnections() {
    const response = await fetch('/api/connections')
    return await response.json()
}

const connections = await getAllConnections()

for (const connection of connections) {
    const connectionContainer = $('#connection-template').contents().clone()
    $('#connection-name', connectionContainer).text(connection.name)
    let connectionLoaded = false
    $('#connection-name', connectionContainer).click(async function (_) {
        if (connectionLoaded) {
            $('#busses-container', connectionContainer).empty()
        } else {
            await loadConnection($('#busses-container', connectionContainer), connection.id)
        }
        connectionLoaded = !connectionLoaded
    })
    $('#connections-container').append(connectionContainer)
}

async function loadConnection(connectionContainer, connectionId) {
    async function callDbusMethod(bus_name, interface_, path, method, args = []) {
        path = path.substr(1)

        if (!path) {
            path = '-'
        }

        const url = `/api/connections/${connectionId}/by-interface/${interface_}/by-path/${path}/methods/${method}?bus_name=${bus_name}`;

        const response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify({ 'args': args }),
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            let responseData = {}
            try {
                responseData = await response.json();
            } catch (e) { }
            if (responseData.error) {
                throw new Error(responseData.error)
            }
            throw new Error(`HTTP-Fehler! Status: ${response.status}`);
        }

        const responseData = await response.json();

        if (responseData.error != undefined) {
            throw responseData.error
        }

        return responseData.response;
    }

    async function getAllBusses() {
        return callDbusMethod('org.freedesktop.DBus', 'org.freedesktop.DBus', '/org/freedesktop/DBus', 'ListNames')
    }

    connectionContainer.empty()
    connectionContainer.text('loading connection...')

    const busses = await getAllBusses()

    connectionContainer.empty()

    for (const bus_name of busses) {
        const busContainer = $('#bus-template').contents().clone()
        $('#bus-name', busContainer).text(bus_name)
        $('#bus-name', busContainer).click(loadBus)
        busContainer[1].dataset.dbusBusName = bus_name

        let busLoaded = false

        async function loadBus(event) {
            if (busLoaded) {
                $('#paths-container', busContainer).empty()
                busLoaded = false
                return
            }

            $('#paths-container', busContainer).append('Loading bus...')

            const response = await fetch(`/api/connections/${connectionId}/busses/${bus_name}`)
            const bus_data = await response.json()

            $('#paths-container', busContainer).empty()
            busLoaded = true

            for (const path of bus_data.paths) {
                const pathTemplate = $('#path-template').contents().clone()
                $('#path', pathTemplate).text(path.path)
                pathTemplate[1].dataset.dbusPath = path.path

                for (const interface_ of path.interfaces) {
                    const interfaceTemplatae = $('#interface-template').contents().clone()
                    $('#name', interfaceTemplatae).text(interface_.name)
                    interfaceTemplatae[1].dataset.dbusInterface = interface_.name

                    function displayMember(members_key, label, signature_key, buttons, displayInputs) {
                        for (const member of interface_[members_key]) {
                            const memberTemplate = $('#member-template').contents().clone()

                            memberTemplate[1].dataset.dbusMember = member.name

                            const argumentsVerbose = []
                            const argumentMapping = {
                                's': ['string', 'text'],
                                'v': ['variant'],
                                'y': ['byte', 'number', 0, 255],
                                'b': ['boolean', 'number', 0, 1],
                                'n': ['int16', 'number', -32.768, 32.767],
                                'q': ['uint16', 'number', 0, 65.535],
                                'i': ['int32', 'number'],
                                'u': ['uint32', 'number'],
                                'x': ['int64', 'number'],
                                't': ['uint64', 'number'],
                                'd': ['double', 'number'],
                                'h': ['unix_fd']
                            }

                            const argumentInputs = []
                            const argumentContainer = $('#params-container', memberTemplate)
                            if (!displayInputs || displayInputs(member)) {
                                for (const argument of member[signature_key]) {
                                    const argument_params = argumentMapping[argument]
                                    if (argument_params == undefined) {
                                        argumentsVerbose.push(argument)
                                        continue
                                    }
                                    argumentsVerbose.push(argument_params[0])

                                    const input = $('<input>')[0]
                                    input.style.width = '25%'
                                    input.classList.add('form-control')
                                    input.placeholder = argument_params[0]
                                    input.type = argument_params[1]
                                    if (argument_params[1] == 'number') {
                                        input.min = argument_params[2] ?? ''
                                        input.max = argument_params[3] ?? ''
                                    }

                                    argumentContainer.append(input)
                                    argumentInputs.push([argument_params[1], input])
                                }
                            }

                            for (const button of buttons) {
                                const buttonElement = $('#member-button-template').contents().clone()
                                $('button', buttonElement).text(button.label)
                                $('button', buttonElement).click(async function (_) {
                                    const inputs = argumentInputs.map(input => {
                                        let value = input[1].value
                                        if (input[0] == 'number') {
                                            value = Number(value)
                                        }
                                        return value
                                    })
                                    button.callback(bus_name, interface_.name, path.path, member.name, inputs)
                                })
                                $('button', buttonElement).attr('id', `button-${button.label}`)
                                if (button.enabled && !button.enabled(member)) {
                                    $('button', buttonElement).prop('disabled', true)
                                }
                                $('#button-container', memberTemplate).append(buttonElement)
                            }


                            $('#name', memberTemplate).text(`${member.name}(${argumentsVerbose.concat()})`)
                            $('#member-label', memberTemplate).text(label)
                            $('#name-container', memberTemplate).click(_ => $('#call-dialog', memberTemplate).toggle())

                            $('#members-container', interfaceTemplatae).append(memberTemplate)
                        }
                    }

                    function getTextForMember(busName, interfaceName, path, member, ...ids) {
                        const query = `[data-dbus-bus-name="${busName}"] [data-dbus-path="${path}"] [data-dbus-interface="${interfaceName}"] [data-dbus-member="${member}"]`
                        return ids.map(id => $(`${query} #${id}`))
                    }

                    displayMember('methods', 'method', 'in_signature', [{
                        label: 'call',
                        callback: async function (busName, interfaceName, path, method, inputs) {
                            const [status, response] = getTextForMember(busName, interfaceName, path, method, 'status', 'response')
                            try {
                                const result = await callDbusMethod(busName, interfaceName, path, method, inputs)
                                status.text('success:')
                                status.css({ color: 'green' })
                                response.text(JSON.stringify(result))
                            } catch (e) {
                                status.text('error:')
                                status.css({ color: 'red' })
                                response.text(e)
                            }
                        }
                    }])
                    displayMember('properties', 'property', 'signature', [
                        {
                            label: 'get',
                            callback: async function (busName, interfaceName, path, member, inputs) {
                                const [status, response] = getTextForMember(busName, interfaceName, path, member, 'status', 'response')
                                try {
                                    const args = [interfaceName, member]
                                    const result = await callDbusMethod(busName, 'org.freedesktop.DBus.Properties', path, 'Get', args)
                                    status.text('success, value:')
                                    status.css({ color: 'green' })
                                    response.text(result)
                                } catch (e) {
                                    status.text('error:')
                                    status.css({ color: 'red' })
                                    response.text(e)
                                }
                            },
                            enabled: property => property.access.includes('read')
                        }, {
                            label: 'set',
                            callback: async function (busName, interfaceName, path, member, inputs) {
                                const [status, response] = getTextForMember(busName, interfaceName, path, member, 'status', 'response')
                                try {
                                    const args = [interfaceName, member, inputs[0]]
                                    const result = await callDbusMethod(busName, 'org.freedesktop.DBus.Properties', path, 'Set', args)
                                    status.text('success, value:')
                                    status.css({ color: 'green' })
                                    response.text(inputs[0])
                                } catch (e) {
                                    status.text('error:')
                                    status.css({ color: 'red' })
                                    response.text(e)
                                }
                            },
                            enabled: property => property.access.includes('write')
                        }], member => member.access != 'read')

                    const websockets = {}
                    displayMember('signals', 'signal', 'signature', [{
                        label: 'connect',
                        callback: async function (busName, interfaceName, path, member, inputs) {
                            const [status, response, signals, button] = getTextForMember(busName, interfaceName, path, member, 'status', 'response', 'signals', 'button-connect')
                            const search = `interface=${interfaceName}&path=${path}&member=${member}`
                            if (button.text() == 'connect') {
                                status.text('connecting...')
                                try {
                                    const websocket = new WebSocket(`${location.protocol.replace('http', 'ws')}//${location.host}/api/connections/${connectionId}/signals?${search}`)
                                    websocket.addEventListener('message', function (message) {
                                        console.log(message.data)
                                        const parsed = JSON.parse(message.data)
                                        const newSpan = $(`<div>`)
                                        newSpan.css({ 'animation-name': 'signal-new', 'animation-duration': '1s' })
                                        newSpan.text(JSON.stringify(parsed.args))
                                        signals.append(newSpan)

                                        for (let length = signals.children().length; length > 10; length--) {
                                            signals.children()[0].remove()
                                        }
                                    })
                                    websockets[search] = websocket
                                    button.text('disconnect')
                                    status.text('connected, signals:')
                                    status.css({ color: 'green' })
                                } catch (e) {
                                    status.text('error:')
                                    status.css({ color: 'red' })
                                    response.text(e)
                                }
                            } else {
                                websockets[search].close()
                                button.text('connect')
                                status.text('')
                                signals.text('')
                                status.css({ color: 'green' })
                            }
                        }
                    }], _ => false)

                    $('#interfaces-container', pathTemplate).append(interfaceTemplatae)
                }

                $('#paths-container', busContainer).append(pathTemplate)
            }
        }

        connectionContainer.append(busContainer)
    }
}