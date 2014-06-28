var connection = require('../lib').createConnection();

connection.connect(8888, 'localhost', function(client) {
    client.call('Number.add', 1, 2, function(err, result) {
        console.log(err, result);
        process.exit(0);
    });
});
