/**
 * XadillaX created at 2015-03-11 13:53:05
 *
 * Copyright (c) 2015 Huaban.com, all rights
 * reserved
 */
require("should");
var async = require("async");
var illyria = require("illyria");
var illyria2 = require("../");

describe("client protocol", function() {
    var SERVER_PORT = 2399;
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
            client = illyria2.createClient("127.0.0.1", SERVER_PORT, {
                runTimeout: 10000,
                retryInterval: 1000,
                reconnect: true
            });

            client.connect(function() {
                callback();
            });

            client.on("error", function(err) {
                console.log(err);
                err.should.be.empty;
            });
        });
    }

    describe("match old server", function() {
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
                        }
                    }
                });

                startup(done);
            });
        });

        it("should received \"echo\"", function(done) {
            client.send("test", "echo", "illyria", function(err, data) {
                if(err) err.should.be.empty;
                data.should.be.eql("illyria");
                done();
            });
        });

        it("should received { json: true }", function(done) {
            client.send("test", "json", { json: true }, function(err, data) {
                if(err) err.should.be.empy;
                data.should.be.eql({ json: true });
                done();
            });
        });

        it("should received error", function(done) {
            client.send("test", "error", {}, function(err) {
                (err instanceof Error).should.be.eql(true);
                err.message.should.be.eql("test error");
                done();
            });
        });
    });
});

