var Request = function (socket, params) {
    this._socket = socket;
    this._params = params;
};

Request.prototype.params = function() {
    return this._params;
};

Request.prototype.param = function(name, defaultValue) {
    if (typeof this._params !== 'object') {
        return defaultValue;
    }

    return this.params[name] || defaultValue;
};

module.exports = Request;