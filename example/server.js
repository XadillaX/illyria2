var _ = require('underscore');

var server = require('../lib').createServer({
    port: 9990
});

server.expose('Number', {
    add: function(params, result) {
        console.log('server add:', params);
        var sum = 0;
        params.forEach(function(n) {
            sum += n;
        });
        return result(null, sum);
    }
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
    client.rpc(
        'Number',
        'add',
        _.sample([1, 2, 3, 4, 5, 6], 2),
        function(err, data) {
            console.log('client recv:', err, data);
            process.nextTick(run);
        });
}

run();
