/**
 * XadillaX created at 2015-03-17 13:54:16
 *
 * Copyright (c) 2015 Huaban.com, all rights
 * reserved
 */
var Enum = require("enum");
var EventEmitter = require("events").EventEmitter;
var util = require("util");
var async = require("async");
var zookeeper = require("node-zookeeper-client");

var helper = require("./helper");

var CREATE_MODE = zookeeper.CreateMode;
var ZK_STATUS = new Enum([
    "NOT_CONNECTED",
    "CONNECTING",
    "CONNECTED"
]);

/**
 * illyria zookeeper wrapper
 * @param {String|Array} connectString the connect string(s)
 * @param {Object} options the connect options, refer to
 *                         https://github.com/alexguan/node-zookeeper-client
 *                         #client-createclientconnectionstring-options
 * @param {String} [root] the root path
 * @param {String} [prefix] the path's prefix
 * @constructor
 */
var Zookeeper = function(connectString, options, root, prefix) {
    EventEmitter.call(this);

    if(util.isArray(connectString)) {
        connectString = connectString.join(",");
    }

    this.connectString = connectString;
    this.options = options;
    this.root = root || "/illyria";
    this.prefix = prefix || "/HB_";
    this.path = null;

    this.root = this.root.trim();
    this.prefix = this.prefix.trim();

    if(!this.root.length) this.root = "/illyria";
    if(!this.prefix.length) this.prefix = "/HB_";
    if(this.root[0] !== "/") this.root = "/" + this.root;
    if(this.prefix[0] !== "/") this.prefix = "/" + this.prefix;

    this.client = zookeeper.createClient(this.connectString, options);
    this.server = {
        host: "127.0.0.1",
        port: 3721,

        clients: 0
    };

    this.clientStatus = ZK_STATUS.NOT_CONNECTED;

    this._setup();
};

util.inherits(Zookeeper, EventEmitter);

/**
 * setup for this zookeeper wrapper (like event listeners)
 * @private
 */
Zookeeper.prototype._setup = function() {
    var self = this;

    // automatically reconnect when expired
    this.client.on("state", function(state) {
        if(self.clientStatus !== ZK_STATUS.NOT_CONNECTED &&
            state === zookeeper.State.EXPIRED) {
            setTimeout(self.connect, 100, function(err) {
                console.error(
                    "Illyria zookeeper failed to reconnect when expired: " +
                    err.message);
            });
        }
    });

    // automatically reconnect when dropped
    this.client.on("disconnected", function() {
        // this means disconnected manually
        if(self.clientStatus === ZK_STATUS.NOT_CONNECTED) {
            return;
        }

        setTimeout(self.connect, 100, function(err) {
            console.error(
                "Illyria zookeeper failed to reconnect when dropped: " +
                err.message);
        });
    });
};

/**
 * set illyria server's information
 * @param {String} host the host of illyria server
 * @param {Number} port the port of illyria server
 */
Zookeeper.prototype.setServerInformation = function(host, port) {
    this.server.host = host;
    this.server.port = port;

    this._update();
};

/**
 * connect to zookeeper server
 * @param {Function} [callback] the callback function
 */
Zookeeper.prototype.connect = function(callback) {
    if(undefined === callback) callback = helper.emptyFunc;

    var self = this;

    if(this.clientStatus !== ZK_STATUS.NOT_CONNECTED) {
        return process.nextTick(function() {
            callback(new Error(
                "Illyria zookeeper client is already connecting or connected"));
        });
    }

    this.client.once("connected", function() {
        self.clientStatus = ZK_STATUS.CONNECTED;
        self._register(callback);
    });

    this.clientStatus = ZK_STATUS.CONNECTING;
    this.client.connect();
};

/**
 * disconnect from zookeeper server
 * @param {Function} [callback] the callback function
 */
Zookeeper.prototype.disconnect = function(callback) {
    if(undefined === callback) callback = helper.emptyFunc;

    var self = this;

    if(this.clientStatus !== ZK_STATUS.CONNECTED) {
        return process.nextTick(function() {
            callback();
        });
    }

    this.clientStatus = ZK_STATUS.NOT_CONNECTED;
    this.client.remove(self.path, function() {
        self.client.close();
        callback();
    });
};

/**
 * increase illyria server's connected client count in zookeeper's value
 * @param {Function} [callback] the callback function
 */
Zookeeper.prototype.incClientCount = function(callback) {
    this.server.clients++;
    this._update(callback);
};

/**
 * decrease illyria server's connected client count in zookeeper's value
 * @param {Function} [callback] the callback function
 */
Zookeeper.prototype.decClientCount = function(callback) {
    this.server.clients--;
    if(this.server.clients < 0) this.server.clients = 0;
    this._update(callback);
};

/**
 * update zookeeper's value for this node
 * @param {Function} [callback] the callback function
 * @private
 */
Zookeeper.prototype._update = function(callback) {
    if(undefined === callback) callback = helper.emptyFunc;
    if(this.clientStatus !== ZK_STATUS.CONNECTED) return callback();

    var data = new Buffer([
        this.server.host,
        this.server.port,
        this.server.clients
    ].join(","));

    this.client.setData(this.path, data, function(err, stat) {
        callback(err, stat);
    });
};

/**
 * update illyria server's connected client count
 * @param {Number} count illyria server's connected client count
 * @param {Function} [callback] the callback function
 */
Zookeeper.prototype.updateClientCount = function(count, callback) {
    this.server.clients = count;
    this._update(callback);
};

/**
 * register information into zookeeper for this node
 * @param {Function} [callback] the callback function
 * @private
 */
Zookeeper.prototype._register = function(callback) {
    if(undefined === callback) callback = helper.emptyFunc;
    if(this.clientStatus !== ZK_STATUS.CONNECTED) {
        return process.nextTick(function() {
            callback(new Error(
                "You must connect to Zookeeper before you register for this node."));
        });
    }

    var path = this.root + this.prefix;
    var client = this.client;
    var self = this;

    /**
     * we should create root, path first if it's not existing.
     * and then we insert the data to the path,
     * or we should just update it.
     */
    async.waterfall([
        function(callback) {
            client.exists(self.root, callback);
        },

        function(exists, callback) {
            return exists ?
                callback(undefined) :
                client.mkdirp(self.root, function(err) {
                    callback(err);
                });
        },

        function(callback) {
            var data = new Buffer([
                self.server.host,
                self.server.port,
                self.server.clients
            ].join(","));

            if(null === self.path) {
                client.create(path, data, CREATE_MODE.EPHEMERAL_SEQUENTIAL, callback);
            } else {
                client.exists(self.path, function(err, exists) {
                    if(err) return callback(err);

                    if(!exists) {
                        return client.create(self.path, data, CREATE_MODE.EPHEMERAL, callback);
                    }

                    client.setData(self.path, data, function(err) {
                        if(err) return callback(err);
                        callback(undefined, self.path);
                    });
                });
            }
        }
    ], function(err, path) {
        if(err) return callback(err);
        self.path = path;
        callback(err, path);
    });
};

Zookeeper.ZK_STATUS = ZK_STATUS;

module.exports = Zookeeper;

