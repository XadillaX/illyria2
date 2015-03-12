# illyria2 [![TravisCI](https://img.shields.io/travis/XadillaX/illyria2.svg)](https://travis-ci.org/XadillaX/illyria2) [![Coveralls](https://img.shields.io/coveralls/XadillaX/illyria2/master.svg)](https://coveralls.io/r/XadillaX/illyria2)

The next generation Illyria RPC SDK for node.js.

## Installation

```shell
$ npm install --save illyria2
```

## Usage

### Server

First you should create a server.

```javascript
var illyria2 = require("illyria2");
var server = illyria2.createServer(options);
```

or

```javascript
var server = new illyria2.Server(options);
```

> options is an optional parameter and may contain:
>
> * `maxRetries`: default to 10
> * `retryInterval`: default to 5000
> * `maxListeners`: maximum server event / client event listeners count, default to 10
> * `port`: optional, you may specify it in `listen`
> * `host`: optional, you may specify it in `host`
> * `...`: other options for [net.Socket](https://iojs.org/api/net.html#net_new_net_socket_options)

After the server is created, you may expose or overwrite a module of its events to clients:

```javascript
server.expose("module", {
    "method": function(req, resp) {
        // ... do sth ...
        resp.send(RESPONSE_MESSAGE);
    }
});
```

> The code above will expose (may overwrite previous module `"module"`) the whole module `"module"` with only one method `"method"` to clients.
> And the method `"method"` will do something and send `RESPONSE_MESSAGE` back to client who made this request.

When all modules are exposed, you can let the server listen to a certain port:

```javscript
server.listen([SERVER_PORT], [SERVER_HOST], callback);
```

> `SERVER_PORT` and `SERVER_HOST` are optional when you specified in constructor's `option` parameter. `callback` is the callback function when your server listened successfully.

