var _ = require('underscore');

var client = require('../lib').createClient({
    port:8888,
    runTimeout: 10000,
    retryInterval: 1000,
    reconnect: true
});
client.connect();

client.on('error', function(err) {
    console.log(err);
});

function run() {
    client.rpc(
        'IllyriaTest.Number',
        'add',
        _.sample([1, 2, 3, 4, 5, 6], 2),
        function(err, data) {
            console.log('client recv:', err, data);
            process.nextTick(run);
        });
}

run();
