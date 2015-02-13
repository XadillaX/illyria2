var _ = require('underscore');
var async = require('async');

var client = require('../lib').createClient({
    port: 8888,
    runTimeout: 10000,
    retryInterval: 1000,
    reconnect: true
});

client.connect(function() {
    console.log('connect successfully!');
});

client.on('error', function(err) {
    console.log(err);
});

function run() {
    async.parallel([
        function(done) {
            client.rpc(
                'Number',
                'add',
                _.sample([1, 2, 3, 4, 5, 6], 2),
                function(err, data) {
                    console.log('client recv:', err, data);
                    done();
                });

        },
        function(done) {
            client.rpc(
                'Number',
                'add',
                _.sample([1, 2, 3, 4, 5, 6], 2),
                function(err, data) {
                    console.log('client recv:', err, data);
                    done();
                });

        }
    ], function() {
        setTimeout(run, 500);
    });
}

run();
