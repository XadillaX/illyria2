var Zookeeper = require('../lib/zookeeper');

var zookeeper = new Zookeeper('192.168.3.26:2503');

setTimeout(function() {
    zookeeper.updateClientNum(10, function(err, stat) {
        console.log('update successfully!');
        setTimeout(function() {
            zookeeper.close();
        }, 10000);
    });
}, 1000);

//var zookeeper = require('node-zookeeper-client');
//var CreateMode = zookeeper.CreateMode;
//
//var client = zookeeper.createClient('192.168.3.26:2503');
//
//client.once('connected', function() {
//    console.log('connect successfully!');
//    client.mkdirp('/vital_moose', function(err, path) {
//        client.create('/vital_moose/t', CreateMode.EPHEMERAL_SEQUENTIAL, function (err, path) {
//            console.log('create ephemeral node', err, path);
//            setTimeout(function () {
//                client.close();
//            }, 10000);
//        });
//    });
//});
//
//client.connect();