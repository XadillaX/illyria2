var nssocket = require('./nssocket');
var events = require('events');
var util = require('util');

var Request = require('./request');
var Response = require('./response');

util.inherits(Server, events.EventEmitter);

exports.services = {};

function Server(options) {
    events.EventEmitter.call(this);

    this.port = Number(options.port || 6785);

    var modules = Object.keys(exports.services);
    nssocket.createServer(options, function(socket) {
        modules.forEach(function(module) {
            var services = exports.services[module];
            var methods = Object.keys(services);
            methods.forEach(function(method) {
                socket.data(['*', 'call', 'Elixir.' + module, method], function() {
                    var params = [].slice.call(arguments);
                    params = params.length === 1 ? params[0] : {};
                    var msg_id = this.event[1];

                    services[method](new Request(socket, params),
                        new Response(socket, msg_id));
                });
            });
        });
    }).listen(this.port);
}

module.exports = {
    expose: function(module, services) {
        exports.services[module] = services;
    },
    createServer: function(options) {
        var opts = options || {};
        opts.port = Number(opts.port || 6785);
        opts.delimiter = opts.delimiter || '.';
        return new Server(opts);
    }
};
