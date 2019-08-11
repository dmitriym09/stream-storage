'use strict';

const util = require('util');
const {
    Duplex
} = require('stream');
const fs = require('fs');
const path = require('path');

const constants = require('./constants');

class StreamStorage extends Duplex {
    constructor(options = {}) {
        options = Object.assign({
            decodeStrings: true,
            emitClose: true,

            initialSize: constants.DEFAULT_INITIAL_SIZE,
            incrementAmount: constants.DEFAULT_INCREMENT_AMOUNT,
            maxSize: constants.DEFAULT_MAX_SIZE,
            tmpDir: constants.DEFAULT_TMP_DIR

        }, options);

        super(options);

        this._options = options;

        this._buffer = Buffer.alloc(this._options.initialSize);
        this._size = 0;
        this._pos = 0;
        this._fileSize = 0;

        this._fileName = path.join(this._options.tmpDir,
            `.${process.pid}.${Date.now()}-${`${~~(Math.random() * 10000000)}`.padStart(8, 9)}.tmp`
        );
    }

    get pos() {
        return this._pos;
    };

    get size() {
        return this._size;
    };

    get fileSize() {
        return this._fileSize;
    };

    get fileName() {
        return this._fileName;
    };

    get bufferSize() {
        return this._buffer.length;
    };

    _writeChunk(chunk) {
        return new Promise((resolve, reject) => {
            this._size += chunk.length;

            if ((this._buffer.length - this.pos) < chunk.length) {
                if ((this.pos + chunk.length) >= this._options.maxSize) {
                    const writeBuf = this._buffer.slice(0, this.pos)
                    this._fileSize += writeBuf.length;
                    return fs.appendFile(this.fileName, writeBuf, (err) => {
                        if (!!err) {
                            return reject(err);
                        }

                        if (chunk.length >= this._options.maxSize) {
                            this._fileSize += chunk.length;
                            return fs.appendFile(this.fileName, chunk, (err) => {
                                if (!!err) {
                                    return reject(err);
                                }

                                this._pos = 0;
                                return resolve();
                            });

                        } else {
                            this._pos = 0;

                            chunk.copy(this._buffer, this.pos, 0);
                            this._pos += chunk.length;

                            return resolve();
                        }
                    });
                } else {
                    const factor = Math.ceil((chunk.length - (this._buffer.length - this._pos)) / this._options.incrementAmount);

                    const newBuffer = Buffer.alloc(this._buffer.length + (this._options.incrementAmount * factor));
                    this._buffer.copy(newBuffer, 0, 0, this.pos);
                    this._buffer = newBuffer;
                    chunk.copy(this._buffer, this.pos, 0);
                    this._pos += chunk.length;

                    return resolve();
                }
            } else {
                chunk.copy(this._buffer, this.pos, 0);
                this._pos += chunk.length;

                return resolve();
            }
        });
    };

    _write(chunk, encoding, cb) {
        this._writeChunk(chunk)
            .then(cb)
            .catch(cb);
    };

    _destroy(err, cb) {
        if (fs.existsSync(this.fileName)) {
            fs.unlink(this.fileName, (err) => {
                cb(err);
            });
        } else {
            cb(err);
        }
    }

    _read() {
        console.log('_read');
        this.push('read');
    };
};

module.exports = StreamStorage;