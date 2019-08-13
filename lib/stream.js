'use strict';

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
            tmpDir: constants.DEFAULT_TMP_DIR,

            chunkSize: constants.DEFAULT_CHUNK_SIZE

        }, options);

        super(options);

        this._options = options;

        this._fileProcessed = false;

        this._buffer = Buffer.alloc(this._options.initialSize);
        this._size = 0;
        this._posWrite = 0;
        this._fileSize = 0;

        this._fileName = path.join(this._options.tmpDir,
            `.${process.pid}.${Date.now()}-${`${~~(Math.random() * 10000000)}`.padStart(8, 9)}.tmp`
        );

        this._fd = fs.openSync(this._fileName, 'w+');

        this._timeout = null;

        this._posRead = 0;

        this.readable = true;
        this.writable = true;
    }

    get posWrite() {
        return this._posWrite;
    }

    get posRead() {
        return this._posRead;
    }

    get size() {
        return this._size;
    }

    get fileSize() {
        return this._fileSize;
    }

    get fileName() {
        return this._fileName;
    }

    get bufferSize() {
        return this._buffer.length;
    }

    _writeBufferToFile(buffer) {
        return new Promise((resolve, reject) => {
            fs.write(this._fd, buffer, 0, buffer.length, this._fileSize, (err) => {
                if (!!err) {
                    return reject(err);
                }

                this._fileSize += buffer.length;

                resolve();
            });
        });
    }

    _appendFile(writeBuf, chunk) {
        return new Promise((resolve, reject) => {
            (writeBuf.length > 0 ? this._writeBufferToFile(writeBuf) : Promise.resolve())
            .then(() => {
                    this._posWrite = 0;

                    if (chunk.length >= this._options.maxSize) {
                        return this._writeBufferToFile(chunk);
                    } else {
                        chunk.copy(this._buffer, this.posWrite, 0);
                        this._posWrite += chunk.length;

                        return Promise.resolve();
                    }
                })
                .then(resolve)
                .catch(reject);
        });
    }

    _writeChunkToFile(chunk) {
        return new Promise((resolve, reject) => {
            const writeBuf = this._buffer.slice(0, this.posWrite);

            const to = setInterval(() => {
                if (this._fileProcessed) {
                    return;
                }

                clearInterval(to);

                this._fileProcessed = true;
                this._appendFile(writeBuf, chunk)
                    .then(resolve)
                    .catch(reject)
                    .finally(() => {
                        this._fileProcessed = false;
                    });
            }, 10);
        });
    }

    _writeChunk(chunk) {
        return new Promise((resolve, reject) => {
            if ((this._buffer.length - this.posWrite) < chunk.length) {
                if ((this.posWrite + chunk.length) >= this._options.maxSize) {
                    return this._writeChunkToFile(chunk)
                        .then(resolve)
                        .catch(reject);
                } else {
                    const factor = Math.ceil((chunk.length - (this._buffer.length - this.posWrite)) / this._options.incrementAmount);

                    const newBuffer = Buffer.alloc(this._buffer.length + (this._options.incrementAmount * factor));
                    this._buffer.copy(newBuffer, 0, 0, this.posWrite);
                    this._buffer = newBuffer;
                    chunk.copy(this._buffer, this.posWrite, 0);
                    this._posWrite += chunk.length;

                    return resolve();
                }
            } else {
                chunk.copy(this._buffer, this.posWrite, 0);
                this._posWrite += chunk.length;

                return resolve();
            }
        });
    }

    _write(chunk, encoding, cb) {
        this._writeChunk(chunk)
            .then(() => {
                this._size += chunk.length;
                cb();
            })
            .catch(cb);
    }

    _destroy(err, cb) {
        if (this.readable) {
            this.push(null);
            this.readable = false;
        }
        if (this.writable) {

            this.end();
            this.writable = false;
        }
        fs.close(this._fd, (err) => {
            if (!!err) {
                return cb(err);
            }
            fs.unlink(this.fileName, () => {
                this.destroyed = true;
                cb();
            });
        });
    }

    _read() {
        this._sendDataTask();
    }

    _readFile(fd, buffer, offset, length, position) {
        return new Promise((resolve, reject) => {
            fs.read(fd, buffer, offset, length, position, (err, bytesRead, buffer) => {
                if (!!err) {
                    return reject(err);
                }

                resolve({
                    bytesRead: bytesRead,
                    buffer: buffer
                });
            });
        });
    }

    _pushDataFromFile(amount) {
        return new Promise((resolve, reject) => {
            let size = this._fileSize;
            amount = Math.min(amount, size - this.posRead);
            this._readFile(this._fd,
                    Buffer.alloc(amount),
                    0,
                    amount,
                    this.posRead
                )
                .then(({
                    buffer,
                    bytesRead
                }) => {
                    const tmp = buffer.slice(0, bytesRead);
                    this._posRead += tmp.length;
                    this.push(tmp);
                    return Promise.resolve();
                })
                .then(resolve)
                .catch(reject);
        });
    }

    _pushData() {
        return new Promise((resolve, reject) => {
            if (this.posRead < this.size) {
                const amount = Math.min(this._options.chunkSize, this.size - this.posRead);
                if (amount > 0) {
                    if (this.fileSize > this.posRead) {
                        if (!this._fileProcessed) {
                            this._fileProcessed = true;
                            return this._pushDataFromFile(amount)
                                .then(resolve)
                                .catch(reject)
                                .finally(() => {
                                    this._fileProcessed = false;
                                });
                        }
                    } else {
                        const chunk = Buffer.alloc(amount);

                        this._buffer.copy(chunk,
                            0,
                            this._posRead - this._fileSize,
                            amount + this._posRead - this._fileSize
                        );
                        this.push(chunk);
                        this._posRead += chunk.length;
                    }
                }
            }

            resolve();
        });
    }

    _sendData() {
        this._timeout = null;

        this._pushData()
            .catch((err) => {
                throw err instanceof Error ? err : new Error(err);
            })
            .finally(() => {
                if ((this.size > 0 && this.posRead >= this.size && !this.writable) ||
                    (!this.writable && !this.readable)) {
                    this.push(null);
                } else {
                    this._sendDataTask();
                }
            });
    }

    _sendDataTask() {
        if (!!!this._timeout) {
            this._timeout = setTimeout(() => {
                this._sendData();
            }, 10);
        }
    }
}

module.exports = StreamStorage;