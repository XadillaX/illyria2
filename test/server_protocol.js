/**
 * XadillaX created at 2015-03-04 16:06:08
 *
 * Copyright (c) 2015 Huaban.com, all rights
 * reserved
 */
var should = require("should");
var async = require("async");
var illyria = require("illyria");
var illyria2 = require("../");

describe("server protocol", function() {
    var SERVER_PORT = 1399;
    var server, client;

    function init(callback) {
        async.waterfall([
            function(callback) {
                if(client) {
                    client._socket.abc = 1;
                    client.close();
                }

                if(server) {
                    server.close(callback);
                } else callback();
            }
        ], function() {
            server = illyria2.createServer();
            callback();
        });
    }

    function startup(callback) {
        server.listen(SERVER_PORT, function() {
            client = illyria.createClient({
                port: SERVER_PORT,
                runTimeout: 1000,
                retryInterval: 1000,
                reconnect: false
            });

            client.connect(function() {
                callback();
            });

            client.on("error", function(err) {
                err.should.be.empty;
            });
        });
    }

    describe("match old client", function() {
        before(function(done) {
            init(function() {
                server.expose("test", {
                    echo: function(req, resp) {
                        req.params().should.be.eql("illyria");
                        resp.send("illyria");
                    },

                    json: function(req, resp) {
                        req.param("json").should.be.eql(true);
                        req.params().should.be.eql({ json: true });
                        resp.json(req.params());
                    },

                    error1: function(req, resp) {
                        resp.json({ status: 0, msg: "test error" });
                    },

                    error2: function(req, resp) {
                        resp.json({ err: "test error" });
                    },

                    error3: function(req, resp) {
                        resp.json({ error: "test error" });
                    }
                });

                server.expose({
                    name: "biu",
                    methods: {
                        "biubiu": function(req, resp) {
                            resp.send("biubiubiu");
                        }
                    }
                });

                startup(done);
            });
        });

        it("should received \"echo\"", function(done) {
            client.rpc("test", "echo", "illyria", function(err, data) {
                if(err) err.should.be.empty;
                data.should.be.eql("illyria");
                done();
            });
        });

        it("should received \"biubiubiu\"", function(done) {
            client.rpc("biu", "biubiu", [], function(err, data) {
                if(err) err.should.be.empty;
                data.should.be.eql("biubiubiu");
                done();
            });
        });

        it("should received { json: true }", function(done) {
            client.rpc("test", "json", { json: true }, function(err, data) {
                if(err) err.should.be.empy;
                data.should.be.eql({ json: true });
                done();
            });
        });

        it("should received error", function(done) {
            async.parallel({
                err1: function(callback) {
                    client.rpc("test", "error1", {}, function(err) {
                        (err instanceof Error).should.be.eql(true);
                        err.message.should.be.eql("test error");
                        callback();
                    });
                },

                err2: function(callback) {
                    client.rpc("test", "error2", {}, function(err) {
                        (err instanceof Error).should.be.eql(true);
                        err.message.should.be.eql("test error");
                        callback();
                    });
                },

                err3: function(callback) {
                    client.rpc("test", "error3", {}, function(err) {
                        (err instanceof Error).should.be.eql(true);
                        err.message.should.be.eql("test error");
                        callback();
                    });
                }
            }, function() {
                done();
            });
        });
    });

    describe("middleware", function() {
        before(function(done) {
            init(function() {
                server.use(function(req, resp, next) {
                    next.should.be.an.instanceof(Function);
                    next();
                });

                server.use(function(req, resp, next) {
                    if(req.param("pass", false)) {
                        return next();
                    }
                    return resp.send("no echo");
                });

                var _echo = function(req, resp) {
                    req.params().should.be.eql({ pass: true });
                    resp.send("echo");
                };

                server.expose("test", {
                    echo: _echo,
                    remove: function(req, resp) {
                        req.socket.removeReceivedEvent("test", req.params().method, _echo);
                        resp.send("removed");
                    }
                });

                startup(done);
            });
        });

        it("should received no echo", function(done) {
            client.rpc("test", "echo", {}, function(err, data) {
                should(err).be.empty;
                data.should.be.eql("no echo");
                done();
            });
        });

        it("should received echo", function(done) {
            client.rpc("test", "echo", { pass: true }, function(err, data) {
                should(err).be.empty;
                data.should.be.eql("echo");
                done();
            });
        });

        it("should timeout after remove", function(done) {
            client.rpc("test", "remove", { method: "echo", pass: true }, function(err, data) {
                should(err).be.empty;
                data.should.be.eql("removed");
                
                client.rpc("test", "echo", { pass: true }, function(err, data) {
                    should(data).be.empty;
                    err.message.should.be.eql("timeout");
                    done();
                });
            });
        });
    });

    describe("expose copies", function() {
        before(function(done) {
            init(function() {
                server.expose("fooBar", {
                    fooBaz: function(req, resp) {
                        resp.send("echo");
                    }
                }, {
                    alias: [
                        { module: "upperCamel", method: "underscore" },
                        { module: "lowerCamel" }
                    ]
                });

                startup(done);
            });
        });

        it("should received echo", function(done) {
            client.rpc("fooBar", "fooBaz", {}, function(err, data) {
                should(err).be.empty;
                data.should.be.eql("echo");
                done();
            });
        });

        it("should received echo again", function(done) {
            client.rpc("FooBar", "foo_baz", {}, function(err, data) {
                should(err).be.empty;
                data.should.be.eql("echo");
                done();
            });
        });
    });
});
