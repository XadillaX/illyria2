var nssocket = require('./nssocket');
var events = require('events');
var util = require('util');

const MAX_MSGID = Math.pow(2, 31) - 1;

var slice = Function.prototype.call.bind(Array.prototype.slice);

util.inherits(Client, events.EventEmitter);
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

Client.prototype.connect = function() {
    this._socket.connect(this._port, this._host);
};

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
        else if (type === 'error')
            return callback(new Error(data.shift()));
        else
            return callback(new Error('unknown type'));
    }

    var self = this;
    var msgid = self._nextMessageId();

    var timer = setTimeout(function() {
        self._socket.undata([msgid], onData);
        return callback(new Error('timeout'));
    }, self._runTimeout);

    self._socket.rpc(
        [msgid, 'call', module, method],
        params
    );
    self._socket.dataOnce([msgid], onData);
};

Client.prototype.close = function() {
    this._socket.end();
    this._socket.destroy();
};

Client.prototype._nextMessageId = function() {
    if (++this._msgid >= MAX_MSGID)
        this._msgid = 1;
    return String(this._msgid);
};

module.exports = {
    createClient: function(options) {
        var opts = options || {};
        opts.host = opts.host || '127.0.0.1';
        opts.port = Number(opts.port || 6785);
        opts.delimiter = opts.delimiter || '.';
        opts.runTimeout = Number(opts.runTimeout || 1000);
        return new Client(opts);
    }
};
