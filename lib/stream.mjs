import { Duplex } from 'stream';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

import * as constants from './constants.mjs';

const closeFd = promisify(fs.close);
const unlink = promisify(fs.unlink);
const read = promisify(fs.read);

export default class StreamStorage extends Duplex {
    constructor(options = {}, parent = undefined) {
        if (parent !== undefined && !(parent instanceof StreamStorage)) {
            throw new TypeError(`Error parent ${parent}`);
        }

        options = Object.assign(
            {
                maxMemorySize: constants.DEFAULT_MAX_MEMORY_SIZE,
                tmpDir: constants.DEFAULT_TMP_DIR,
                pushMsec: constants.DEFAULT_PUSH_MSEC,
                chunkSize: constants.DEFAULT_CHUNK_SIZE,
            },
            options,
        );

        super(options);

        this._options = options;

        this._maxMemorySize = options.maxMemorySize;
        this._pushMsec = options.pushMsec;

        if (parent) {
            if (parent.isMoved) {
                throw new Error('Parent stream already moved');
            }

            this._buffers = parent._buffers;
            parent._buffers = null;

            this._fileName = parent._fileName;
            parent._fileName = null;

            this._fd = parent._fd;
            parent._fd = null;

            this._buffersSize = parent._buffersSize;
            parent._buffersSize = null;

            this._fileSize = parent._fileSize;
            parent._fileSize = null;
        } else {
            this._buffers = [];
            this._fileName = path.join(
                options.tmpDir,
                `.${process.pid}.${Date.now()}-${`${~~(
                    Math.random() * 10000000
                )}`.padStart(8, 9)}.tmp`,
            );

            this._fd = fs.openSync(this._fileName, 'wx+');

            this._buffersSize = 0;
            this._fileSize = 0;
        }
        this._timer = null;

        this._chunkSize = options.chunkSize;

        this._readPos = {
            nBuffer: 0,
            pos: 0,
        };
    }

    get size() {
        if (this.isMoved) {
            throw new Error('Stream was moved');
        }

        return this._buffersSize + this._fileSize;
    }

    _write(chunk, encoding, callback) {
        if (this._fd === null) {
            return callback(new Error('Stream is cleared'));
        }

        if (this.isMoved) {
            return callback(new Error('Stream was moved'));
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
                this._buffersSize += chunkPos;
            }
        }

        if (chunkPos < chunk.length) {
            const bufferToWrite = chunk.slice(freeInBuffer);
            fs.write(
                this._fd,
                bufferToWrite,
                0,
                bufferToWrite.length,
                this._fileSize,
                err => {
                    if (err) {
                        return callback(err);
                    }
                    const bufferToWrite = chunk.slice(freeInBuffer);
                    this._fileSize += bufferToWrite.length;

                    callback(null);
                },
            );
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
        if (this.isMoved) {
            return this.destroy('Stream was moved');
        }

        if (!this._timer) {
            let isProcessed = false;
            this._timer = setInterval(() => {
                if (isProcessed) return;
                isProcessed = true;

                this._readBuffer(size || this._chunkSize)
                    .then(buffer => {
                        if (!this.push(buffer)) {
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

    get isMoved() {
        return (
            this._buffers === null ||
            this._fileName === null ||
            this._fd === null ||
            this._buffersSize === null ||
            this._fileSize === null
        );
    }

    async _readBuffer(size) {
        if (this.isMoved) {
            throw new Error('Stream was moved');
        }

        if (this._readPos.nBuffer === null) {
            if (this._fileSize <= this._readPos.pos) {
                if (this.writableFinished) {
                    return null;
                }

                return undefined;
            }

            const readden = Buffer.alloc(
                Math.min(size, this._fileSize - this._readPos.pos),
            );
            const { bytesRead } = await read(
                this._fd,
                readden,
                0,
                readden.length,
                this._readPos.pos,
            );
            this._readPos.pos += bytesRead;

            return readden;
        }

        if(this._buffers.length === 0) {
            if(!this.writable) {
                return null;
            }

            return undefined;
        }

        const curBuf = this._buffers[this._readPos.nBuffer];
        const readden = curBuf.slice(
            this._readPos.pos,
            size + this._readPos.pos,
        );

        if (readden.length == 0) {
            if (this._buffers.length > this._readPos.nBuffer + 1) {
                this._readPos = {
                    nBuffer: this._readPos.nBuffer + 1,
                    pos: 0,
                };

                return await this._readBuffer(size);
            }

            if (this._fileSize > 0) {
                this._readPos = {
                    nBuffer: null,
                    pos: 0,
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

    move() {
        if (this.isMoved) {
            throw new Error('Stream was moved');
        }

        return new StreamStorage(this._options, this);
    }
}
