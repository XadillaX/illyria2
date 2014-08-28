var util = require('util');
var zookeeper = require('node-zookeeper-client');
var CreateMode = zookeeper.CreateMode;

var Zookeeper = function (connectionString, options) {
    options = options || {};
    var self = this;
    this.client = zookeeper.createClient(connectionString, options);
    self.serverHost = options['serverHost'] || 'localhost';
    self.serverPort = options['serverPort'] || 3333;
    self.rootPath = options['rootPath'] || '/illyria';
    self.prefix = options['prefix'] || '/t';
    self.realPath = null;
    this.client.once('connected', function() {
        self.registerServer(self.serverHost, self.serverPort, function(err, path) {
           if (err) {
               console.log(err);
               self.close();
               self.emit('error', err);
           }
           else {
               self.realPath = path;
               console.log('register server successfully!');
           }

        });
    });
    this.client.connect();
};
util.inherits(Zookeeper, require('events').EventEmitter);

Zookeeper.prototype.registerServer = function(host, port, cb) {
    var self = this;
    var root = self.rootPath;
    var path = root + self.prefix;
    this.client.exists(root, function(err, exists) {
        if (err) return cb(err);
        if (!exists) {
            self.client.mkdirp(root, function(err) {
                if (err) return cb(err);
                self.client.create(path,
                    new Buffer([host, port, 0].join(',')),
                    CreateMode.EPHEMERAL_SEQUENTIAL,
                    cb
                );
            });
        }
        else {
            self.client.create(path,
                new Buffer([host, port, 0].join(',')),
                CreateMode.EPHEMERAL_SEQUENTIAL,
                cb
            );
        }
    });
};

Zookeeper.prototype.updateClientNum = function(num, cb) {
    this.client.setData(this.realPath, new Buffer([this.serverHost, this.serverPort, num].join(',')), cb);
};

Zookeeper.prototype.close = function(host, port, cb) {
    cb = cb || function() {};
    var self = this;
    if (!this.realPath) {
        self.client.close();
        return cb();
    }
    this.client.remove(this.realPath, function(err) {
        self.client.close();
        cb(err);
    });
};

module.exports = Zookeeper;