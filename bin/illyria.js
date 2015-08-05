#! /usr/bin/env node
/**
 * XadillaX created at 2015-08-05 14:14:18 With ♥
 *
 * Copyright (c) 2015 Huaban.com, all rights
 * reserved.
 */
var opts = require("nomnom").script("illyria").option("host", {
    abbr: "o",
    default: "127.0.0.1",
    help: "the server host"
}).option("port", {
    abbr: "p",
    default: 3721,
    help: "the server port"
}).option("module", {
    abbr: "m",
    required: true,
    help: "the send module"
}).option("function", {
    abbr: "f",
    required: true,
    help: "the send function"
}).option("data", {
    abbr: "d",
    default: "{}",
    help: "the send data"
}).option("runTimeout", {
    abbr: "t",
    default: 10000,
    help: "the run timeout"
}).option("version", {
    abbr: "v",
    help: "show the version of illyria",
    flag: true,
    callback: function() {
        var pkg = require("../package");
        return "illyria v" + pkg.version;
    }
}).parse();

var Illyria = require("../");
var TermColor = require("term-color");

var client = Illyria.createClient(opts.host, opts.port);
client.connect(function() {
    var data;
    try {
        data = JSON.parse(opts.data);
    } catch(e) {
        data = opts.data;
    }

    client.send(opts.module, opts.function, data, function(err, data) {
        if(err) {
            console.error(TermColor.red("Failed!"));
            console.error(err.message);
            process.exit(4);
        } else {
            console.log(TermColor.green("Succeeded!"));
            console.log(data);
            process.exit(0);
        }
    });
});
