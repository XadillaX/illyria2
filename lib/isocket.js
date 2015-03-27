/**
 * XadillaX created at 2015-03-03 16:05:08
 *
 * Copyright (c) 2015 Huaban.com, all rights
 * reserved
 */
var net = require("net");
var util = require("util");
var EventEmitter = require("eventemitter2").EventEmitter2;
var msgpack = require("msgpack");
var helper = require("./helper");

/**
 * ISocket
 * @param {Socket} [socket] the socket object
 * @param {Object} options the options
 * @constructor
 */
var ISocket = function(socket, options) {
    if(!options) {
        options = socket || {};
        socket = new net.Socket(options);
    }

    this.socket = socket;
    this.connected = options.connected || socket.writable && socket.readable || false;

    this.retry = {
        retries: 0,
        max: options.maxRetries || 10,
        interval: options.retryInterval || 5000,
        wait: options.retryInterval || 5000
    };

    this.$reconnect = options.reconnect || false;
    this.$options = options;

    this.$buff = null;
    this.$msg = null;

    EventEmitter.call(this, {
        delimiter: "::",
        wildcard: true,
        maxListeners: options.maxListeners || 10
    });

    this._setup();
};

util.inherits(ISocket, EventEmitter);

/**
 * send a message into this socket
 * @param {Array} event the event identity array
 * @param {Object} params the data message
 * @param {Function} callback the callback function
 */
ISocket.prototype.send = function(event, params, callback) {
    if(!this.socket || !this.connected) {
        return this.emit("error", new Error("ISocket: sending on a bad socket."));
    }

    var message = [].concat(event);
    message.push(params);
    message = msgpack.pack(message);

    var buff = new Buffer(4 + message.length);
    buff.writeUInt32BE(message.length, 0, true);
    message.copy(buff, 4);

    this.socket.write(buff, callback);
};

/**
 * send a successful message
 * @param {Array} event the event identity array
 * @param {Object} params the data message
 * @param {Function} callback the callback function
 */
ISocket.prototype.success = function(event, params, callback) {
    this.send(event.concat([ "reply" ]), params, callback);
};

/**
 * send an error message
 * @param {Array} event the event identity array
 * @param {Object} error the error data
 * @param {Function} callback the callback function
 */
ISocket.prototype.error = function(event, error, callback) {
    this.send(event.concat([ "error" ]), error, callback);
};

/**
 * listen for an event
 * @param {Array} event the event identity array
 * @param {Function} listener the processor to process this event
 */
ISocket.prototype.data = function(event, listener) {
    this.on([ "data" ].concat(event), listener);
};

/**
 * unlisten for an event
 * @param {Array} event the event identity array
 * @param {Function} listener the processor to process this event
 */
ISocket.prototype.undata = function(event, listener) {
    this.off([ "data" ].concat(event), listener);
};

/**
 * listen for an event once
 * @param {Array} event the event identity array
 * @param {Function} listener the processor to process this event
 */
ISocket.prototype.dataOnce = function(event, listener) {
    this.once([ "data" ].concat(event), listener);
};

/**
 * set idle/timeout timer
 * @param {Number} time how often to emit idle
 */
ISocket.prototype.setIdle = function(time) {
    this.socket.setTimeout(time);
    this._timeout = time;
};

/**
 * destroy this object
 */
ISocket.prototype.destroy = function() {
    this.removeAllListeners();
    if(this.socket) {
        try {
            this.socket.end();
            this.socket.destroy();
        } catch(e) {
            // do nothing...
        }
    }

    this.$msg = null;
    this.$buff = null;
    this.emit("destroy");
};

/**
 * close the underlying socket, recommend you call destroy after
 */
ISocket.prototype.end = function() {
    this.connected = false;

    if(this.socket) {
        try {
            this.socket.end();
        } catch(e) {
            this.emit("error", e);
            return;
        }

        this.socket = null;
    }
};

/**
 * connect
 * @param {...} arguments
 */
ISocket.prototype.connect = function(/** ... */) {
    var args = Array.prototype.slice.call(arguments);
    var self = this;
    var callback, host, port;

    args.forEach(function(arg) {
        switch(typeof arg) {
            case "number": port = arg; break;
            case "string": host = arg; break;
            case "function": callback = arg; break;
            default:
                self.emit("error", new Error("Bad argument to connect"));
                break;
        }
    });

    this.port = port || this.port;
    this.host = host || this.host || "127.0.0.1";
    args = this.port ? [ this.port, this.host ] : [ this.host ];

    if(callback) args.push(callback);

    var errHandlers = this.listeners("error");
    if(errHandlers.length > 0) {
        this.socket._events.error = errHandlers[errHandlers.length - 1];
    }

    this.connected = true;
    this.socket.connect.apply(this.socket, args);
};

/**
 * try for reconnect
 */
ISocket.prototype.reconnect = function() {
    var self = this;

    var doReconn = function() {
        self.retry.waiting = true;
        self.socket.removeAllListeners();
        self.socket = new net.Socket(self.$options);

        self.socket.once("connect", function() {
            self.retry.waiting = false;
            self.retry.retries = 0;
        });

        self._setup();
        self.connect();
    };

    var tryReconn = function() {
        self.retry.retries++;
        if(self.retry.retries >= self.retry.max) {
            return self.emit("error",
                new Error("Did not reconnect after maximum retries: " + self.retry.max + "."));
        }

        doReconn();
    };

    this.retry.wait = this.retry.interval * Math.pow(2, this.retry.retries);
    setTimeout(tryReconn, this.retry.wait);
};

/**
 * set keep alive
 * @param {...} arguments
 */
ISocket.prototype.setKeepAlive = function(/** ... */) {
    this.socket.setKeepAlive.apply(this.socket, arguments);
};

/**
 * _onData
 * @param {Buffer} buf the buffer received
 */
ISocket.prototype._onData = function(buf) {
    var event, data, parsed;

    if(this.$buf) {
        buf = Buffer.concat([ this.$buff, buf ], this.$buf.length + buf.length);
    }

    var msg = this.$msg || {};

    while(buf.length > 0) {
        // not finish yet, it will return and wait for next buffer
        if(!helper.parseBuffer(buf, msg)) {
            this.$buff = buf;
            this.$msg = msg;
            return;
        }

        try {
            parsed = msgpack.unpack(msg.data);
            if([ "error", "reply" ].indexOf(parsed[1]) >= 0) {
                event = String(parsed.shift());
                data = parsed;
            } else {
                data = parsed.pop();
                event = parsed;
            }
        } catch(err) {
            // Don't do anything, assume that the message was only partially
            // received
        }

        this.emit([ "data" ].concat(event), data);

        buf = buf.slice(msg._offset);
        msg = {};
    }

    this.$buff = null;
    this.$msg = null;
};

/**
 * setup event listeners
 */
ISocket.prototype._setup = function() {
    var self = this;

    // Event: new connection connected
    this.socket.on("connect", function() {
        self.emit("start");
    });

    // Event: closed
    this.socket.on("close", function(hadError) {
        self.connected = false;
        self.$buff = null;
        self.$msg = null;

        if(hadError) {
            self.emit("close", hadError, arguments[1]);
        } else {
            self.emit("close");
        }

        if(self.socket && self.$reconnect) self.reconnect();
    });

    // Event: data received
    this.socket.on("data", this._onData.bind(this));

    var onError = function(error) {
        self.connected = false;
        self.$buff = null;
        self.$msg = null;

        !this.$reconnect ?
            self.emit("error", error || new Error("Unknown error occurred in ISocket.")) :
            self.reconnect();
    };

    if(this.socket.socket) {
        // Event: error occurred
        this.socket.on("error", onError);
    }

    // Event: error occurred
    this.socket.on("error", onError);

    // Event: timeout
    this.socket.on("timeout", function() {
        self.emit("idle");
        if(self.$timeout) self.socket.setTimeout(self.$timeout);
    });
};

module.exports = ISocket;

