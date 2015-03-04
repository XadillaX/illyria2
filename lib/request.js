/**
 * XadillaX created at 2015-03-04 15:07:09
 *
 * Copyright (c) 2015 Huaban.com, all rights
 * reserved
 */
/**
 * Request
 * @param {ISocket} socket the socket object
 * @param {Object} params the parameters
 * @constructor
 */
var Request = function(socket, params) {
    this.socket = socket;
    this._params = params;
};

/**
 * get parameters
 * @return {*}
 */
Request.prototype.params = function() {
    return this._params;
};

/**
 * get one certain parameter
 * @param {String} name the key name
 * @param {*} [defaultValue] the default value for this key name
 * @return {*}
 */
Request.prototype.param = function(name, defaultValue) {
    var _params = this._params || {};
    if(_params[name] && _params.hasOwnProperty(name)) {
        return _params[name];
    }

    return defaultValue;
};

module.exports = Request;

