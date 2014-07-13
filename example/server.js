var _ = require('underscore');

var server = require('../lib').createServer({
    port: 9990
});

server.expose('Number', {
    add: function(req, res) {
        console.log('server add:', req.params());
        var sum = 0;
        req.params().forEach(function(n) {
            sum += n;
        });
        return res.send(sum);
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
