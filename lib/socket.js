var once = require('once');
var dns = require('dns');
var net = require('net');
var util = require('util');
var WError = require('verror').WError;

var IP_RE = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

function ConnectionTimeoutError(time) {
    WError.call(this, 'failed to establish connection after %dms', time);
}
util.inherits(ConnectionTimeoutError, WError);
ConnectionTimeoutError.prototype.name = 'ConnectionTimeoutError';

function DNSError(err, host) {
    WError.call(this, err, host + ' could not be found in DNS');
}
util.inherits(DNSError, WError);
DNSError.prototype.name = 'DNSError';

function clone(obj) {
    if (!obj) {
        return (obj);
    }
    var copy = {};
    Object.keys(obj).forEach(function (k) {
        copy[k] = obj[k];
    });
    return copy;
}

function shuffle(array) {
    var current;
    var tmp;
    var top = array.length;

    if (top) {
        while (--top) {
            current = Math.floor(Math.random() * (top + 1));
            tmp = array[current];
            array[current] = array[top];
            array[top] = tmp;
        }
    }

    return array;
}

createSocket = function(options, cb) {
    // if cb has been called once, just return the old value
    cb = once(cb);

    function _socket() {
        var c = net.connect(options);
        var to = options.connectTimeout || 0;
        c.setTimeout(to);

        c.once('connect', function onConnect() {
            c.setTimeout(0);
            c.removeAllListeners('error');
            c.removeAllListeners('timeout');
            cb(null, c);
        });

        c.once('error', function onError(err) {
            c.removeAllListeners('connect');
            c.removeAllListeners('timeout');
            cb(err);
        });

        c.once('timeout', function onTimeout() {
            c.removeAllListeners('connect');
            c.removeAllListeners('error');
            c.destroy();
            cb(new ConnectionTimeoutError(to));
        });
    }

    if (IP_RE.test(options.host)) {
        _socket();
    } else if (options.host === 'localhost' || options.host === '::1') {
        options.host = '127.0.0.1';
    } else {
        dns.resolve4(options.host, function (err, addrs) {
            if (err) {
                cb(new DNSError(err, options.host));
                return;
            } else if (!addrs || addrs.length === 0) {
                cb(new DNSError(options.host));
                return;
            }

            options = clone(options);
            options.host = shuffle(addrs).pop();
            _socket();
        });
    }
};

module.exports = {
    createSocket: createSocket
};
