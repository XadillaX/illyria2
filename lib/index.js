module.exports = {};

/**
 * re-export the modules
 * @param {String} name the module path
 */
function reexport(name) {
    var obj = require(name);
    Object.keys(obj).forEach(function (k) {
        module.exports[k] = obj[k];
    });
}

reexport('./client');
reexport('./server');

