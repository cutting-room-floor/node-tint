var assert = require('assert');
var fs = require('fs');
var path = require('path');
var tint = require('..');

describe('tinting', function() {
    fs.readdirSync('./test/tinted')
        .filter(function(file) { return path.extname(file) === '.png'; })
        .forEach(function(file) {
            // Parse parameters from filename.
            var parts = path.basename(file, '.png').split('_');
            var name = parts[0];
            var o = {};
            if (parts.length > 1) o.hue = parseFloat(parts[1]);
            if (parts.length > 2) o.saturation = parseFloat(parts[2]);
            if (parts.length > 3) o.invert = parts[3] == 'negative';
            if (parts.length == 6) {
                o.x0 = parseFloat(parts[4]);
                o.y0 = parseFloat(parts[5]);
                o.x1 = 1 - o.x0;
                o.y1 = 1 - o.y0;
            } else if (parts.length == 8) {
                o.x0 = parseFloat(parts[4]);
                o.y0 = parseFloat(parts[5]);
                o.x1 = parseFloat(parts[6]);
                o.y1 = parseFloat(parts[7]);
            }

            var testName = name;
            if ('hue' in o) testName += ', hue=' + o.hue + '°';
            if ('saturation' in o) testName += ', saturation=' + o.saturation + '%';
            if ('invert' in o) testName += ', invert=' + (o.invert ? 'yes' : 'no');
            if ('x0' in o && 'y0' in o) testName += ', first=' + o.x0.toFixed(2) + '/' + o.y0.toFixed(2);
            if ('x1' in o && 'y1' in o) testName += ', second=' + o.x1.toFixed(2) + '/' + o.y1.toFixed(2);

            it(testName, function() {
                var source = fs.readFileSync('./test/source/' + name + '.png');
                tint(source, o);
                // fs.writeFileSync('./test/actual/' + file, source);
                var result = fs.readFileSync('./test/tinted/' + file);
                assert.deepEqual(source, result);
            });
        });
});
