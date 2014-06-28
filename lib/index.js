var net = require('net');
var Connection = require('./connection');

module.exports = {
    createConnection: function() {
        return new Connection();
    }
};
