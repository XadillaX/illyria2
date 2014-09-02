/**
 * Illyria request
 * @param socket
 * @param params
 * @constructor
 */
var Request = function (socket, params) {
    this.socket = socket;
    this._params = params;
};

/**
 * returns params
 * @returns {*}
 */
Request.prototype.params = function() {
    return this._params;
};

/**
 * get value of a certain param
 * @param name
 * @param defaultValue
 * @returns {*}
 */
Request.prototype.param = function(name, defaultValue) {
    var _params = this._params || {};
    if (null != _params[name] && _params.hasOwnProperty(name)) return _params[name];
    return defaultValue;
};

module.exports = Request;
