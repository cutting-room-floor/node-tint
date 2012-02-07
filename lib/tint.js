var BezierCurve = require('./beziercurve');
var crc32 = require('./crc32');


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
        case 0: return [v, min+v*sv*fract, min];
        case 1: return [v-v*sv*fract, v, min];
        case 2: return [min, v, min+v*sv*fract];
        case 3: return [min, v-v*sv*fract, v];
        case 4: return [min+v*sv*fract, min, v];
        case 5: return [v, min, v-v*sv*fract];
    }
}


module.exports = function(png, options) {
    if (!Buffer.isBuffer(png)) throw new Error('Image must be a buffer');
    if (png.length < 67) throw new Error('Image size is too small');

    // Check header.
    if (png[0] !== 137 || png[1] !== 80 || png[2] !== 78 || png[3] !== 71 ||
        png[4] !== 13  || png[5] !== 10 || png[6] !== 26 || png[7] !== 10) throw new Error('Image is not a PNG file');

    if (!options) options = {};
    var hue = (options.hue || 0) / 360;
    var saturation = (options.saturation || 0) / 255;
    var invert = options.invert || false;
    var x1 = +options.x1 || 0;
    var y1 = +options.y1 || 0;
    var x2 = 'x2' in options ? +options.x2 : 1;
    var y2 = 'y2' in options ? +options.y2 : 1;

    var curve = new BezierCurve(x1, y1, x2, y2);

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
                var lightness = png[i + entry]; // hack, only works on grayscale images
                if (invert) lightness = 255 - lightness;
                var color = hsl2rgb(hue, saturation, curve.interpolate(lightness / 255));
                png[i + entry] = color[0];
                png[i + entry + 1] = color[1];
                png[i + entry + 2] = color[2];
            }

            // Update CRC
            crc32(png.slice(i - 4, i + length)).copy(png, i + length);
        }

        // Skip CRC.
        i += length + 4;
    }
};
