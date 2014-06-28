var Server = require('../lib/server');

var srv = new Server();
console.log(srv);
srv.expose('Number', {
    add: function(a, b, result) {
        return result(null, a + b);
    },
    echo: function(text, result) {
        return result(null, text);
    }
});

srv.listen(8888);
