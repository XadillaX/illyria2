// The protocol looks like this
// msgid|type|module|function|arguments
// `msgid` is 4 bytes encoded Big Endian uint32

module.exports = {
    MAX_MSGID: Math.pow(2, 31) - 1,
    TYPE: 'call'
};
