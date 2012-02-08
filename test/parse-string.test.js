var assert = require('assert');
var util = require('util');
var tint = require('..');

var mappings = {
    '': {},
    '20': { hue: 20 },
    '20,40': { hue: 20, saturation: 40 },
    '30,90,0': { hue: 30, saturation: 90, invert: false },
    '30.934,84.3,0': { hue: 30.934, saturation: 84.3, invert: false },
    '30.934,84.3,1': { hue: 30.934, saturation: 84.3, invert: true },
    '30,84,0,.3,.2': { hue: 30, saturation: 84, invert: false, x0: 0.3, y0: 0.2, x1: 0.7, y1: 0.8 },
    '30,84,0,.3,.2,1,1': { hue: 30, saturation: 84, invert: false, x0: 0.3, y0: 0.2, x1: 1, y1: 1 }
};

describe('parse string', function() {
    Object.keys(mappings).forEach(function(str) {
        it('parse ' + util.inspect(str), function() {
            var options = tint.parseString(str);
            assert.deepEqual(options, mappings[str]);
        });
    });
});
