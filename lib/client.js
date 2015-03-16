/**
 * XadillaX created at 2015-03-11 12:05:19
 *
 * Copyright (c) 2015 Huaban.com, all rights
 * reserved
 */
require("sugar");

var util = require("util");
var helper = require("./helper");

var ISocket = require("./isocket");
var EventEmitter = require("events").EventEmitter;

const MAX_MSG_ID = 2147483647;

/**
 * illyria client
 * @param {String} host the hostname
 * @param {Number} port the port number
 * @param {Object} [options] the socket options
 * @constructor
 */
var IllyriaClient = function(host, port, options) {
    EventEmitter.call(this);

    this.socket = new ISocket(options);

    this.port = port;
    this.host = host;

    this.runTimeout = options.runTimeout || 10000;
    this.msgId = 0;

    this.socket.addListener("error", this.emit.bind(this, "error"));
    this.socket.addListener("close", this.emit.bind(this, "close"));
};

util.inherits(IllyriaClient, EventEmitter);

/**
 * connect to server
 * @param {Function} callback the callback function
 */
IllyriaClient.prototype.connect = function(callback) {
    if(undefined === callback) callback = helper.emptyFunc;
    this.socket.connect(this.port, this.host, callback);
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
 * close the connection
 */
IllyriaClient.prototype.close = function() {
    this.socket.end();
    this.socket.destroy();
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
 * create an illyria client
 * @param {String} host the hostname
 * @param {Number} port the port number
 * @param {Object} [options] the socket options
 * @return {IllyriaClient} the client object
 */
IllyriaClient.createClient = function(host, port, options) {
    return new IllyriaClient(host, port, options);
};

module.exports = IllyriaClient;

