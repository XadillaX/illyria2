/**
 * XadillaX created at 2015-03-27 13:48:21
 *
 * Copyright (c) 2015 Huaban.com, all rights
 * reserved
 */
require("should");
var Request = require("../lib/request");

describe("request object", function() {
    var param = { a: 1, b: 2 };
    var req = new Request(undefined, param);

    it("should be the original object", function() {
        req.params().should.be.eql(param);
    });

    it("should be 1, 2 and 3", function() {
        req.param("a", 3).should.be.eql(1);
        req.param("b", 3).should.be.eql(2);
        req.param("c", 3).should.be.eql(3);
    });
});
