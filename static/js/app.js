async function getAllBusses() {
    return callDbusMethod('org.freedesktop.DBus', 'org.freedesktop.DBus', '/org/freedesktop/DBus', 'ListNames')
}

async function callDbusMethod(bus_name, interface_, path, method, args = []) {
    path = path.substr(1)

    if (!path){
        path = '-'
    }

    const url = `/api/by-interface/${interface_}/by-path/${path}/methods/${method}?bus_name=${bus_name}`;

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


const busses = await getAllBusses()

for (const bus_name of busses) {
    const busContainer = $('#bus-template').contents().clone()
    $('#bus-name', busContainer).text(bus_name)
    $('#bus-name', busContainer).click(loadBus)

    let busLoaded = false

    async function loadBus(event) {
        if(busLoaded){
            $('#paths-container', busContainer).empty()
            busLoaded = false
            return
        }

        $('#paths-container', busContainer).append('Loading bus...')

        const response = await fetch(`/api/busses/${bus_name}`)
        const bus_data = await response.json()

        $('#paths-container', busContainer).empty()
        busLoaded = true

        for (const path of bus_data.paths) {
            const pathTemplate = $('#path-template').contents().clone()
            $('#path', pathTemplate).text(path.path)

            for (const interface_ of path.interfaces) {
                const interfaceTemplatae = $('#interface-template').contents().clone()
                $('#name', interfaceTemplatae).text(interface_.name)

                for (const method of interface_.methods) {
                    const methodTemplate = $('#member-template').contents().clone()

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
                    const argumentContainer = $('#params-container', methodTemplate)
                    for (const argument of method.in_signature) {
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

                    $('button', methodTemplate).click(async function (_) {
                        const inputs = argumentInputs.map(input => {
                            let value = input[1].value
                            if (input[0] == 'number') {
                                value = Number(value)
                            }
                            return value
                        })
                        try {
                            const result = await callDbusMethod(bus_name, interface_.name, path.path, method.name, inputs)
                            $('#status', methodTemplate).text('success:')
                            $('#status', methodTemplate).css({ color: 'green' })
                            $('#response', methodTemplate).text(JSON.stringify(result))
                        } catch (e) {
                            $('#status', methodTemplate).text('error:')
                            $('#status', methodTemplate).css({ color: 'red' })
                            $('#response', methodTemplate).text(e)
                        }
                    })

                    $('#name', methodTemplate).text(`${method.name}(${argumentsVerbose.concat()})`)
                    $('#name', methodTemplate).click(_ => $('#call-dialog', methodTemplate).show())

                    $('#members-container', interfaceTemplatae).append(methodTemplate)
                }

                $('#interfaces-container', pathTemplate).append(interfaceTemplatae)
            }

            $('#paths-container', busContainer).append(pathTemplate)
        }
    }

    $('#busses-container').append(busContainer)
}