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

    var m1, m2, r, g, b;
    h = h / 360;

    var hueToRGB = function (m1, m2, h) {
        h = (h + 1) % 1;
        if (h * 6 < 1) return m1 + (m2 - m1) * h * 6;
        if (h * 2 < 1) return m2;
        if (h * 3 < 2) return m1 + (m2 - m1) * (0.66666 - h) * 6;
        return m1;
    };

    m2 = (l <= 0.5) ? l * (s + 1) : l + s - l * s;
    m1 = l * 2 - m2;
    return [
        hueToRGB(m1, m2, h + 0.33333) * 255,
        hueToRGB(m1, m2, h) * 255,
        hueToRGB(m1, m2, h - 0.33333) * 255
    ];
}

function rgb2hsl(r, g, b){
    r /= 255, g /= 255, b /= 255;
    var max = Math.max(r, g, b);
    var min = Math.min(r, g, b);
    var delta = max - min;
    var gamma = max + min;
    var h = 0, s = 0, l = gamma / 2;

    if (delta) {
        s = l > 0.5 ? delta / (2 - gamma) : delta / gamma;
        if (max == r && max != g) h = (g - b) / delta + (g < b ? 6 : 0)
        if (max == g && max != b) h = (b - r) / delta + 2;
        if (max == b && max != r) h = (r - g) / delta + 4;
        h /= 6;
    }

    return [h * 365, s * 100, l * 100];
}

var tables = {};

function getLookupTable(hue, saturation, y0, y1) {
    var key = hue.toFixed(1) + saturation.toFixed(1) + y0.toFixed(2) + y1.toFixed(2);

    if (!tables[key]) {
        tables[key] = Array(255);
        for (var i = 0, r = y1 - y0; i < 256; i++) {
            var l = y0 + (i / 255 * r);
            if (l > 1) l = 1;
            if (l < 0) l = 0;
            tables[key][i] = hsl2rgb(hue, saturation, l);
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
    var y0 = 'y0' in options ? +options.y0 : 0;
    var y1 = 'y1' in options ? +options.y1 : 1;

    if (hue >= 360 || hue < 0) throw new Error('Hue must be between 0 and 360 degrees');
    if (saturation > 1 || saturation < 0) throw new Error('Saturation must be between 0% and 100%');

    var lut = getLookupTable(hue, saturation, y0, y1);

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

    var options = {};
    var hex = str.match(/^#?([0-9a-f]{6})$/i);
    if (hex) {
        var hsl = rgb2hsl(
            parseInt(hex[1].substring(0, 2), 16),
            parseInt(hex[1].substring(2, 4), 16),
            parseInt(hex[1].substring(4, 6), 16)
        );
        options.hue = hsl[0];
        options.saturation = hsl[1];
        // Map midpoint grey to the color value, stretching values to
        // preserve white/black range. Will preserve good contrast and
        // midtone color at the cost of clipping extreme light/dark values.
        var l = hsl[2]*0.01;
        if (l > 0.5) {
            options.y0 = 0;
            options.y1 = l * 2;
        } else {
            options.y0 = l - (1-l);
            options.y1 = 1;
        }
    } else {
        var parts = str.split(';');
        if (parts.length > 0) options.hue = parseFloat(parts[0]);
        if (parts.length > 1) options.saturation = parseFloat(parts[1]);
        if (parts.length > 2) options.y0 = parseFloat(parts[2]);
        if (parts.length > 3) options.y1 = parseFloat(parts[3]);
    }

    return options;
};
