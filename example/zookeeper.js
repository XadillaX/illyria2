/**
 * XadillaX created at 2014-09-02 14:08
 *
 * Copyright (c) 2014 Huaban.com, all rights
 * reserved.
 */
var Zookeeper = require("../lib/illyria-zk");

var zookeeper = new Zookeeper("192.168.16.231:2181");
zookeeper.setServerInformation("localhost", 4444);
zookeeper.connect(function(err, path) {
    console.log("connected: " + path);

    setInterval(function() {
        console.log("fake connected.");
        zookeeper.clientConnected();
    }, 1000);
});

process.on('SIGINT', function() {
    zookeeper.disconnect(function() {
        process.exit(0);
    });
});
