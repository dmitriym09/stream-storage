'use strict';

const util = require('util');
const {
    Duplex
} = require('stream');
const fs = require('fs');
const path = require('path');

const constants = require('./constants');

const StreamStorage = module.exports = function (opts) {
    opts = opts || {};
    opts.decodeStrings = true;

    Duplex.call(this, opts);

    const initialSize = opts.initialSize || constants.DEFAULT_INITIAL_SIZE;
    const incrementAmount = opts.incrementAmount || constants.DEFAULT_INCREMENT_AMOUNT;
    const maxSize = opts.MAX_SIZE || constants.DEFAULT_MAX_SIZE;

    let buffer = Buffer.alloc(initialSize);
    let size = 0;
    let pos = 0;
    let fileSize = 0;

    const fileName = path.join(opts.TMP_DIR || constants.DEFAULT_TMP_DIR,
        `.${process.pid}.${Date.now()}-${`${~~(Math.random() * 10000000)}`.padStart(8, 9)}.tmp`
    );

    this.pos = function () {
        return pos;
    };

    this.size = function () {
        return size;
    };

    this.fileSize = function () {
        return fileSize;
    };

    this.fileName = function () {
        return fileName;
    };

    this.bufferSize = function () {
        return buffer.length;
    };

    const writeChunk = function (chunk) {
        return new Promise((resolve, reject) => {
            size += chunk.length;

            if ((buffer.length - pos) < chunk.length) {
                if ((pos + chunk.length) >= maxSize) {
                    const writeBuf = buffer.slice(0, pos)
                    fileSize += writeBuf.length;
                    return fs.appendFile(fileName, writeBuf, (err) => {
                        if (!!err) {
                            return reject(err);
                        }

                        if (chunk.length >= maxSize) {
                            fileSize += chunk.length;
                            return fs.appendFile(fileName, chunk, (err) => {
                                if (!!err) {
                                    return reject(err);
                                }

                                pos = 0;
                                return resolve();
                            });

                        } else {
                            pos = 0;

                            chunk.copy(buffer, pos, 0);
                            pos += chunk.length;

                            return resolve();
                        }
                    });
                } else {
                    const factor = Math.ceil((chunk.length - (buffer.length - pos)) / incrementAmount);

                    const newBuffer = Buffer.alloc(buffer.length + (incrementAmount * factor));
                    buffer.copy(newBuffer, 0, 0, pos);
                    buffer = newBuffer;
                    chunk.copy(buffer, pos, 0);
                    pos += chunk.length;

                    return resolve();
                }
            } else {
                chunk.copy(buffer, pos, 0);
                pos += chunk.length;

                return resolve();
            }
        });
    };

    this._write = (chunk, encoding, cb) => {
        writeChunk(chunk)
            .then(cb)
            .catch(cb);
    };
};

util.inherits(StreamStorage, Duplex);