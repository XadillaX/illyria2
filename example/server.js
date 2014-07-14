var _ = require('underscore');
var async = require('async');
var illyria = require('../lib');

var server = illyria.createServer({
    port: 9990
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
            res.json({result: a - b});
        }
    }
});

server.use(function(req, res, next) {
    if (!req.hasOwnProperty('modules')) {
        req.modules = {name: 'modules'};
    }
    next();
});

server.listen(9990, function() {
   console.log('create server successfully');
});

var client = require('../lib').createClient({
    port:9990,
    runTimeout: 10000,
    retryInterval: 1000,
    reconnect: true
});
client.connect();

client.on('error', function(err) {
    console.log(err);
});


function run() {
    async.parallel([
        function(next) {
            client.rpc(
                'Number',
                'add',
                _.sample([1, 2, 3, 4, 5, 6], 2),
                function(err, data) {
                    console.log('client recv:', err, data);
                    next();
                }
            )
        },
        function(next) {
            client.rpc(
                'Number',
                'minus',
                {a: 3, b: 4},
                function(err, data) {
                    console.log('client recv:', err, data);
                    next();
                }
            )
        }
    ], function() {
        process.nextTick(run);
    });
}

run();
