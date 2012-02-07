// Adapted from http://www.libpng.org/pub/png/spec/1.2/PNG-CRCAppendix.html

var table = [];
for (var n = 0; n < 256; n++) {
    for (var c = n, k = 0; k < 8; k++) {
        if (c & 1) c = 0xEDB88320 ^ c >>> 1;
        else c = c >>> 1;
    }
    table[n] = c;
}

module.exports = function crc32(buffer) {
    var crc = 0xFFFFFFFF;
    for (var n = 0; n < buffer.length; n++) {
        crc = table[(crc ^ buffer[n]) & 0xFF] ^ (crc >>> 8);
    }
    crc ^= 0xFFFFFFFF;
    return new Buffer([ crc >>> 24, crc >>> 16 & 0xFF, crc >>> 8 & 0xFF, crc & 0xFF ]);
};
