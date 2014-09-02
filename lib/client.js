var nssocket = require('./nssocket');
var events = require('events');
var util = require('util');

const MAX_MSG_ID = 2147483647;
var slice = Function.prototype.call.bind(Array.prototype.slice);

/**
 * Illyria Client
 * @param options
 * @constructor
 */
function Client(options) {
    events.EventEmitter.call(this);

    if (!this._socket) {
        this._socket = new nssocket.NsSocket(options);
    }

    this._port = Number(options.port || 6789);
    this._host = options.host || '127.0.0.1';
    this._runTimeout = Number(options.runTimeout || 10000);
    this._msgid = 0;
    this._socket.addListener('error', this.emit.bind(this, 'error'));
    this._socket.addListener('close', this.emit.bind(this, 'close'));
}

util.inherits(Client, events.EventEmitter);

/**
 * connect to a server
 * @param cb
 */
Client.prototype.connect = function(cb) {
    this._socket.connect(this._port, this._host, cb);
};

/**
 * send a request to server
 * @param module
 * @param method
 * @param params
 * @param callback
 */
Client.prototype.rpc = function(module, method, params, callback) {
    function onData() {
        if (timer) {
            clearTimeout(timer);
        }

        var args = slice(arguments);
        var data = args.length === 1 ? args[0] : [];
        if (data.length !== 2) {
            return callback('invalid return data');
        }
        var type = data.shift();
        if (type === 'reply')
            return callback(null, data.shift());
        else if (type === 'error') {
            var err = data.shift();
            return callback(new Error(err.message || err));
        }
        else
            return callback(new Error('unknown type'));
    }

    var self = this;
    var msg_id = self._nextMessageId();

    var timer = setTimeout(function() {
        self._socket.undata([msg_id], onData);
        return callback(new Error('timeout'));
    }, self._runTimeout);

    self._socket.rpc(
        [msg_id, 'call', module, method],
        params
    );
    self._socket.dataOnce([msg_id], onData);
};

/**
 * Close socket
 */
Client.prototype.close = function() {
    this._socket.end();
    this._socket.destroy();
};

/**
 * generate next message id
 * @returns {string}
 * @private
 */
Client.prototype._nextMessageId = function() {
    if (++this._msgid >= MAX_MSG_ID)
        this._msgid = 1;
    return String(this._msgid);
};

module.exports = {
    Client      : Client,
    createClient: function(options) {
        var opts = options || {};
        opts.host = opts.host || '127.0.0.1';
        opts.port = Number(opts.port || 6785);
        opts.delimiter = opts.delimiter || '.';
        opts.runTimeout = Number(opts.runTimeout || 1000);
        return new Client(opts);
    }
};
