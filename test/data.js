'use strict';

const {
    DEFAULT_MAX_SIZE
} = require('..');

module.exports.simpleString = 'String';

const largeBlob = Buffer.alloc(DEFAULT_MAX_SIZE + 1);
for (let i = 0; i < largeBlob.length; i++) {
    largeBlob[i] = i % 256;
}
module.exports.largeBlob = largeBlob;