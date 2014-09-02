/**
 * XadillaX created at 2014-09-02 13:06
 *
 * Copyright (c) 2014 Huaban.com, all rights
 * reserved.
 */
var Enum = require("enum");
var async = require("async");
var EventEmitter = require("events").EventEmitter;
var util = require("util");
var zookeeper = require('node-zookeeper-client');
var CreateMode = zookeeper.CreateMode;

var ZK_STATUS = new Enum([ "NOT_CONNECTED", "CONNECTING", "CONNECTED" ]);

/**
 * Zookeeper Client for Illyria Server
 * @param connectingString
 * @param options
 * @param [root]
 * @param [prefix]
 * @constructor
 */
var IllyriaZK = function(connectingString, options, root, prefix) {
    EventEmitter.call(this);

    if(util.isArray(connectingString)) {
        connectingString = connectingString.join(",");
    }
    this.connectingString = connectingString;
    this.options = options;
    this.root = root || "/illyria";
    this.prefix = prefix || "/t";
    this.path = null;

    this.prefix = this.prefix.trim();
    if(!this.prefix.length) this.prefix = "/t";
    if(this.prefix[0] !== "/") this.prefix = "/" + this.prefix;

    // zookeeper core object
    this.client = zookeeper.createClient(this.connectingString, options);
    this.server = {
        host    : "127.0.0.1",
        port    : 3721,

        clients : 0
    };

    this.clientStatus = ZK_STATUS.NOT_CONNECTED;
};

util.inherits(IllyriaZK, EventEmitter);

/**
 * set illyria server information
 * @param host
 * @param port
 */
IllyriaZK.prototype.setServerInformation = function(host, port) {
    this.server.host = host;
    this.server.port = port;
};

/**
 * connect to zookeeper
 * @param callback
 * @param retryTimes
 */
IllyriaZK.prototype.connect = function(callback, retryTimes) {
    var self = this;
    if(undefined === callback) callback = function(){};

    if(this.clientStatus !== ZK_STATUS.NOT_CONNECTED) {
        return callback(new Error("IllyriaZK is already connecting or connected."));
    }

    this.clientStatus = ZK_STATUS.CONNECTING;

    // event of connected...
    this.client.once("connected", function() {
        self.clientStatus = ZK_STATUS.CONNECTED;

        // register for this node
        self._register(function(err, path) {
            if(!err) return callback(undefined, path);

            // retry...
            if(!retryTimes) return callback(err);
            if(retryTimes === -1) return setTimeout(self.connect, 1, callback, -1);
            setTimeout(self.connect, 1, callback, retryTimes - 1);
        });
    });

    this.client.on("state", function(state) {
        // automatically reconnect
        if(self.clientStatus !== ZK_STATUS.NOT_CONNECTED &&
            state === zookeeper.State.EXPIRED) {
            setTimeout(self.connect, 1, callback, -1);
        }
    });

    this.client.connect();
};

/**
 * manually disconnect (not error occurred)
 * @param [callback]
 */
IllyriaZK.prototype.disconnect = function(callback) {
    var self = this;
    if(callback === undefined) callback = function(){};

    if(this.clientStatus === ZK_STATUS.NOT_CONNECTED) {
        return;
    }

    this.clientStatus = ZK_STATUS.NOT_CONNECTED;

    this.client.remove(self.path, function() {
        self.client.close();
        callback();
    });
};

/**
 * update client count
 * @param count
 * @param [callback]
 */
IllyriaZK.prototype.updateClientCount = function(count, callback) {
    this.server.clients = count;
    this._updateData(callback);
};

/**
 * client disconnected
 * @param [callback]
 */
IllyriaZK.prototype.clientDisconnected = function(callback) {
    this.server.clients--;
    if(this.server.clients < 0) this.server.clients = 0;
    this._updateData(callback);
};

/**
 * client connected
 * @param [callback]
 */
IllyriaZK.prototype.clientConnected = function(callback) {
    this.server.clients++;
    this._updateData(callback);
};

/**
 * update zookeeper node data
 * @param callback
 * @private
 */
IllyriaZK.prototype._updateData = function(callback) {
    if(undefined === callback) callback = function(){};

    if(this.clientStatus !== ZK_STATUS.CONNECTED) callback();

    var data = new Buffer([ this.server.host, this.server.port, this.server.clients ].join(","));
    this.client.setData(this.path, data, function(err, stat) {
        callback(err, stat);
    });
};

/**
 * register for this node
 * @private
 */
IllyriaZK.prototype._register = function(callback) {
    if(undefined === callback) callback = function(){};
    if(this.clientStatus !== ZK_STATUS.CONNECTED) {
        return callback(new Error("You must connected to Zookeeper before you register for this node."));
    }

    var path = this.root + this.prefix;
    var self = this;
    var client = this.client;

    async.waterfall([
        /**
         * step 1.
         *   is root exists
         * @param callback
         */
        function(callback) {
            client.exists(self.root, callback);
        },

        /**
         * step 2.
         *   mkdir if root not exists.
         * @param exists
         * @param callback
         * @returns {*}
         */
        function(exists, callback) {
            if(exists) return callback(undefined);
            client.mkdirp(self.root, function(err) {
                if(err) return callback(err);
                callback(undefined);
            });
        },

        /**
         * step 3.
         *   create node.
         * @param callback
         */
        function(callback) {
            var data = new Buffer([ self.server.host, self.server.port, self.server.clients ].join(","));

            if(null === self.path) {
                client.create(path, data, CreateMode.EPHEMERAL_SEQUENTIAL, callback);
            } else {
                client.exists(self.path, function(err, exists) {
                    if(err) return callback(err);

                    // create a certain path
                    if(!exists) return client.create(self.path, data, CreateMode.EPHEMERAL, callback);

                    // use a certain path
                    client.setData(self.path, data, function(err, stat) {
                        if(err) return callback(err);
                        callback(undefined, self.path);
                    });
                });
            }
        }
    ], function(err, path) {
        if(err) return callback(err);
        self.path = path;
        callback(undefined, path);
    });
};

module.exports = IllyriaZK;
