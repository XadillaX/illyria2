/**
 * XadillaX created at 2015-03-17 17:16:30
 *
 * Copyright (c) 2015 Huaban.com, all rights
 * reserved
 */
var should = require("should");
var async = require("async");
var illyria = require("../");
var _zookeeper = require("node-zookeeper-client");
var Scarlet = require("scarlet-task");

describe("client zookeeper", function() {
    var SERVER_PORT = 7381, SERVER_HOST = "127.0.0.1";
    var ZOOKEEPER_OPTIONS = {
        connectString: "127.0.0.1:2181",
        prefix: "HB_",
        root: "illyria",

        _path: "/illyria/HB_"
    };
    var SERVER_COUNT = 5;
    var SERVER_MAX_PORT = SERVER_PORT + SERVER_COUNT - 1;

    var clients = [];
    var servers = [];
    var zookeeperClient;

    function init(callback) {
        async.waterfall([
            function(callback) {
                for(var i = 0; i < clients.length; i++) {
                    clients[i].close();
                }
                clients = [];

                if(servers.length) {
                    var i = 0;
                    async.whilst(
                        function() {
                            return i < SERVER_COUNT;
                        },
                        function(callback) {
                            servers[i++].close(callback);
                        },
                        function() {
                            servers = [];
                            callback();
                        }
                    );
                } else callback();
            },

            function(callback) {
                if(zookeeperClient) {
                    zookeeperClient.close();
                    zookeeperClient = undefined;
                }

                zookeeperClient = _zookeeper.createClient(ZOOKEEPER_OPTIONS.connectString);
                zookeeperClient.connect();
                zookeeperClient.once("connected", function() {
                    callback();
                });
            }
        ], function() {
            for(var i = 0; i < SERVER_COUNT; i++) {
                servers.push(illyria.createServer({
                    host: SERVER_HOST,
                    port: SERVER_PORT + i
                }, ZOOKEEPER_OPTIONS));
            }

            callback();
        });
    }

    function startup(callback) {
        async.eachLimit(servers, 10, function(server, callback) {
            server.listen(callback);
        }, function() {
            callback();
        });
    }

    after(function(done) {
        for(var i = 0; i < clients.length; i++) {
            clients[i].close();
        }
        clients = [];

        if(servers.length) {
            var i = 0;
            async.whilst(
                function() {
                    return i < SERVER_COUNT;
                },
                function(callback) {
                    servers[i++].close(callback);
                },
                function() {
                    servers = [];
                    done();
                }
            );
        } else done();
    });

    function getNodesData(callback) {
        var nodes = [];
        async.eachLimit(servers, 10, function(server, callback) {
            var path = server.zookeeper.path;
            zookeeperClient.getData(path, function(err, data) {
                if(err) return callback(err);
                data = data.toString().split(",");
                nodes.push({
                    host: data[0],
                    port: parseInt(data[1]),
                    count: parseInt(data[2])
                });
                callback();
            });
        }, function(err) {
            return callback(err, nodes);
        });
    }

    describe("automitically search server", function() {
        before(function(done) {
            init(function() {
                startup(function() {
                    done();
                });
            });
        });

        it("should connect to a server", function(done) {
            var client = illyria.createClient({
                zookeeper: ZOOKEEPER_OPTIONS
            });

            client.connect(function() {
                setTimeout(function() {
                    getNodesData(function(err, nodes) {
                        should(err).be.empty;
                        client.port.should.within(SERVER_PORT, SERVER_MAX_PORT);
                        for(var i = 0; i < nodes.length; i++) {
                            nodes[i].count.should.be.eql(
                                nodes[i].port === client.port ? 1 : 0);
                        }

                        done();
                    });
                }, 100);
            });

            client.on("error", function(err) {
                should(err).be.empty;
            });

            clients.push(client);
        });

        it("every server should have a client", function(done) {
            var scarlet = new Scarlet(1);

            function _connect(taskObject) {
                var client = taskObject.task;
                client.connect(function() {
                    setTimeout(done, 10);
                });

                client.on("error", function(err) {
                    should(err).be.empty;
                });
            }

            for(var i = 0; i < 4; i++) {
                var client = illyria.createClient({
                    zookeeper: ZOOKEEPER_OPTIONS
                });

                scarlet.push(client, _connect);
                clients.push(client);
            }

            scarlet.afterFinish(4, function() {
                for(var i = 1; i < 5; i++) {
                    clients[i].port.should.within(SERVER_PORT, SERVER_MAX_PORT);
                }

                getNodesData(function(err, nodes) {
                    should(err).be.empty;
                    for(var i = 0; i < nodes.length; i++) {
                        nodes[i].count.should.be.eql(1);
                    }

                    done();
                });
            }, false);
        });

        it("every server should have 6 clients", function(done) {
            var scarlet = new Scarlet(1);

            function _connect(taskObject) {
                var client = taskObject.task;
                client.connect(function() {
                    setTimeout(done, 10);
                });

                client.on("error", function(err) {
                    should(err).be.empty;
                });
            }

            for(var i = 0; i < 25; i++) {
                var client = illyria.createClient({
                    zookeeper: ZOOKEEPER_OPTIONS
                });

                scarlet.push(client, _connect);
                clients.push(client);
            }

            scarlet.afterFinish(25, function() {
                for(var i = 5; i < 30; i++) {
                    clients[i].port.should.within(SERVER_PORT, SERVER_MAX_PORT);
                }

                getNodesData(function(err, nodes) {
                    should(err).be.empty;
                    for(var i = 0; i < nodes.length; i++) {
                        nodes[i].count.should.be.eql(1);
                    }

                    done();
                });
            }, false);
        });
    });
});

