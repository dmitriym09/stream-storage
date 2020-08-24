import {
    Writable
} from 'stream';
import fs from 'fs';
import path from 'path';
import {promisify} from 'util';

import * as constants from './constants.mjs';

const closeFd = promisify(fs.close);
const unlink = promisify(fs.unlink);

export default class StreamStorage extends Writable {
    constructor(options = {}) {
        options = Object.assign({
            // incrementAmount: constants.DEFAULT_INCREMENT_AMOUNT,
            maxMemorySize: constants.DEFAULT_MAX_MEMORY_SIZE,
            tmpDir: constants.DEFAULT_TMP_DIR,

            // chunkSize: constants.DEFAULT_CHUNK_SIZE

        }, options);

        super(options);

        this._maxMemorySize = options.maxMemorySize;

        // this._options = options;

        // this._fileProcessed = false;

        this._buffers = [];
        this._buffersSize = 0;

        // this.size = 0;
        // this._posWrite = 0;
        // 

        this._fileName = path.join(options.tmpDir,
            `.${process.pid}.${Date.now()}-${`${~~(Math.random() * 10000000)}`.padStart(8, 9)}.tmp`
        );
        this._fd = fs.openSync(this._fileName, 'w+');
        this._fileSize = 0;

        // this._timeout = null;

        // this._posRead = 0;

        // this.readable = true;
        // this.writable = true;
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


    // get posWrite() {
    //     return this._posWrite;
    // }

    // set posWrite(value) {
    //     this._posWrite = value;
    // }

    // get posRead() {
    //     return this._posRead;
    // }

    // set posRead(value) {
    //     this._posRead = value;
    // }

    // get size() {
    //     return this._size;
    // }

    // set size(value) {
    //     this._size = value;
    // }

    // get fileSize() {
    //     return this._fileSize;
    // }

    // set fileSize(value) {
    //     this._fileSize = value;
    // }

    // get fileName() {
    //     return this._fileName;
    // }

    // get bufferSize() {
    //     return this._buffer.length;
    // }

    // _writeBufferToFile(buffer) {
    //     return new Promise((resolve, reject) => {
    //         fs.write(this._fd, buffer, 0, buffer.length, this.fileSize, (err) => {
    //             if (!!err) {
    //                 return reject(err);
    //             }

    //             this.fileSize += buffer.length;

    //             resolve();
    //         });
    //     });
    // }

    // _appendFile(writeBuf, chunk) {
    //     return new Promise((resolve, reject) => {
    //         (writeBuf.length > 0 ? this._writeBufferToFile(writeBuf) : Promise.resolve())
    //         .then(() => {
    //                 this.posWrite = 0;

    //                 if (chunk.length >= this._options.maxSize) {
    //                     return this._writeBufferToFile(chunk);
    //                 } else {
    //                     chunk.copy(this._buffer, this.posWrite, 0);
    //                     this.posWrite += chunk.length;

    //                     return Promise.resolve();
    //                 }
    //             })
    //             .then(resolve)
    //             .catch(reject);
    //     });
    // }

    // _writeChunkToFile(chunk) {
    //     return new Promise((resolve, reject) => {
    //         const writeBuf = this._buffer.slice(0, this.posWrite);

    //         const to = setInterval(() => {
    //             if (this._fileProcessed) {
    //                 return;
    //             }

    //             clearInterval(to);

    //             this._fileProcessed = true;
    //             this._appendFile(writeBuf, chunk)
    //                 .then(resolve)
    //                 .catch(reject)
    //                 .finally(() => {
    //                     this._fileProcessed = false;
    //                 });
    //         }, 10);
    //     });
    // }

    // _writeChunk(chunk) {
    //     return new Promise((resolve, reject) => {
    //         if ((this._buffer.length - this.posWrite) < chunk.length) {
    //             if ((this.posWrite + chunk.length) >= this._options.maxSize) {
    //                 return this._writeChunkToFile(chunk)
    //                     .then(resolve)
    //                     .catch(reject);
    //             } else {
    //                 const factor = Math.ceil((chunk.length - (this._buffer.length - this.posWrite)) / this._options.incrementAmount);

    //                 const newBuffer = Buffer.alloc(this._buffer.length + (this._options.incrementAmount * factor));
    //                 this._buffer.copy(newBuffer, 0, 0, this.posWrite);
    //                 this._buffer = newBuffer;
    //                 chunk.copy(this._buffer, this.posWrite, 0);
    //                 this.posWrite += chunk.length;

    //                 return resolve();
    //             }
    //         } else {
    //             chunk.copy(this._buffer, this.posWrite, 0);
    //             this.posWrite += chunk.length;

    //             return resolve();
    //         }
    //     });
    // }

    // _write(chunk, encoding, cb) {
    //     this._writeChunk(chunk)
    //         .then(() => {
    //             this.size += chunk.length;
    //             cb();
    //         })
    //         .catch(cb);
    // }

    // _destroy(err, cb) {
    //     if (this.readable) {
    //         this.push(null);
    //         this.readable = false;
    //     }
    //     if (this.writable) {

    //         this.end();
    //         this.writable = false;
    //     }
    //     fs.close(this._fd, (err) => {
    //         if (!!err) {
    //             return cb(err);
    //         }
    //         fs.unlink(this.fileName, () => {
    //             this.destroyed = true;
    //             cb();
    //         });
    //     });
    // }

    // _read() {
    //     console.log('_read')
    //     this._sendDataTask();
    // }

    // _readFile(fd, buffer, offset, length, position) {
    //     return new Promise((resolve, reject) => {
    //         fs.read(fd, buffer, offset, length, position, (err, bytesRead, buffer) => {
    //             if (!!err) {
    //                 return reject(err);
    //             }

    //             resolve({
    //                 bytesRead: bytesRead,
    //                 buffer: buffer
    //             });
    //         });
    //     });
    // }

    // _pushDataFromFile(amount) {
    //     return new Promise((resolve, reject) => {
    //         let size = this.fileSize;
    //         amount = Math.min(amount, size - this.posRead);
    //         this._readFile(this._fd,
    //                 Buffer.alloc(amount),
    //                 0,
    //                 amount,
    //                 this.posRead
    //             )
    //             .then(({
    //                 buffer,
    //                 bytesRead
    //             }) => {
    //                 if (!this.isPaused()) {
    //                     const tmp = buffer.slice(0, bytesRead);
    //                     this.posRead += tmp.length;
    //                     this.push(tmp);
    //                     return Promise.resolve();
    //                 }
    //             })
    //             .then(resolve)
    //             .catch(reject);
    //     });
    // }

    // _pushData() {
    //     console.log('_pushData')

    //     return new Promise((resolve, reject) => {
    //         console.log(this.posRead, this.size, this._options.chunkSize, this.isPaused(), this.fileSize, this._fileProcessed)
    //         if (this.posRead < this.size) {
    //             const amount = Math.min(this._options.chunkSize, this.size - this.posRead);
    //             console.log(amount)
    //             if (amount > 0) {
    //                 if (this.fileSize > this.posRead) {
    //                     console.log('1--------')
    //                     if (!this._fileProcessed) {
    //                         this._fileProcessed = true;
    //                         return this._pushDataFromFile(amount)
    //                             .then(resolve)
    //                             .catch(reject)
    //                             .finally(() => {
    //                                 this._fileProcessed = false;
    //                             });
    //                     }
    //                 } else {
    //                     console.log('2--------')
    //                         const chunk = Buffer.alloc(amount);

    //                         console.log(chunk,
    //                             0,
    //                             this.posRead - this.fileSize,
    //                             amount + this.posRead - this.fileSize
    //                         )

    //                         this._buffer.copy(chunk,
    //                             0,
    //                             this.posRead - this.fileSize,
    //                             amount + this.posRead - this.fileSize
    //                         );
    //                         this.push(chunk);
    //                         this.posRead += chunk.length;
    //                 }
    //             }
    //         }

    //         resolve();
    //     });
    // }

    // _sendData() {
    //     this._timeout = null;

    //     this._pushData()
    //         .catch((err) => {
    //             throw err instanceof Error ? err : new Error(err);
    //         })
    //         .finally(() => {
    //             if ((this.size > 0 && this.posRead >= this.size && !this.writable) ||
    //                 (!this.writable && !this.readable)) {
    //                 this.push(null);
    //             } else {
    //                 this._sendDataTask();
    //             }
    //         });
    // }

    // _sendDataTask() {
    //     if (!!!this._timeout) {
    //         this._timeout = setTimeout(() => {
    //             this._sendData();
    //         }, 10);
    //     }
    // }

    // resume() {
    //     console.log('resume')
    //     this.posRead = 0;
    //     super.resume();
    //     //this._read();
    // }
}