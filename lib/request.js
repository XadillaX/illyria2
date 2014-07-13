var Request = function (socket, params) {
    this.socket = socket;
    this._params = params;
};

Request.prototype.params = function() {
    return this._params;
};

Request.prototype.param = function(name, defaultValue) {
    var _params = this._params || {};
    if (null != _params[name] && _params.hasOwnProperty(name)) return _params[name];
    return defaultValue;
};

module.exports = Request;