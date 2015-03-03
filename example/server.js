require('underscore');
var illyria = require('../lib');

var server = illyria.createServer({
    port: 8888
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

server.listen(function() {
    console.log('create server successfully');
});
