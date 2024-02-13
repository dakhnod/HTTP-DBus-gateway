# HTTP DBus Gateway

![App Screenshot](https://github.com/dakhnod/HTTP-DBus-gateway/assets/26143255/86998e1e-3044-493a-ac6a-dc156d86a548)

This project aims to provide a way to acces your DBus by using just a browser on any device,
including your smartwatch, smart fridge, smartphone and anything browser enabled.

It tries to fix the exclusivity of great apps like D-Feet and D-Spy.

Also, being API-first, you can use it to bridge non-dbus apps, programs and websites to DBus over HTTP.
Websites can use HTTP-requests and WebSockets to access DBus through this gateway.

## Installation

To install the package, run `pip install http-dbus-gateway`.

## Running

To run the app, after following the Installation instruction, run `quart --app http_dbus_gateway run`.
Here, all quart-specifiy switches like `--host` or `--port` can be used.

## Custom connection strings

By default, the app tries to connect to your System and Session bus.
If you want to override this behaviour, set the environment variable `DBUS_ADDRESS` to a string containing dbus connection strings, seperated by `;;`.

Here is an example command line, copying the default behaviour:
`DBUS_ADDRESS="unix:path=/run/user/1000/bus;;unix:path=/var/run/dbus/system_bus_socket" quart --app http_dbus_gateway run`