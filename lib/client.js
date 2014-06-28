var EventEmitter = require('events').EventEmitter;
var assert = require('assert');
var _ = require('underscore');

var MAX_MSGID = Math.pow(2, 31) - 1;

function Client(conn) {
    this.timeout = 5000;
    this._conn = conn;
    this._handlers = {};
    this.msgid = 0;

    var self = this;
    this._conn.addListener('response', function(res) {
        var handler = self._handlers[res[0]];
        if (handler) {
            if (res[1] === 'reply')
                handler.call(self, null, res[2]);
            else
                handler.call(self, res[2]);
            delete self._handlers[res[0]];
        }
    });
}

/**
 * @param {String} name => module.method
 */
Client.prototype.call = function(name, params, callback) {
    var params = Array.prototype.slice.call(arguments);
    var mm = params.length ? params.shift() : null;
    assert(mm && ~mm.indexOf('.'), 'name should be module.method');
    var i = mm.indexOf('.');
    var module = mm.substring(0, i);
    var method = mm.substring(i + 1, mm.length);
    var callback = (params.length
                    && typeof params[params.length - 1] === 'function') ?
        params.pop() : null;
    assert(_.isFunction(callback), 'no callback');

    var msgid = this._nextMessageId();
    var req = [msgid, 'call', 'Elixir.' + module, method, params];
    this._handlers[msgid] = callback;

    var self = this;
    setTimeout(function() {
        var handler = self._handlers[msgid];
        if (handler) {
            handler.call(self, new Error('time out'));
            delete self._handlers[msgid];
        }
    }, this.timeout);

    this._conn.send(req);
}

Client.prototype._nextMessageId = function _nextMessageId() {
    if (++this.msgid >= MAX_MSGID)
        this.msgid = 1;

    return (this.msgid);
};

module.exports = Client;
