var nssocket = require('./nssocket');
var events = require('events');
var util = require('util');
var assert = require('assert-plus');

var Request = require('./request');
var Response = require('./response');

util.inherits(Server, events.EventEmitter);

function Server(options) {
    events.EventEmitter.call(this);

    var self = this;
    this.modules = {};
    this.server = nssocket.createServer(options, function(socket) {
        var moduleNames = Object.keys(self.modules);
        console.log(moduleNames);
        moduleNames.forEach(function(moduleName) {
            var module = self.modules[moduleName];
            var methods = Object.keys(module);
            methods.forEach(function(method) {
                socket.data(['*', 'call', 'Elixir.' + moduleName, method], function() {
                    var params = [].slice.call(arguments);
                    params = params.length === 1 ? params[0] : {};
                    var msg_id = this.event[1];

                    module[method](new Request(socket, params),
                        new Response(socket, msg_id));
                });
            });
        });
    });
}

Server.prototype.listen = function(port, cb) {
    assert.number(port);
    if (cb) {
        assert.func(cb);
    }
    this.server.listen(port, cb);
};

Server.prototype.expose = function(module) {
    this.modules[module.name] = module.methods;
};

module.exports = {
    createServer: function(options) {
        var opts = options || {};
        opts.delimiter = opts.delimiter || '.';
        return new Server(opts);
    }
};
