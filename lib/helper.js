/**
 * XadillaX created at 2015-03-03 16:09:20
 *
 * Copyright (c) 2015 Huaban.com, all rights
 * reserved
 */
var net = require("net");

exports.emptyFunc = function() {};

/**
 * parse buffer
 * @param {Buffer} buff the original buffer
 * @param {Object} msg the message object
 * @return {Boolean} whether the message was parsed
 */
exports.parseBuffer = function(buff, msg) {
    if(buff.length < 4) return false;

    msg._offset = msg._offset || 0;

    if(0 === msg._offset) {
        msg.length = buff.readUInt32BE(msg._offset, true);
        msg._offset = 4;
    }

    var remain = msg._offset + msg.length;
    if(buff.length < remain) return false;

    msg.data = buff.slice(msg._offset, remain);
    msg._offset += msg.length;

    return true;
};

/**
 * create a original server
 * @param {Object} options the options
 * @param {Function} connectionListener the listener function
 * @return {Server} the server
 */
exports.createServer = function(options, connectionListener) {
    if(!connectionListener && typeof options === "function") {
        connectionListener = options;
        options = {};
    }

    var ISocket = require("./isocket");
    return net.createServer(options, function(socket) {
        options.reconnect = false;
        options.connected = true;
        connectionListener(new ISocket(socket, options));
    });
};

