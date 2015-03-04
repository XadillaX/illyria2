/**
 * XadillaX created at 2015-03-04 11:24:50
 *
 * Copyright (c) 2015 Huaban.com, all rights
 * reserved
 */
require("sugar");

var EventEmitter = require("events").EventEmitter;
var util = require("util");
var async = require("async");

var helper = require("./helper");
var Zookeeper = require("./zookeeper");

var Request = require("./request");
var Response = require("./response");

/**
 * illyria server
 * @param {Object} [options] the illyria server options
 * @param {Object} [zookeeperOptions] the zookeeper options
 * @constructor
 */
var IllyriaServer = function(options, zookeeperOptions) {
    EventEmitter.call(this);

    this.modules = {};
    this.middlewares = [];

    this.options = options || {};
    this.zookeeperOptions = zookeeperOptions || {};

    this.zookeeper = null;
    if(this.zookeeperOptions && Object.keys(this.zookeeperOptions).length) {
        this.zookeeper = new Zookeeper(
            zookeeperOptions.connectString,
            zookeeperOptions,
            zookeeperOptions.root,
            zookeeperOptions.prefix);
    }

    this.server = helper.createServer(options, this._onClientConnected.bind(this));
};

util.inherits(IllyriaServer, EventEmitter);

/**
 * server listen
 * @param {Number} [port] the server port
 * @param {String} [host] the server host
 * @param {Function} callback the callback function
 */
IllyriaServer.prototype.listen = function(port, host, callback) {
    if(typeof port === "function" || undefined === port) {
        callback = (undefined === port) ? callback : port;
        port = this.options.port;
    } else {
        this.options.port = port;
    }

    if(typeof host === "function" || undefined === host) {
        callback = (undefined === host) ? callback : host;
        host = this.options.host;
    } else {
        this.options.host = host;
    }

    if(undefined === host && this.zookeeper) {
        throw new Error("You must specify your server host when you use zookeeper.");
    }

    if(undefined === port) {
        throw new Error("You must specify a port number.");
    }

    if(undefined === this.options.host) host = this.options.host = "0.0.0.0";

    var self = this;
    this.server.listen(port, host, function() {
        if(!self.zookeeper) return callback();

        if([ "0.0.0.0", "127.0.0.1", "localhost" ].indexOf(host) >= 0) {
            console.warn("===============================================================");
            console.warn("| :: You're using Zookeeper client, but your host is " + host + ".");
            console.warn("| :: It may occur some problems.");
            console.warn("| :: [ ⬆️ WARNNING ⬆️ ]");
            console.warn("===============================================================");
        }

        self.zookeeper.setServerInformation(host, port);
        self.zookeeper.connect(function(err/**, path*/) {
            if(err) return self.server.close(), callback(err);
            callback();
        });
    });
};

/**
 * use a middleware
 * @param {Function} func the middleware function
 */
IllyriaServer.prototype.use = function(func) {
    this.middlewares.push(func);
};

/**
 * expose a router module to server
 * @param {Object|String} module the whole module defination or a module name
 * @param {Object} [methods] the methods object when `module` is a string
 */
IllyriaServer.prototype.expose = function(module, methods) {
    if(arguments.length === 1 && typeof module === "object") {
        this.modules[module.name] = module.methods;
    } else if(arguments.length === 2 && typeof module === "string" && typeof methods === "object") {
        this.modules[module] = methods;
    } else {
        throw new Error("Bad arguments while exposing module and methods.");
    }
};

/**
 * close the server
 * @param {Function} callback the callback function
 */
IllyriaServer.prototype.close = function(callback) {
    if(this.zookeeper) this.zookeeper.disconnect();
    this.server.close(callback);
};

/**
 * event when a new client is connected
 * @param {ISocket} socket the socket object
 * @private
 */
IllyriaServer.prototype._onClientConnected = function(socket) {
    var moduleNames = Object.keys(this.modules);
    var self = this;

    // add client count
    if(this.zookeeper) {
        this.zookeeper.incClientCount();
        socket.on("close", function() {
            self.on("close", function() {
                self.zookeeper.decClientCount();
            });
        });
    }

    // add received event
    socket.addReceivedEvent = function(moduleName, methodName, listener) {
        var func = function() {
            var params = [].slice.call(arguments);
            params = (params.length === 1) ? params[0] : {};
            var msgId = this.event[1];

            var req = new Request(socket, params);
            var resp = new Response(socket, msgId);
            
            if(self.middlewares.length > 0) {
                async.mapSeries(self.middlewares, function(task, callback) {
                    task(req, resp, callback);
                }, function(){
                    listener(req, resp);
                });
            } else {
                listener(req, resp);
            }
        };
        func.listener = listener;

        this.eventFuncs = this.eventFuncs || {};
        var key = moduleName + "♥" + methodName;
        this.eventFuncs[key] = this.eventFuncs[key] || [];
        this.eventFuncs[key].push(func);
        this.data([ "*", "call", moduleName, methodName ], func);
    };

    // remove received event
    socket.removeReceivedEvent = function(moduleName, methodName, listener) {
        var key = moduleName + "♥" + methodName;
        if(!this.eventFuncs || !this.eventFuncs[key]) return;
        var funcs = this.eventFuncs[key];
        for(var i = 0; i < funcs.length; i++) {
            var func = funcs[i];
            if(func.listener === listener) {
                this.undata([ "*", "call", moduleName, methodName ], func);
                funcs.removeAt(i);
                break;
            }
        }
    };

    // add all methods into sockets
    moduleNames.forEach(function(name) {
        var module = self.modules[name];
        var methods = Object.keys(module);

        methods.forEach(function(method) {
            socket.addReceivedEvent(name, method, module[method]);
        });
    });
};

/**
 * create a illyria server
 * @param {Object} [options] the illyria server options
 * @param {Object} [zookeeperOptions] the zookeeper options
 * @return {IllyriaServer}
 */
IllyriaServer.createServer = function(options, zookeeperOptions) {
    options = options || {};
    return new IllyriaServer(options, zookeeperOptions);
};

module.exports = IllyriaServer;

