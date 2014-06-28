var net = require('net')
, util = require('util');

var Connection = require('./connection');

function Server() {
    net.Server.call(this);
    this._services = [];

    var self = this;
    this.addListener('connection', function(socket) {
        var conn = new Connection(socket);

        self._services.forEach(function(service) {
            conn.expose(service.name, service.service);
        });
    });
}

util.inherits(Server, net.Server);

Server.prototype.expose = function(name, service) {
    this._services.push({ name: name, service: service});
};

module.exports = Server;
