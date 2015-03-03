/**
 * XadillaX created at 2014-09-02 14:08
 *
 * Copyright (c) 2014 Huaban.com, all rights
 * reserved.
 */
var illyria = require('../lib');

var server = illyria.createServer({}, {
    connectingString: "192.168.16.231:2181",
    root: "illyria",
    prefix: "p"
});

server.expose({
    name: 'Number',
    methods: {
        add: function(req, res) {
            var sum = 0;
            req.params().forEach(function(n) {
                sum += n;
            });
            return res.send(sum);
        },
        minus: function(req, res) {
            var a = req.param('a');
            var b = req.param('b');
            res.json({
                result: a - b
            });
        }
    }
});

server.use(function(req, res, next) {
    if(!req.hasOwnProperty('modules')) {
        req.modules = {
            name: 'modules'
        };
    }
    next();
});

server.listen(8888, "localhost", function() {
    console.log('create server successfully');
});

process.on('SIGINT', function() {
    server.close(function() {
        process.exit(0);
    });
});

