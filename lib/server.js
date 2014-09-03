var nssocket = require('./nssocket');
var events = require('events');
var util = require('util');
var async = require('async');

var Request = require('./request');
var Response = require('./response');
var IllyriaZk = require('./illyria-zk');

/**
 * Illyria Server
 * @param options { host: ..., port: ... }
 * @param zkOptions { connectingString: ..., root: ..., prefix: ..., sessionTimeout: ..., spinDelay: ..., retries: ... }
 * @constructor
 */
function Server(options, zkOptions) {
    events.EventEmitter.call(this);

    var self = this;
    this.modules = { };
    this.tasks = [];

    this.options = options;
    this.zkOptions = zkOptions;

    this.zk = null;
    if(zkOptions !== undefined) {
        this.zk = new IllyriaZk(zkOptions.connectingString, zkOptions, zkOptions.root, zkOptions.prefix);
    }

    this.server = nssocket.createServer(options, function(socket) {
        var moduleNames = Object.keys(self.modules);
        moduleNames.forEach(function(moduleName) {
            var module = self.modules[moduleName];
            var methods = Object.keys(module);

            // add client count
            if(self.zk) {
                self.zk.clientConnected();
                socket.on('close', function() { self.zk.clientDisconnected(); });
            }

            methods.forEach(function(method) {
                socket.data(['*', 'call', moduleName, method], function() {
                    var params = [].slice.call(arguments);
                    params = params.length === 1 ? params[0] : { };
                    var msg_id = this.event[1];

                    var req = new Request(socket, params);
                    var res = new Response(socket, msg_id);
                    if(self.tasks.length > 0) {
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

util.inherits(Server, events.EventEmitter);

/**
 * close server
 : @param callback
 */
Server.prototype.close = function(callback) {
    if(this.zk) this.zk.disconnect();
    this.server.close(callback);
};

/**
 * start listening on a certain port
 * @param [port]
 * @param [host]
 * @param cb
 */
Server.prototype.listen = function(port, host, cb) {
    if(typeof port === "function" || undefined === port) {
        cb = (undefined === port) ? cb : port;
        port = this.options.port;
    } else {
        this.options.port = port;
    }

    if(typeof host === "function" || undefined === host) {
        cb = (undefined === host) ? cb : host;
        host = this.options.host;
    } else {
        this.options.host = host;
    }

    if(undefined === host && this.zk) {
        throw new Error("You must specify your server host when you use Zookeeper.");
    }

    if(undefined === port) {
        throw new Error("You must specify a port when you use Zookeeper.");
    }

    var self = this;
    if(undefined === this.options.host) this.options.host = "0.0.0.0";

    this.server.listen(port, host, function() {
        if(!self.zkOptions) {
            return cb();
        }

        self.zk.setServerInformation(host, port);
        self.zk.connect(function(err, path) {
            console.log(path);
            if(err) {
                self.server.close();
                return cb(err);
            }

            cb();
        });
    });
};

/**
 * add a middleware to the chain
 * @param func
 */
Server.prototype.use = function(func) {
    this.tasks.push(func);
};

/**
 * Expose an router event
 * @param module
 */
Server.prototype.expose = function(module) {
    this.modules[module.name] = module.methods;
};

module.exports = {
    Server: Server,
    createServer: function(options, zkOptions) {
        var opts = options || { };
        opts.delimiter = opts.delimiter || '.';
        return new Server(opts, zkOptions);
    }
};
