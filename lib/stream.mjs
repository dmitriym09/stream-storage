import {
    Duplex
} from 'stream';
import fs from 'fs';
import path from 'path';
import {
    promisify
} from 'util';

import * as constants from './constants.mjs';
import {
    settings
} from 'cluster';

const closeFd = promisify(fs.close);
const unlink = promisify(fs.unlink);
const read = promisify(fs.read);

export default class StreamStorage extends Duplex {
    constructor(options = {}) {
        options = Object.assign({
            // incrementAmount: constants.DEFAULT_INCREMENT_AMOUNT,
            maxMemorySize: constants.DEFAULT_MAX_MEMORY_SIZE,
            tmpDir: constants.DEFAULT_TMP_DIR,
            pushMsec: constants.DEFAULT_PUSH_MSEC,
            chunkSize: constants.DEFAULT_CHUNK_SIZE

        }, options);

        super(options);

        this._maxMemorySize = options.maxMemorySize;
        this._pushMsec = options.pushMsec;

        this._buffers = [];
        this._buffersSize = 0;

        this._fileName = path.join(options.tmpDir,
            `.${process.pid}.${Date.now()}-${`${~~(Math.random() * 10000000)}`.padStart(8, 9)}.tmp`
        );
        this._fd = fs.openSync(this._fileName, 'wx+');
        this._fileSize = 0;

        this._timer = null;

        this._chunkSize = options.chunkSize;

        this._readPos = {
            nBuffer: 0,
            pos: 0
        };
    }

    get size() {
        return this._buffersSize + this._fileSize;
    }

    _write(chunk, encoding, callback) {
        console.log('_write')
        if (this._fd === null) {
            return callback(new Error('Stream is cleared'));
        }

        if (encoding !== 'buffer') {
            return callback(new TypeError(`Unsupported enoding ${encoding}`));
        }

        let chunkPos = 0;

        const freeInBuffer = this._maxMemorySize - this._buffersSize;
        if (freeInBuffer > 0) {
            if (freeInBuffer >= chunk.length) {
                this._buffers.push(chunk);
                chunkPos = chunk.length;
                this._buffersSize += chunkPos;
            } else {
                const slice = chunk.slice(0, freeInBuffer);
                this._buffers.push(slice);
                chunkPos = slice.length;
                this._buffersSize += slice;
            }
        }

        if (chunkPos < chunk.length) {
            const bufferToWrite = chunk.slice(freeInBuffer)
            fs.write(this._fd, bufferToWrite, 0, bufferToWrite.length, this._fileSize, err => {
                if (err) {
                    return callback(err);
                }
                const bufferToWrite = chunk.slice(freeInBuffer)
                this._fileSize += bufferToWrite.length;

                callback(null);
            });
        } else {
            callback(null);
        }
    }

    async clear() {
        if (this._fd !== null) {
            const fd = this._fd;
            this._fd = null;

            await closeFd(fd);

            await unlink(this._fileName);
        }
    }

    _read(size) {
        console.log('_read', size)

        if (!this._timer) {
            let isProcessed = false;
            this._timer = setInterval(() => {
                if (isProcessed) return;
                isProcessed = true;

                this._readBuffer(size || this._chunkSize)
                    .then(buffer => {
                        const res = this.push(buffer);
                        if (!res) {
                            clearInterval(this._timer);
                            this._timer = null;
                        }
                    })
                    .catch(err => {
                        this.destroy(err);
                    })
                    .finally(() => {
                        isProcessed = false;
                    });


            }, this._pushMsec);
        }
    }

    async _readBuffer(size) {
        console.log('_readBuffer', size)
        if (this._readPos.nBuffer === null) {
            if (this._fileSize <= this._readPos.pos) {
                if (this.writableFinished) {
                    return null;
                }

                return undefined;
            }

            const readden = Buffer.alloc(Math.min(size, this._fileSize - this._readPos.pos));
            const {
                bytesRead,
                bufferReadden
            } = await read(this._fd, readden, 0, readden.length, this._readPos.pos);
            this._readPos.pos += bytesRead;

            return bufferReadden;
        }

        const curBuf = this._buffers[this._readPos.nBuffer];
        const readden = curBuf.slice(this._readPos.pos, size);

        if (readden.length == 0) {
            if (this._buffers.length > this._readPos.nBuffer + 1) {
                this._readPos = {
                    nBuffer: this._readPos.nBuffer + 1,
                    pos: 0
                };

                return await this._readBuffer(size);
            }

            if (this._fileSize > 0) {
                this._readPos = {
                    nBuffer: null,
                    pos: 0
                };

                return await this._readBuffer(size);
            }

            if (this.writableFinished) {
                return null;
            }

            return undefined;
        }

        this._readPos.pos += readden.length;

        return readden;
    }
}