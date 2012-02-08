var BezierCurve = require('./beziercurve');
var crc32 = require('./crc32');

// Polyfill buffers.
if (!Buffer) {
    var Buffer = require('buffer').Buffer;
    var SlowBuffer = require('buffer').SlowBuffer;
    SlowBuffer.prototype.readUInt32BE = Buffer.prototype.readUInt32BE = function(offset) {
        var val = this[offset + 1] << 16;
        val |= this[offset + 2] << 8;
        val |= this[offset + 3];
        return val + (this[offset] << 24 >>> 0);
    };
}

function hsl2rgb(h, s, l) {
    if (!s) return [l * 255, l * 255, l * 255];

    var v = l <= 0.5 ? l*(1+s) : l+s-l*s;
    if (!v) return [0, 0, 0];

    var min = 2*l-v;
    var sv = (v-min)/l
    h = (h % 360) / 60;
    var sextant = h | 0;
    var fract = h-sextant;
    v *= 255;
    min *= 255;
    switch (sextant) {
        case 0: return [Math.round(v), Math.round(min+v*sv*fract), Math.round(min)];
        case 1: return [Math.round(v-v*sv*fract), Math.round(v), Math.round(min)];
        case 2: return [Math.round(min), Math.round(v), Math.round(min+v*sv*fract)];
        case 3: return [Math.round(min), Math.round(v-v*sv*fract), Math.round(v)];
        case 4: return [Math.round(min+v*sv*fract), Math.round(min), Math.round(v)];
        case 5: return [Math.round(v), Math.round(min), Math.round(v-v*sv*fract)];
    }
}

var tables = {};

function getLookupTable(hue, saturation, invert, x1, y1, x2, y2) {
    var key = hue.toFixed(1) + saturation.toFixed(1) + Number(invert) + x1.toFixed(2) + y1.toFixed(2) + x2.toFixed(2) + y2.toFixed(2);

    if (!tables[key]) {
        tables[key] = Array(255);
        var curve = new BezierCurve(x1, y1, x2, y2);
        for (var i = 0; i < 256; i++) {
            var lightness = curve.interpolate(i / 255);
            if (invert) lightness = 1 - lightness;
            tables[key][i] = hsl2rgb(hue, saturation, lightness);
        }
    }

    return tables[key];
}

var tint = module.exports = function(png, options) {
    if (!png || !png.length || !png.readUInt32BE) throw new Error('Image must be a buffer');
    if (png.length < 67) throw new Error('Image size is too small');

    // Check header.
    if (png[0] !== 137 || png[1] !== 80 || png[2] !== 78 || png[3] !== 71 ||
        png[4] !== 13  || png[5] !== 10 || png[6] !== 26 || png[7] !== 10) throw new Error('Image is not a PNG file');

    if (!options) options = {};
    var hue = (options.hue || 0);
    var saturation = (options.saturation || 0) / 100;
    var invert = options.invert || false;
    var x1 = +options.x1 || 0;
    var y1 = +options.y1 || 0;
    var x2 = 'x2' in options ? +options.x2 : 1;
    var y2 = 'y2' in options ? +options.y2 : 1;

    if (hue >= 360 || hue < 0) throw new Error('Hue must be between 0° and 360°');
    if (saturation > 1 || saturation < 0) throw new Error('Saturation must be between 0% and 100%');
    if (x1 < 0 || x1 > 1) throw new Error('First handle\'s X coordinate must be between 0 and 1');
    if (y1 < 0 || y1 > 1) throw new Error('First handle\'s Y coordinate must be between 0 and 1');
    if (x2 < 0 || x2 > 1) throw new Error('Second handle\'s X coordinate must be between 0 and 1');
    if (y2 < 0 || y2 > 1) throw new Error('Second handle\'s Y coordinate must be between 0 and 1');

    var lut = getLookupTable(hue, saturation, invert, x1, y1, x2, y2);

    // Find PLTE chunk
    var i = 8;
    while (i < png.length) {
        var length = png.readUInt32BE(i);
        var type = png.toString('ascii', i + 4, i + 8);
        if (!(length || type === 'IEND')) throw new Error('Image has invalid chunk with length 0');

        // Skip length and chunk type;
        i += 8;

        if (type === 'PLTE') {
            for (var entry = 0; entry < length; entry += 3) {
                var r = png[i + entry], g = png[i + entry + 1], b = png[i + entry + 2];
                var lightness = Math.round(0.30*r + 0.59*g + 0.11*b);
                var color = lut[lightness];
                png[i + entry] = color[0];
                png[i + entry + 1] = color[1];
                png[i + entry + 2] = color[2];
            }

            // Update CRC
            var crc = crc32(png.slice(i - 4, i + length));
            // Don't use buffer copy because it fails in node 0.4 due to
            // different instances of the Buffer object...
            png[i + length] = crc[0];
            png[i + length + 1] = crc[1];
            png[i + length + 2] = crc[2];
            png[i + length + 3] = crc[3];
            return;
        }

        // Skip CRC.
        i += length + 4;
    }

    throw new Error('Image does not have a palette')
};

tint.parseString = function(str) {
    if (!str.length) return {};
    var parts = str.split(';');
    var options = {};
    if (parts.length > 0) options.hue = parseFloat(parts[0]);
    if (parts.length > 1) options.saturation = parseFloat(parts[1]);
    if (parts.length > 2) options.invert = parseInt(parts[2]) > 0;

    if (parts.length == 5) {
        options.x0 = parseFloat(parts[3]);
        options.y0 = parseFloat(parts[4]);
        options.x1 = 1 - options.x0;
        options.y1 = 1 - options.y0;
    } else if (parts.length == 7) {
        options.x0 = parseFloat(parts[3]);
        options.y0 = parseFloat(parts[4]);
        options.x1 = parseFloat(parts[5]);
        options.y1 = parseFloat(parts[6]);
    }
    return options;
};
