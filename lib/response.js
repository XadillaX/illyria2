var Response = function(socket, msg_id) {
    this._socket = socket;
    this._msg_id = msg_id;
};

Response.prototype.json = function json(data) {
    if (typeof data !== 'object') {
        console.error('since data is not JSON object, Use Response.send() instead')
    }
    this._socket.success([this._msg_id], data);
};

Response.prototype.send = function send(data) {
    this._socket.success([this._msg_id], data);
};

Response.prototype.error = function error(err) {
    this._socket.error([this._msg_id], err);
};

module.exports = Response;
