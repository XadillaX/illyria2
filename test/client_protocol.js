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
                runTimeout: 1000,
                retryInterval: 1000,
                reconnect: true
            });

            client.connect(function() {
                callback();
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
                        },

                        cut: function(req/**, resp*/) {
                            req.socket.end();
                            req.socket.destroy();
                        },

                        eecho: function(req, resp) {
                            resp.send(req.params());
                        },

                        date: function(req, resp) {
                            resp.send(req.params());
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

        it("should received { json: null, nosj: 1, sojn: null, osnj: undefined }", function(done) {
            client.send("test", "eecho", { json: 1 / 0, nosj: 1, sojn: null, osnj: undefined }, function(err, data) {
                if(err) err.should.be.empty;
                data.should.be.eql({ json: null, nosj: 1, sojn: null, osnj: null });
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

        it("should received a date string", function(done) {
            client.send("test", "date", { date: new Date(0) }, function(err, data) {
                (!!err).should.be.eql(false);
                data.date.should.be.eql("1970-01-01T00:00:00.000Z");
                done();
            });
        });

        it("should echo the whole body", function(done) {
            var _data = "";
            for(var i = 0; i < 1000000; i++) {
                _data += "a";
            }

            client.send("test", "eecho", _data, function(err, data) {
                if(err) err.should.be.empy;
                data.should.be.eql(_data);
                done();
            });
        });

        it("should reconnect and ok", function(done) {
            client.send("test", "cut", {}, function(err) {
                err.message.indexOf("Timeout").should.not.be.eql(-1);

                setTimeout(function() {
                    client.send("test", "json", { json: true }, function(err, data) {
                        if(err) err.should.be.empy;
                        data.should.be.eql({ json: true });
                        done();
                    });
                }, 500);
            });
        });

        it("should occur error and reconnect", function(done) {
            var errors = [ "manually error", "ISocket: sending on a bad socket." ];
            client.on("error", function(err) {
                if(errors[0] === undefined) return;
                err.message.should.be.eql(errors[0]);
                errors.shift();
            });

            client.socket.socket.emit("error", new Error("manually error"));

            client.send("test", "echo", "illyria", function() {});
            
            setTimeout(function() {
                client.send("test", "echo", "illyria", function(err, data) {
                    if(err) err.should.be.empy;
                    data.should.be.eql("illyria");
                    done();
                });
            }, 1500);
        });

        it("should reconnect after several tries", function(done) {
            this.timeout(100000);

            // var errors = [ "manually error", "ISocket: sending on a bad socket." ];
            server.close();
            server = null;
            client.socket.socket.end();

            var times = 0;
            var reconnectedEmitted = false;
            client.on("error", function(err) {
                if(!process.env.ZK_NO_WARN) console.log(">>>", err.message);
            });
            client.on("tryReconnect", function(after) {
                client.connectStatus().should.be.eql("RECONNECTING");
                if(!process.env.ZK_NO_WARN) console.log("auto reconnect after " + after + "ms.");
                after.should.be.eql(Math.pow(2, times++) * 1000);
            });

            setTimeout(function() {
                init(function() {
                    server.expose({
                        name: "test",
                        methods: {
                            echo: function(req, resp) {
                                req.params().should.be.eql("illyria");
                                resp.send("illyria");
                            }
                        }
                    });

                    var send = function() {
                        client.send("test", "echo", "illyria", function(err, echo) {
                            if(err) {
                                err.message.should.be.eql("Timeout when send and wait for response after 1000ms.");
                                return setTimeout(send, 1000);
                            }

                            client.connectStatus().should.be.eql("CONNECTED");
                            echo.should.be.eql("illyria");
                            times.should.be.above(0);
                            reconnectedEmitted.should.be.eql(true);
                            done();
                        });
                    };

                    server.listen(function() {
                        client.on("connected", function() {
                            reconnectedEmitted = true;
                            if(!process.env.ZK_NO_WARN) console.log("connected");
                        });
                        setTimeout(send, 1000);
                    });
                });
            }, 7000);
        });
    });
});
