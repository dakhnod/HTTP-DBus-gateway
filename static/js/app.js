function getAllBusses(){
    return [
        {
            name: 'org.Example',
            paths: [
                {
                    path: '/org/Example1',
                    interfaces: [
                        {
                            name: 'org.Example1',
                            methods: [
                                {
                                    name: 'HelloWorld',
                                    signature: '',
                                    signature_out: 's'
                                },
                                {
                                    name: 'Echo',
                                    signature: 's',
                                    signature_out: 's'
                                }
                            ]
                        }
                    ]
                }
            ]
        },
        {
            name: 'tha.flipper.ItemRegistry1',
            paths: [
                {
                    path: '/tha/flipper/ItemRegistry1',
                    interfaces: [
                        {
                            name: 'tha.flipper.ItemRegistry1',
                            methods: [
                                {
                                    name: 'GetAllItems',
                                    signature: '',
                                    signature_out: 's'
                                }
                            ]
                        },
                        {
                            name: 'org.freedesktop.DBus.Introspect',
                            methods: [
                                {
                                    name: 'GetAll',
                                    signature: 's',
                                    signature_out: 'vsv'
                                }
                            ]
                        },
                    ]
                },
                {
                    path: '/tha/flipper/ItemRegistry2',
                    interfaces: [
                        {
                            name: 'tha.flipper.ItemRegistry1',
                            methods: [
                                {
                                    name: 'GetAllItems',
                                    signature: '',
                                    signature_out: 's'
                                }
                            ]
                        },
                        {
                            name: 'org.freedesktop.DBus.Introspect',
                            methods: [
                                {
                                    name: 'GetAll',
                                    signature: 's',
                                    signature_out: 'vsv'
                                },
                                {
                                    name: 'Get',
                                    signature: 'ss',
                                    signature_out: 'v'
                                },
                                {
                                    name: 'Set',
                                    signature: 'ssv',
                                    signature_out: 'v'
                                }
                            ]
                        },
                    ]
                }
            ]
        }
    ]
}

const busses = getAllBusses()

for(const bus of busses){
    const busContainer = $('#bus-template').contents().clone()
    $('#bus-name', busContainer).text(bus.name)
    busContainer.click(loadBus)

    function loadBus(){
        $('#paths-container', busContainer).append('Loading bus...')

        $('#paths-container', busContainer).empty()

        for(const path of bus.paths){
            const pathTemplate = $('#path-template').contents().clone()
            $('#path', pathTemplate).text(path.path)
    
            for(const interface_ of path.interfaces){
                const interfaceTemplatae = $('#interface-template').contents().clone()
                $('#name', interfaceTemplatae).text(interface_.name)
    
                for(const method of interface_.methods){
                    const methodTemplate = $('#member-template').contents().clone()
    
                    const argumentsVerbose = []
                    const argumentMapping = {
                        's': 'string',
                        'v': 'variant'
                    }
    
                    for(const argument of method.signature){
                        argumentsVerbose.push(argumentMapping[argument])
                    }
    
                    $('#name', methodTemplate).text(`${method.name}(${argumentsVerbose.concat()})`)
    
                    $('#members-container', interfaceTemplatae).append(methodTemplate)
                }
    
                $('#interfaces-container', pathTemplate).append(interfaceTemplatae)
            }
    
            $('#paths-container', busContainer).append(pathTemplate)
        }
    }

    $('#busses-container').append(busContainer)
}