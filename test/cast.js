/**
 * XadillaX created at 2015-07-09 11:29:13 With ♥
 *
 * Copyright (c) 2015 Huaban.com, all rights
 * reserved.
 */
var should = require("should");
var async = require("async");
var illyria = require("../");

describe("cast", function() {
    var SERVER_PORT = 18276;
    var server, client;

    function init(callback) {
        async.waterfall([
            function(callback) {
                if(server) {
                    server.close(callback);
                } else callback();
            }
        ], function() {
            server = illyria.createServer({
                port: SERVER_PORT
            });
            callback();
        });
    }

    function startup(callback) {
        server.listen(function() {
            client = illyria.createClient("127.0.0.1", SERVER_PORT, {
                runTimeout: 1000,
                retryInterval: 1000,
                reconnect: true
            });

            client.connect(function() {
                callback();
            });
        });
    }

    describe("#test 1", function() {
        before(function(done) {
            init(function() {
                server.expose({
                    name: "test",
                    methods: {
                        echo: function(req, resp) {
                            req.params().should.be.eql("illyria");
                            resp.send("illyria");
                        },

                        json: function(req, resp) {
                            req.param("json").should.be.eql(true);
                            req.params().should.be.eql({ json: true });
                            resp.send(req.params());
                        },

                        error: function(req, resp) {
                            resp.json({ err: "test error" });
                        },

                        cut: function(req/**, resp*/) {
                            req.socket.end();
                            req.socket.destroy();
                        },

                        eecho: function(req, resp) {
                            resp.send(req.params());
                        }
                    }
                });

                startup(done);
            });
        });

        it("should cast", function(done) {
            client.cast("test", "echo", "illyria", function(err, data) {
                if(err) {
                    err.should.be.eql(undefined);
                }

                should(data).be.eql(undefined);
                done();
            });
        });
    });
});
