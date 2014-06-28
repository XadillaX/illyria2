var net = require('net')
,util = require('util');

var _ = require('underscore')
, assert = require('assert-plus');

var EventEmitter = require('events').EventEmitter;

var Client = require('./client');

var msgpack = require('msgpack');

function Connection(socket) {
    var self = this;

    EventEmitter.call(this);
    this._methods = {};
    this._socket = socket || new net.Socket();
    this._socket.addListener('connect', function() {
        console.log('connect successfully!');
        var client = new Client(self);
        self.emit('connect', client);
    });
    this._socket.addListener('data', function(data) {
        var obj = msgpack.unpack(data);
        if (_.isArray(obj) && obj.length >= 2) {
            var status = obj[1];
            if (status === 'reply' || status === 'error') {
                self.emit('response', obj);
            }
            else if (!_.isNull(obj[0])) {
                self.emit('request', obj);
                self._handleRequest(obj, true);
            }
            else {
                self.emit('notification', obj);
                self._handleRequest(obj, true);
            }
        }
        else {
            self.emit('notification', obj);
            self._handleRequest(obj, false);
        }
    });

    this._socket.addListener('end', this.emit.bind(this, 'end'));
    this._socket.addListener('timeout', this.emit.bind(this, 'timeout'));
    this._socket.addListener('drain', this.emit.bind(this, 'drain'));
    this._socket.addListener('error', this.emit.bind(this, 'error'));
    this._socket.addListener('close', this.emit.bind(this, 'close'));
}


util.inherits(Connection, EventEmitter);

Connection.prototype.connect = function(port, host, callback) {
    if (_.isFunction(host)) {
        callback = host;
        host = null;
    }

    if (callback) {
        console.log('add listener');
        this.addListener('connect', callback);
    }
    this._socket.connect(port, host);
};

Connection.prototype.send = function(obj) {
    this._socket.write(msgpack.pack(obj));
};

Connection.prototype.end = function() {
    this._socket.end();
};

Connection.prototype.expose = function(module, service) {
    assert.string(module, 'module should not be empty');
    assert.object(service, 'service should be object');

    for (var method in service) {
        if (_.isFunction(service[method])) {
            this._methods[module + '.' + method] = service[method];
        }
    }
    console.log(this._methods);
};

Connection.prototype._handleRequest = function(req, is_array) {
    var self = this;

    function result(err, res) {
        var msgid = req[0];
        if (msgid !== null) {
            if (err) {
                return self.send([msgid, 'error', err.message]);
            }
            self.send([msgid, 'reply', res]);
        }
    }

    if (is_array && req.length > 4) {
        console.log(req);
        var module = req[2].split('.')[1];
        var method = self._methods[module + '.' + req[3]];
        if (_.isFunction(method)) {
            var params = req[4] || [];

            params.push(result);

            console.log('params:', params);
            console.log('method:', method);

            try {
                method.apply(this, params);
            } catch (err) {
                result(err);
            }
        } else {
            result(new Error('unknown method'))
        }
    } else {
        result(new Error('unknown message'));
    }
};

module.exports = Connection;
