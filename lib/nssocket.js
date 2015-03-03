/**
 * nssocket.js - Wraps a TLS/TCP socket to emit namespace events also auto-buffers.
 *
 * (C) 2011, Nodejitsu Inc.
 *
 * Edit by piaolingxue && XadillaX
 */
var net = require('net');
var util = require('util');
var events2 = require('eventemitter2');
var msgpack = require('msgpack');

/**
 * Namespace socket, NsSocket, is a thin wrapper above TCP.
 * It provides automatic buffering and name space based data emits.
 * @param {Object} socket TCP socket either from a `connect` `new` or from a server
 * @param {Object} options Options for this NsSocket
 * @constructor
 */
var NsSocket = exports.NsSocket = function(socket, options) {
    if(!(this instanceof NsSocket)) {
        return new NsSocket(socket, options);
    }

    // If there is no Socket instnace to wrap,
    // create one.
    if(!options) {
        options = socket;
        socket = new net.Socket(options);
    }

    options = options || {};

    // Setup underlying socket state.
    this.socket = socket;
    this.connected = options.connected || socket.writable && socket.readable || false;

    // Setup reconnect options.
    this._reconnect = options.reconnect || false;
    this.retry = {
        retries: 0,
        max: options.maxRetries || 10,
        interval: options.retryInterval || 5000,
        wait: options.retryInterval || 5000
    };

    this._msg = null;
    this._buf = null;

    // Setup default instance variables.
    this._options = options;
    this._delimiter = options.delimiter || '::';

    events2.EventEmitter2.call(this, {
        delimiter: this._delimiter,
        wildcard: true,
        maxListeners: options.maxListeners || 10
    });

    this._setup();
};

// Inherit from `events2.EventEmitter2`.
util.inherits(NsSocket, events2.EventEmitter2);

/**
 * Creates a new TCP server which wraps every incoming connection
 * in an instance of `NsSocket`.
 * @param {Object} [options]
 * @param {Function} connectionListener
 */
exports.createServer = function createServer(options, connectionListener) {
    if(!connectionListener && typeof options === 'function') {
        connectionListener = options;
        options = {};
    }

    options.delimiter = options.delimiter || '::';

    function onConnection(socket) {
        // Incoming socket connections cannot reconnect
        // by definition.
        options.reconnect = false;
        connectionListener(new NsSocket(socket, options));
    }

    return net.createServer(options, onConnection);
};

/**
 * Send a RPC message to the remote.
 * @param {Array} event The event names chain, like [ msgId, module, method, ... ]
 * @param {Object} params The params
 * @param {Function} callback the callback function
 */
NsSocket.prototype.rpc = function send(event, params, callback) {
    // if we aren't connected/socketed, then error
    if(!this.socket || !this.connected) {
        return this.emit('error', new Error('NsSocket: sending on a bad socket'));
    }

    event.push(params);
    var message = msgpack.pack(event);
    var len = new Buffer(4);
    len.writeUInt32BE(message.length, 0, true);
    this.socket.write(Buffer.concat([ len, message ], message.length + 4), callback);
};

/**
 * Send success message
 * @param {Array} event Only contains one element indicates the message id
 * @param {Object} data The data to be sent
 * @param {Function} callback the callback function
 */
NsSocket.prototype.success = function success(event, data, callback) {
    // if we aren't connected/socketed, then error
    if(!this.socket || !this.connected) {
        return this.emit('error', new Error('NsSocket: sending on a bad socket'));
    }

    var message = event.concat(['reply', data]);
    message = msgpack.pack(message);
    var len = new Buffer(4);
    len.writeUInt32BE(message.length, 0, true);
    this.socket.write(Buffer.concat([len, message], message.length + 4), callback);
};

/**
 * Send error message
 * @param {Array} event Only contains one element indicates the message id
 * @param {Object} error The error to be sent
 * @param {Function} callback the callback function
 */
NsSocket.prototype.error = function error(event, error, callback) {
    // if we aren't connected/socketed, then error
    if(!this.socket || !this.connected) {
        return this.emit('error', new Error('NsSocket: sending on a bad socket'));
    }

    var message = event.concat(['error', error]);
    message = msgpack.pack(message);
    var len = new Buffer(4);
    len.writeUInt32BE(message.length, 0, true);
    this.socket.write(Buffer.concat([len, message], message.length + 4), callback);
};

/**
 * Add callback function for event
 *
 * @param {Array} event The event
 * @param {Function} callback The callback function be called after event is done
 */
NsSocket.prototype.data = function(event, callback) {
    this.on(['data'].concat(event), callback);
};

/**
 * Remove a callback function for event
 * @param {Array} event The event
 * @param {Function} listener The callback function will be removed
 */
NsSocket.prototype.undata = function(event, listener) {
    this.off(['data'].concat(event), listener);
};

/**
 * Add callback function for event for once
 * @param {Array} event the event
 * @param {Function} callback The callback function be called once after event is done
 */
NsSocket.prototype.dataOnce = function(event, callback) {
    this.once(['data'].concat(event), callback);
};

/**
 * Set the idle/timeout timer
 * @param {Integer} time how often to emit idle
 * @return {undefined}
 */
NsSocket.prototype.setIdle = function setIdle(time) {
    this.socket.setTimeout(time);
    this._timeout = time;
};

/**
 * Forcibly destroys this socket, unregister socket, remove all callbacks
 */
NsSocket.prototype.destroy = function destroy() {
    // this should be forcibly remove EVERY listener
    this.removeAllListeners();

    if(this.socket) {
        try {
            this.socket.end(); // send FIN
            this.socket.destroy(); // make sure fd's are gone
        } catch(ex) {
            // do nothing on errors
        }
    }

    // clear buffer
    this.data = '';
    this.emit('destroy');
};

/**
 * Closes the underlying socket, recommend you call destroy after
 */
NsSocket.prototype.end = function end() {
    var hadErr;
    this.connected = false;

    if(this.socket) {
        try {
            this.socket.end();
        } catch(ex) {
            this.emit('error', ex);
            hadErr = true;
            return;
        }

        this.socket = null;
    }

    return this.emit('close', hadErr || undefined);
};

/**
 * A passthrough to the underlying socket's connect function
 * @param {String} host The host string
 * @param {Number} port The port number
 * @param {Function} callbak The callback function
 */
NsSocket.prototype.connect = function connect() {
    var args = Array.prototype.slice.call(arguments);
    var self = this;
    var callback;
    var host;
    var port;

    args.forEach(function handle(arg) {
        var type = typeof arg;
        switch(type) {
            case 'number':
                port = arg;
                break;
            case 'string':
                host = arg;
                break;
            case 'function':
                callback = arg;
                break;
            default:
                self.emit('error', new Error('bad argument to connect'));
                break;
        }
    });

    host = host || '127.0.0.1';
    this.port = port || this.port;
    this.host = host || this.host;
    args = this.port ? [this.port, this.host] : [this.host];

    if(callback) {
        args.push(callback);
    }

    var errHandlers = self.listeners('error');

    if(errHandlers.length > 0) {
        // copy the last error from nssocker onto the error event.
        self.socket._events.error = errHandlers[errHandlers.length - 1];
    }

    this.connected = true;
    this.socket.connect.apply(this.socket, args);
};

/**
 * Attempts to reconnect the current socket on `close` or `error`.
 * This instance will attempt to reconnect until `this.retry.max` is reached,
 * with an interval increasing by powers of 10.
 */
NsSocket.prototype.reconnect = function reconnect() {
    var self = this;

    // Helper function containing the core reconnect logic
    function doReconnect() {
        // Cleanup and recreate the socket associated
        // with this instance.
        self.retry.waiting = true;
        self.socket.removeAllListeners();
        self.socket = new net.Socket(self._options);

        // Cleanup reconnect logic once the socket connects
        self.socket.once('connect', function() {
            self.retry.waiting = false;
            self.retry.retries = 0;
        });

        // Attempt to reconnect the socket
        self._setup();
        self.connect();
    }

    // Helper function which attempts to retry if
    // it is less than the maximum
    function tryReconnect() {
        self.retry.retries++;
        if(self.retry.retries >= self.retry.max) {
            return self.emit('error', new Error('Did not reconnect after maximum retries: ' + self.retry.max));
        }

        doReconnect();
    }

    this.retry.wait = this.retry.interval * Math.pow(2, this.retry.retries);
    setTimeout(tryReconnect, this.retry.wait);
};

/**
 * Sets up the underlying socket associate with this instance.
 */
NsSocket.prototype._setup = function() {
    var self = this,
        startName;

    startName = 'connect';

    this.socket.on('data', this._onData.bind(this));

    // create a stub for the setKeepAlive functionality
    this.setKeepAlive = function() {
        self.socket.setKeepAlive.apply(self.socket, arguments);
    };

    // make sure we listen to the underlying socket
    this.socket.on(startName, this._onStart.bind(this));
    this.socket.on('close', this._onClose.bind(this));

    if(this.socket.socket) {
        // otherwise we get a error passed from net.js
        // they need to backport the fix from v5 to v4
        this.socket.socket.on('error', this._onError.bind(this));
    }

    this.socket.on('error', this._onError.bind(this));
    this.socket.on('timeout', this._onIdle.bind(this));
};

/**
 * Emits a start event when the underlying socket finish connecting
 * might be used to do other activities.
 * @private
 */
NsSocket.prototype._onStart = function _onStart() {
    this.emit('start');
};

function parseBuffer(buf, msg) {
    if(buf.length < 4)
        return false;

    msg._offset = msg._offset || 0;
    if(msg._offset === 0) {
        msg.length = buf.readUInt32BE(msg._offset, true);
        msg._offset += 4;
    }

    var remain = msg._offset + msg.length;
    if(buf.length < remain)
        return false;

    msg.data = buf.slice(msg._offset, remain);
    msg._offset += msg.length;
    return true;
}

/**
 * Messages are assumed to be delimited properly (if using nssocket to send)
 * otherwise the delimiter should exist at the end of every message
 * We assume messages arrive in order.
 * @private
 * @param {String} buf literal message from the data event of the socket
 */
NsSocket.prototype._onData = function _onData(buf) {
    var parsed;
    var event;
    var data;

    if(this._buf) {
        var len = this._buf.length + buf.length;
        buf = Buffer.concat([this._buf, buf], len);
    }

    var msg = this._msg || {};

    while(buf.length > 0) {
        if(!parseBuffer(buf, msg)) {
            this._buf = buf;
            this._msg = msg;
            return;
        }

        try {
            parsed = msgpack.unpack(msg.data);
            if(~['error', 'reply'].indexOf(parsed[1])) {
                event = String(parsed.shift());
                data = parsed;
            } else {
                data = parsed.pop();
                event = parsed;
            }
        } catch(err) {
            // Don't do anything, assume that the message is only partially
            // received.
        }
        this.emit(['data'].concat(event), data);

        buf = buf.slice(msg._offset);
        msg = {};
    }

    this._buf = null;
    this._msg = null;
};

/**
 * _onClose
 * @private
 * @param {Boolean} hadError true if there was an error, which then include the
 *                  actual error included by the underlying socket
 */
NsSocket.prototype._onClose = function _onClose(hadError) {
    if(hadError) {
        this.emit('close', hadError, arguments[1]);
    } else {
        this.emit('close');
    }

    this.connected = false;
    this._buf = null;
    this._msg = null;

    if(this._reconnect) {
        this.reconnect();
    }
};

/**
 * Error event is raise with an error if there was one
 * @private
 * @param {Error} error emits and error event in place of the socket
 */
NsSocket.prototype._onError = function _onError(error) {
    this.connected = false;
    this._buf = null;
    this._msg = null;

    if(!this._reconnect) {
        return this.emit('error', error || new Error('An Unknown Error occured'));
    }

    this.reconnect();
};

/**
 * Emits the idle event (based on timeout)
 * @private
 */
NsSocket.prototype._onIdle = function _onIdle() {
    this.emit('idle');
    if(this._timeout) {
        this.socket.setTimeout(this._timeout);
    }
};

