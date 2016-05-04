#! /usr/bin/env node
/**
 * XadillaX created at 2015-03-11 14:42:39
 *
 * Copyright (c) 2015 Huaban.com, all rights
 * reserved
 */
/* istanbul ignore next */
(function() {

var async = require("async");
var illyria2 = require("../");
var Scarlet = require("scarlet-task");
var block;

function countValidator(min, max, name) {
    return function(count) {
        var _count = parseInt(count);
        if(count.toString() !== _count.toString()) {
            return name + " must be an integer";
        }

        if(_count <= min || _count >= max) {
            return name + " must be greater than 0 and smaller than 2147483648";
        }
    };
}

var opts = require("nomnom")
    .option("n", {
        abbr: "n",
        default: 1,
        help: "times of testing",
        callback: countValidator(0, 2147483648, "n")
    })
    .option("complicating", {
        abbr: "c",
        default: 1,
        help: "complicating of dummy users",
        callback: countValidator(0, 2147483648, "c")
    })
    .option("size", {
        abbr: "s",
        default: 512,
        help: "data size for each request",
        callback: countValidator(0, 2147483648, "size")
    })
    .option("port", {
        abbr: "p",
        default: 8742,
        help: "port for test server",
        callback: countValidator(999, 65536, "port")
    })
    .option("complicating-mode", {
        abbr: "m",
        default: "clients",
        help: "mode of complicating (client or clients)",
        callback: function(mode) {
            if(mode !== "client" && mode !== "clients") {
                return "complicating mode must be client or clients";
            }
        }
    })
    .option("hide-per", {
        flag: true,
        help: "hide per case's result"
    })
    .script("./benchmark/index")
    .parse();

var clients = [];
var server;
var SERVER_PORT = opts.port;

async.waterfall([
    /**
     * step 1.
     *   create server
     */
    function(callback) {
        server = illyria2.createServer();
        server.expose("benchmark", {
            echo: function(req, resp) {
                resp.send(req.params());
            }
        });
        server.listen(SERVER_PORT, function() {
            callback();
        });
    },

    /**
     * step 2.
     *   create clients and connect to server
     */
    function(callback) {
        var scarlet = new Scarlet(Math.min(opts.n, 100));

        function connect(taskObject) {
            var client = taskObject.task.client;
            var i = taskObject.task.idx;

            client.connect(function() {
                scarlet.taskDone(taskObject);
            });

            client.on("error", function(err) {
                console.log(err + ": Client " + i);
            });
        }

        console.time("Connect");

        // if mode is `clients`, we create (opts.complicating) clients,
        // otherwise we create only one.
        var max = opts["complicating-mode"] === "clients" ? opts.complicating : 1;
        for(var i = 0; i < max; i++) {
            var client = illyria2.createClient("127.0.0.1", SERVER_PORT, {
                runTimeout: 10000,
                retryInterval: 1000,
                reconnect: true
            });

            scarlet.push({ idx: i, client: client }, connect);

            clients.push(client);
        }

        scarlet.afterFinish(max, function() {
            console.timeEnd("Connect");
            callback();
        }, false);
    },

    /**
     * step 3.
     *   start testing
     */
    function(callback) {
        block = "";
        for(var i = 0; i < opts.size; i++) block + ".";
        testAbility(callback);
    }
], function() {
    console.log(
        "done on " + opts.n + 
        " times, " + opts.complicating + 
        " complicating, block size is " + opts.size + 
        " and inconsistent is " + inconsistent + ".");

    process.exit(0);
});

var inconsistent = 0;

/**
 * test benchmark for per time (per opts.n)
 * @param {TaskObject} taskObject the task object of scarlet-task
 */
function testPerAbility(taskObject) {
    var idx = taskObject.task.idx;

    var scarlet = new Scarlet(opts.complicating);

    function test(taskObject) {
        taskObject.task.client.send("benchmark", "echo", { block: block }, function(err, data) {
            if(data.block !== block) {
                inconsistent++;
            }
            
            scarlet.taskDone(taskObject);
        });
    }

    /**
     * create opts.complicating tasks, each task is to send and receive data
     */
    var useI = opts["complicating-mode"] === "clients";
    for(var i = opts.complicating - 1; i >= 0; i--) {
        // if mode is `clients`, we use (opts.complicating) clients,
        // otherwise, we use only 1
        scarlet.push({ client: clients[useI ? i : 0] }, test);
    }

    scarlet.afterFinish(opts.complicating, function() {
        if(!opts["hide-per"]) console.timeEnd("# Case " + idx);
        taskObject.task.scarlet.taskDone(taskObject);
    }, false);

    if(!opts["hide-per"]) console.time("# Case " + idx);
}

/**
 * test benchmark for total opts.n times
 * @param {Function} callback the callback function
 */
function testAbility(callback) {
    var scarlet = new Scarlet(1);

    /**
     * create opts.n tasks, each task is to call `testPerAbility`
     */
    for(var i = opts.n - 1; i >= 0; i--) {
        scarlet.push({ idx: opts.n - i, scarlet: scarlet }, testPerAbility);
    }

    scarlet.afterFinish(opts.n, function() {
        console.timeEnd("Process");
        callback();
    }, false);

    console.time("Process");
}

})();
