/**
 * XadillaX created at 2015-03-04 15:11:27
 *
 * Copyright (c) 2015 Huaban.com, all rights
 * reserved
 */
/**
 * Response
 * @param {ISocket} socket the socket object
 * @param {Number} msgId the message id
 * @constructor
 */
var Response = function(socket, msgId) {
    this.socket = socket;
    this.msgId = msgId;
};

/**
 * send a JSON response
 * @param {Object} data the json object
 */
Response.prototype.json = function(data) {
    if(typeof data !== "object") {
        return console.error("Since data is not JSON object, use Response::send() instead.");
    }

    if(data.hasOwnProperty("status") && !data.status) {
        this.error(data.msg);
    } else if(data.hasOwnProperty("err") && data.err) {
        this.error(data.err);
    } else if(data.hasOwnProperty("error") && data.error) {
        this.error(data.error);
    } else {
        this.send(data);
    }
};

/**
 * send a message
 * @param {*} data the data
 */
Response.prototype.send = function(data) {
    this.socket.success([ this.msgId ], data);
};

/**
 * send an error
 * @param {*} err the error
 */
Response.prototype.error = function(err) {
    this.socket.error([ this.msgId ], err);
};

module.exports = Response;
