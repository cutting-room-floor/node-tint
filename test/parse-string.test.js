var assert = require('assert');
var util = require('util');
var tint = require('..');

var mappings = {
    '': {},
    '20': { hue: 20 },
    '20;40': { hue: 20, saturation: 40 },
    '30;84;0.5': { hue: 30, saturation: 84, y0: 0.5 },
    '30;84;.3;.2': { hue: 30, saturation: 84, y0: 0.3, y1: 0.2 },
    'ffffff': { hue: 0, saturation: 0, y0: 0, y1: 2 },
    'ff7f00': { hue: 30.29738562091503, saturation: 100, y0: 0, y1: 1 },
    '#4c2d00': { hue: 36.01973684210527, saturation: 100, y0: -0.7019607843137254, y1: 1 }
};

describe('parse string', function() {
    Object.keys(mappings).forEach(function(str) {
        it('parse ' + util.inspect(str), function() {
            var options = tint.parseString(str);
            assert.deepEqual(options, mappings[str]);
        });
    });
});
