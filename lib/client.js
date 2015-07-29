/**
 * XadillaX created at 2015-03-11 12:05:19
 *
 * Copyright (c) 2015 Huaban.com, all rights
 * reserved
 */
require("sugar");

var async = require("async");
var util = require("util");
var helper = require("./helper");

var ISocket = require("./isocket");
var EventEmitter = require("events").EventEmitter;
var zookeeper = require("node-zookeeper-client");

var MAX_MSG_ID = 2147483647;

/**
 * illyria client
 * @param {String} [host] the hostname
 * @param {Number} [port] the port number
 * @param {Object} [options] the socket options
 * @constructor
 */
var IllyriaClient = function(host, port, options) {
    EventEmitter.call(this);

    // we consider this situation is using zookeeper
    if(typeof host === "object") {
        options = host;
        host = port = undefined;
    }

    options = options || {};

    // using zookeeper will ignore `host` and `port`
    if(options.zookeeper) {
        host = port = undefined;

        this.zookeeperOptions = options.zookeeper || {};
        this.zookeeperOptions.connectString = this.zookeeperOptions.connectString || "127.0.0.1:2181";
        this.zookeeperOptions.root = this.zookeeperOptions.root || "/illyria";
        this.zookeeperOptions.prefix = this.zookeeperOptions.prefix || "/HB_";

        if(this.zookeeperOptions.connectString instanceof Array) {
            this.zookeeperOptions.connectString = this.zookeeperOptions.connectString.join(",");
        }

        if(!this.zookeeperOptions.root.startsWith("/")) {
            this.zookeeperOptions.root = "/" + this.zookeeperOptions.root;
        }

        if(!this.zookeeperOptions.prefix.startsWith("/")) {
            this.zookeeperOptions.prefix = "/" + this.zookeeperOptions.prefix;
        }

    }

    this.options = options;
    this.socket = new ISocket(options);
    this.status = "NOT_CONNECTED";

    this.port = port;
    this.host = host;

    this.runTimeout = options.runTimeout || 10000;
    this.msgId = 0;

    this.socket.addListener("error", this.emit.bind(this, "error"));
    this.socket.addListener("close", this.emit.bind(this, "close"));
    this.socket.addListener("tryReconnect", this.emit.bind(this, "tryReconnect"));
    this.socket.addListener("connected", this.emit.bind(this, "connected"));
    
    var self = this;
    this.on("connected", function() {
        self.status = "CONNECTED";
    });
    this.on("tryReconnect", function() {
        self.status = "RECONNECTING";
    });
    this.on("close", function(hadError) {
        if(hadError) {
            if(!process.env.ZK_NO_WARN) console.warn("Illyria client closed with an error.");
        }

        self.status = "DISCONNECTED";
    });
    
    this.on("error", function() {});
};

util.inherits(IllyriaClient, EventEmitter);

IllyriaClient.prototype.connectWithZookeeper = function(callback) {
    if(!this.zookeeperOptions) {
        return process.nextTick(function() {
            callback(new Error("No zookeeper options."));
        });
    }

    var self = this;

    // using zookeeper
    var root = this.zookeeperOptions.root;
    var prefix = this.zookeeperOptions.prefix;
    var _path = root + prefix;

    var _zookeeper = zookeeper.createClient(
        this.zookeeperOptions.connectString,
        this.zookeeperOptions);

    _zookeeper.once("connected", function() {
        // get children
        _zookeeper.getChildren(root, function(err, children/**, stat*/) {
            if(err) return callback(err);

            // get all children
            var servers = [];
            async.eachLimit(children, 10, function(child, callback) {
                var path = root + "/" + child;

                // not this time's node
                // eg.
                //   we are searching `/foo/bar_*`
                //   and current node is `/foo/baz_*`
                //   we should ignore it
                if(!path.startsWith(_path)) return callback();

                _zookeeper.getData(root + "/" + child, function(err, data) {
                    if(err) return callback(err);
                    var res = data.toString().split(",");
                    res[1] = parseInt(res[1]);
                    res[2] = parseInt(res[2]);
                    servers.push(res);
                    callback();
                });
            }, function(err) {
                // close zookeeper
                _zookeeper.close();

                if(err && !servers.length) {
                    return callback(err);
                }

                if(!servers.length) return callback(new Error("No available server found."));
                var server = servers[0];
                for(var i = 1; i < servers.length; i++) {
                    if(servers[i][2] < server[2]) {
                        server = servers[i];
                    }
                }

                // now `server` is our available server!
                if(self.socket) {
                    self.host = server[0];
                    self.port = server[1];
                    self.socket.connect(server[1], server[0], callback);
                } else {
                    callback(new Error("Connect with a null socket. (maybe this socket has been destroyed before)"));
                }
            });
        });
    });

    _zookeeper.connect();
};

/**
 * connect to server
 * @param {Function} callback the callback function
 */
IllyriaClient.prototype.connect = function(callback) {
    if(undefined === callback) callback = helper.emptyFunc;
    if(null === this.socket || undefined === this.socket) {
        this.socket = new ISocket(this.options);
    }

    if(this.zookeeperOptions) {
        return this.connectWithZookeeper(callback);
    } else {
        // no zookeeper
        if(this.socket) {
            return this.socket.connect(this.port, this.host, callback);
        } else {
            return process.nextTick(function() {
                callback(new Error("Connect with a null socket. (maybe this socket has been destroyed before)"));
            });
        }
    }
};

/**
 * send a message to server
 * @param {String} module module name
 * @param {String} method method name
 * @param {Object} params the message body object
 * @param {Function} callback the callback function
 */
IllyriaClient.prototype.send = function(module, method, params, callback) {
    var self = this;
    var msgId = this._nextMessageId();
    var timer;

    var onData = function() {
        if(timer) {
            clearTimeout(timer);
        }

        var data = arguments[0] || [];
        if(data.length !== 2) {
            return callback(new Error("Invalid return data: " + JSON.stringify(data)));
        }

        var type = data.shift();

        if("reply" === type) return callback(undefined, data.shift());
        if("error" === type) {
            var err = data.shift();
            return callback(new Error(err.message || err));
        }

        return callback(new Error("Received an unknown type: " + type + "."), data);
    };

    timer = setTimeout(function() {
        self.socket.undata([ msgId ], onData);
        callback(new Error(
            "Timeout when send and wait for response after " + 
            self.runTimeout + 
            "ms."));
    }, this.runTimeout);

    this.socket.send([ msgId, "call", module, method ], params);
    this.socket.dataOnce([ msgId ], onData);
};

/**
 * cast a message to server
 * @param {String} module module name
 * @param {String} method method name
 * @param {Object} params the message body object
 * @param {Function} callback the callback function
 */
IllyriaClient.prototype.cast = function(module, method, params, callback) {
    var self = this;
    var msgId = this._nextMessageId();
    var timer;

    var onData = function() {
        if(timer) {
            clearTimeout(timer);
        }

        var data = arguments[0] || [];

        // TODO: 谁帮我把这个逻辑合成一个？
        if(data.length === 1 && data[0] !== "noreply") {
            return callback(new Error("Invalid return data: " + JSON.stringify(data)));
        } else if(data.length !== 2 && data.length !== 1) {
            return callback(new Error("Invalid return data: " + JSON.stringify(data)));
        }

        var type = data.shift();

        if("noreply" === type) return callback();
        return callback(new Error("Received an unmatched type: " + type + "."), data);
    };

    timer = setTimeout(function() {
        self.socket.undata([ msgId ], onData);
        callback(new Error(
            "Timeout when cast and wait for response after " + 
            self.runTimeout + 
            "ms."));
    }, this.runTimeout);

    this.socket.send([ msgId, "cast", module, method ], params);
    this.socket.dataOnce([ msgId ], onData);
};

/**
 * close the connection
 */
IllyriaClient.prototype.close = function() {
    if(this.socket) {
        try {
            this.socket.end();
            this.socket.destroy();
        } catch(e) {
            //...
        }
    }
    this.socket = null;
    this.status = "CLOSED";
};

/**
 * generate the next message id
 * @private
 */
IllyriaClient.prototype._nextMessageId = function() {
    if(++this.msgId >= MAX_MSG_ID) {
        this.msgId = 1;
    }

    return this.msgId.toString();
};

/**
 * return the connect status
 * @return {String} the connect status
 */
IllyriaClient.prototype.connectStatus = function() {
    return this.status;
};

/**
 * create an illyria client
 * @param {String} [host] the hostname
 * @param {Number} [port] the port number
 * @param {Object} [options] the socket options
 * @return {IllyriaClient} the client object
 */
IllyriaClient.createClient = function(host, port, options) {
    return new IllyriaClient(host, port, options);
};

module.exports = IllyriaClient;
