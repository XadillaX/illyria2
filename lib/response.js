/**
 * Illyria Response
 * @param socket
 * @param msg_id
 * @constructor
 */
var Response = function(socket, msg_id) {
    this._socket = socket;
    this._msg_id = msg_id;
};

/**
 * send a JSON object
 * @param data
 */
Response.prototype.json = function json(data) {
    if(typeof data !== 'object') {
        console.error('since data is not JSON object, Use Response.send() instead');
    }

    if('err' in data)
        this.error(data['err']);
    else
        this.send(data);
};

/**
 * send data
 * @param data
 */
Response.prototype.send = function send(data) {
    this._socket.success([this._msg_id], data);
};

/**
 * occur an error
 * @param err
 */
Response.prototype.error = function error(err) {
    this._socket.error([this._msg_id], err);
};

module.exports = Response;
