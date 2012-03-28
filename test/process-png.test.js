var assert = require('assert');
var fs = require('fs');
var path = require('path');
var tint = require('..');

describe('Invalid png file', function() {
    var tests = [
    	{ file: 'small', message: 'Image size is too small'},
    	{ file: 'lorem', message: 'Image is not a PNG file'},
    	{ file: 'truecolour', message: 'Image does not have a palette'},
    	{ file: 'bad-profile', message: 'Image has invalid chunk with length 0'}
    ];

    tests.forEach(function(t) {
    	var source = fs.readFileSync(path.join('./test/source', t.file +'.png'));

	it(t.file, function() {
	    var err;
	    try {
		tint(source, {});
	    }
	    catch(e) {
		err = e;
	    }
	    assert.notEqual(err, null);
	    assert.equal(err.message, t.message);
	});
    });
});
