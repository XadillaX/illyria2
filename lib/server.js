var nssocket = require('./nssocket');
var events = require('events');
var util = require('util');
var async = require('async');

var Request = require('./request');
var Response = require('./response');

util.inherits(Server, events.EventEmitter);

function Server(options) {
    events.EventEmitter.call(this);

    var self = this;
    this.modules = {};
    this.tasks = [];
    this.server = nssocket.createServer(options, function(socket) {
        var moduleNames = Object.keys(self.modules);
        console.log(moduleNames);
        moduleNames.forEach(function(moduleName) {
            var module = self.modules[moduleName];
            var methods = Object.keys(module);
            methods.forEach(function(method) {
                socket.data(['*', 'call', moduleName, method], function() {
                    var params = [].slice.call(arguments);
                    params = params.length === 1 ? params[0] : {};
                    var msg_id = this.event[1];

                    var req = new Request(socket, params);
                    var res = new Response(socket, msg_id);
                    if (self.tasks.length > 0) {
                        async.mapSeries(self.tasks, function(task, done) {
                            task(req, res, done);
                        }, function() {
                            module[method](req, res);
                        });
                    } else {
                        module[method](req, res);
                    }
                });
            });
        });
    });
}

Server.prototype.listen = function(port, cb) {
    this.server.listen.apply(this.server, arguments);
};

/**
 *
 * @param func (req, res, next) {}
 */
Server.prototype.use = function(func) {
    this.tasks.push(func);
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
