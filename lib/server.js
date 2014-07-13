var nssocket = require('./nssocket');
var events = require('events');
var util = require('util');

var slice = Function.prototype.call.bind(Array.prototype.slice);

var Request = require('./request');
var Response = require('./response');

util.inherits(Server, events.EventEmitter);
function Server(options) {
    events.EventEmitter.call(this);

    var self = this;
    this._services = [];

    this.port = Number(options.port || 6785);

    nssocket.createServer(options, function(socket) {
        self._services.forEach(function(service) {
            var module = service.module;
            var methods = Object.keys(service.service);
            methods.forEach(function(method) {
                socket.data(['*', 'call', 'Elixir.' + module, method], function() {
                    var params = slice(arguments);
                    params = params.length === 1 ? params[0] : {};
                    var msg_id = this.event[1];

                    service.service[method](new Request(socket, params),
                        new Response(socket, msg_id));
                });
            });
        });
    }).listen(this.port);
}

Server.prototype.expose = function(module, service) {
    this._services.push({ module: module, service: service });
};

module.exports = {
    createServer: function(options) {
        var opts = options || {};
        opts.port = Number(opts.port || 6785);
        opts.delimiter = opts.delimiter || '.';
        return new Server(opts);
    }
};
