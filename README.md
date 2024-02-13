# HTTP DBus Gateway

![App Screenshot](https://github.com/dakhnod/HTTP-DBus-gateway/assets/26143255/61c34aaf-33ec-4462-9ca5-5f5f93365119)

This project aims to provide a way to acces your DBus by using just a browser on any device,
including your smartwatch, smart fridge, smartphone and anything browser enabled.

It tries to fix the exclusivity of great apps like D-Feet and D-Spy.

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