/**
 * XadillaX created at 2015-03-17 14:13:43
 *
 * Copyright (c) 2015 Huaban.com, all rights
 * reserved
 */
var should = require("should");
var async = require("async");
var illyria = require("../");
var _zookeeper = require("node-zookeeper-client");

describe("server zookeeper", function() {
    var SERVER_PORT = 7381, SERVER_HOST = "127.0.0.1";
    var ZOOKEEPER_OPTIONS = {
        connectString: [ "127.0.0.1:2181" ],
        prefix: "HB_",
        root: "illyria",

        _path: "/illyria/HB_"
    };

    var server;
    var zookeeperClient;

    function init(callback) {
        async.waterfall([
            function(callback) {
                if(server) {
                    server.close(callback);
                } else callback();
            },

            function(callback) {
                if(zookeeperClient) {
                    zookeeperClient.close();
                    zookeeperClient = undefined;
                }

                zookeeperClient = _zookeeper.createClient(ZOOKEEPER_OPTIONS.connectString[0]);
                zookeeperClient.connect();
                zookeeperClient.once("connected", function() {
                    callback();
                });
            }
        ], function() {
            server = illyria.createServer({
                host: SERVER_HOST,
                port: SERVER_PORT
            }, ZOOKEEPER_OPTIONS);
            callback();
        });
    }

    function startup(callback) {
        server.listen(callback);
    }

    describe("base information", function() {
        before(function(done) {
            init(function() {
                startup(done);
            });
        });

        it("path should match /#{root}/#{prefix}#{ai_id}", function(done) {
           server.zookeeper.path.should.startWith(ZOOKEEPER_OPTIONS._path);
           done();
        });

        it("should have correct information in zookeeper node", function(done) {
            var path = server.zookeeper.path;
            zookeeperClient.getData(path, function(err, data/**, stat*/) {
                should(err).be.empty;

                data = data.toString().split(",");
                data[0].should.be.eql(SERVER_HOST);
                data[1].should.be.eql(SERVER_PORT.toString());
                data[2].should.be.eql("0");
                done();
            });
        });
    });

    describe("client information", function() {
        var clients = [];

        before(function(done) {
            init(function() {
                startup(done);
            });
        });

        it("should add a client", function(done) {
            var client = illyria.createClient(SERVER_HOST, SERVER_PORT);
            var path = server.zookeeper.path;

            client.connect(function() {
                setTimeout(function() {
                    zookeeperClient.getData(path, function(err, data) {
                        should(err).be.empty;

                        data = data.toString().split(",");
                        data[0].should.be.eql(SERVER_HOST);
                        data[1].should.be.eql(SERVER_PORT.toString());
                        data[2].should.be.eql("1");
                        done();
                    });
                }, 100);
            });

            client.on("error", function(err) {
                should(err).be.empty;
            });

            clients.push(client);
        });

        it("should add 10 client", function(done) {
            var path = server.zookeeper.path;
            var i = 0;
            async.whilst(
                function() {
                    return i < 10;
                },

                function(callback) {
                    i++;
                    var client = illyria.createClient(SERVER_HOST, SERVER_PORT);
                    client.on("error", function(err) {
                        should(err).be.empty;
                    });
                    client.connect(callback);
                    clients.push(client);
                },
                
                function() {
                    setTimeout(function() {
                        zookeeperClient.getData(path, function(err, data) {
                            should(err).be.empty;

                            data = data.toString().split(",");
                            data[0].should.be.eql(SERVER_HOST);
                            data[1].should.be.eql(SERVER_PORT.toString());
                            data[2].should.be.eql("11");
                            done();
                        });
                    }, 100);
                }
            );
        });

        it("should decrease 5 clients", function(done) {
            var path = server.zookeeper.path;
            while(clients.length > 6) {
                var client = clients.pop();
                client.close();
            }

            setTimeout(function() {
                zookeeperClient.getData(path, function(err, data) {
                    should(err).be.empty;

                    data = data.toString().split(",");
                    data[0].should.be.eql(SERVER_HOST);
                    data[1].should.be.eql(SERVER_PORT.toString());
                    data[2].should.be.eql("6");
                    done();
                });
            }, 100);
        });

        it("should return to 0 client", function(done) {
            var path = server.zookeeper.path;
            while(clients.length) {
                var client = clients.pop();
                client.close();
            }

            setTimeout(function() {
                zookeeperClient.getData(path, function(err, data) {
                    should(err).be.empty;

                    data = data.toString().split(",");
                    data[0].should.be.eql(SERVER_HOST);
                    data[1].should.be.eql(SERVER_PORT.toString());
                    data[2].should.be.eql("0");
                    done();
                });
            }, 100);
        });

        it("should delete node after server shutting down", function(done) {
            var path = server.zookeeper.path;
            server.close(function() {
                setTimeout(function() {
                    zookeeperClient.exists(path, function(err, stat) {
                        should(err).be.empty;
                        should(stat).be.empty;
                        done();
                    });
                }, 100);
            });
        });
    });
});

