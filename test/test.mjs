import fs from 'fs';

import chai from 'chai';

const {
    assert,
    expect
} = chai;

import {
    StreamStorage
} from '../index.mjs';

let MAX_CNT = parseInt(process.env.MAX_CNT);
if (isNaN(MAX_CNT)) {
    MAX_CNT = 1e3;
}

let MAX_LEN = parseInt(process.env.MAX_LEN);
if (isNaN(MAX_LEN)) {
    MAX_LEN = 1e4;
}

import {
    simpleString,
    largeBlob
} from './data.mjs';

const randomInt = (min, max) => {
    return Math.floor(Math.random() * (max - min)) + min;
};

describe('StreamStorage', () => {
    describe('Writable', () => {
        describe('memory', () => {
            const stream = new StreamStorage({
                maxMemorySize: simpleString.length,
            });

            before(done => {
                stream.on('finish', done);
                stream.end(simpleString);
            });

            after(async () => {
                await stream.clear();
            });

            it('content', () => {
                expect(stream.size).to.equal(simpleString.length);
                expect(Buffer.concat(stream._buffers).toString()).to.equal(
                    simpleString,
                );
            });
        });

        describe('fs', () => {
            const stream = new StreamStorage({
                maxMemorySize: simpleString.length,
            });

            before(done => {
                stream.on('finish', done);
                stream.write(simpleString);
                stream.write(simpleString);
                stream.end(simpleString);
            });

            it('content', () => {
                expect(stream.size).to.equal(simpleString.length * 3);
                expect(
                    Buffer.concat(stream._buffers).toString() +
                    fs.readFileSync(stream._fileName),
                ).to.equal(simpleString + simpleString + simpleString);
            });

            it('clear', async () => {
                await stream.clear();
            });
        });
    });

    describe('Readable', () => {
        describe('memory', () => {
            const stream = new StreamStorage({
                maxMemorySize: simpleString.length,
            });

            before(done => {
                stream.on('finish', done);
                stream.end(simpleString);
            });

            after(async () => {
                await stream.clear();
            });

            it('content', done => {
                const chunks = [];
                const onEnd = () => {
                    if (!stream.readable && !stream.writable) {
                        const readed = Buffer.concat(chunks).toString();
                        expect(readed).to.equal(simpleString);
                        done();
                    }
                };

                stream.on('end', onEnd);
                stream.on('finish', onEnd);

                stream.on('data', chunk => {
                    chunks.push(chunk);
                });
            });
        });

        describe('fs', () => {
            const stream = new StreamStorage({
                maxMemorySize: simpleString.length,
            });

            before(done => {
                stream.on('finish', done);
                stream.write(simpleString);
                stream.write(simpleString);
                stream.end(simpleString);
            });

            it('content', done => {
                const chunks = [];
                const onEnd = () => {
                    if (!stream.readable && !stream.writable) {
                        expect(
                            Buffer.concat(stream._buffers).toString() +
                            fs.readFileSync(stream._fileName),
                        ).to.equal(simpleString + simpleString + simpleString);
                        expect(Buffer.concat(chunks).toString()).to.equal(
                            simpleString + simpleString + simpleString,
                        );
                        done();
                    }
                };

                stream.on('end', onEnd);
                stream.on('finish', onEnd);

                stream.on('data', chunk => {
                    chunks.push(chunk);
                });
            });

            it('clear', async () => {
                await stream.clear();
            });
        });
    });

    describe('Duplex', () => {
        describe('pipeline', () => {
            const data = '1234567890ABCabc---((()))';
            const gen = (function* () {
                for (const ch of data) {
                    yield ch;
                }
            })();

            let stream = new StreamStorage({
                maxMemorySize: 2,
            });

            const chunks = [];

            before(done => {
                const onEnd = () => {
                    if (!stream.readable && !stream.writable) {
                        done();
                    }
                };

                const writeCh = () => {
                    const {
                        done,
                        value
                    } = gen.next();
                    if (done) {
                        stream.end();
                    } else {
                        stream.write(value);
                    }
                };

                stream.on('finish', onEnd);
                stream.on('end', onEnd);
                stream.on('data', chunk => {
                    chunks.push(chunk);
                    writeCh();
                });
                writeCh();
            });

            after(async () => {
                await stream.clear();
            });

            it('content', () => {
                expect(Buffer.concat(chunks).toString()).to.equal(data);
            });

            it('moved', done => {
                const repeatChunks = [];
                const newStream = stream.move();

                assert.isTrue(stream.isMoved);
                assert.isTrue(!newStream.isMoved);

                stream = newStream;

                stream
                    .on('end', () => {
                        expect(Buffer.concat(repeatChunks).toString()).to.equal(
                            data,
                        );
                        done();
                    })
                    .on('data', chunk => {
                        repeatChunks.push(chunk);
                    })
                    .end();
            });
        });

        describe('largeBlob', () => {
            const stream = new StreamStorage();

            const chunks = [];

            before(done => {
                const onEnd = () => {
                    if (!stream.readable && !stream.writable) {
                        done();
                    }
                };

                stream.on('finish', onEnd);
                stream.on('end', onEnd);
                stream.on('data', chunk => {
                    chunks.push(chunk);
                });
                stream.end(largeBlob);
            });

            after(async () => {
                await stream.clear();
            });

            it('content', () => {
                assert.isTrue(largeBlob.compare(Buffer.concat(chunks)) === 0);
            });
        });

        describe('largeBlob random write', () => {
            const stream = new StreamStorage();

            const chunks = [];

            const gen = (function* () {
                let start = 0;
                let end = 0;
                while (end < largeBlob.length) {
                    end = Math.min(largeBlob.length, end + randomInt(1, 0xfff));
                    yield largeBlob.slice(start, end);
                    start = end;
                }
            })();

            before(function (done) {
                this.timeout(60000);
                const onEnd = () => {
                    if (!stream.readable && !stream.writable) {
                        done();
                    }
                };

                const write = () => {
                    const {
                        done,
                        value
                    } = gen.next();
                    if (done) {
                        stream.end();
                    } else {
                        stream.write(value);
                    }
                };

                stream.on('finish', onEnd);
                stream.on('end', onEnd);
                stream.on('data', chunk => {
                    chunks.push(chunk);
                    write();
                });
                write();
            });

            after(async () => {
                await stream.clear();
            });

            it('content', () => {
                assert.isTrue(largeBlob.compare(Buffer.concat(chunks)) === 0);
            });
        });


        describe('empty', () => {
            const chunks = [];
            const stream = new StreamStorage();

            before(done => {
                const onEnd = () => {
                    if (!stream.readable && !stream.writable) {
                        done();
                    }
                };

                stream.on('finish', onEnd);
                stream.on('end', onEnd);
                stream.on('data', chunk => {
                    chunks.push(chunk);
                });
                stream.end();
            });

            it('size', () => {
                expect(stream.size).to.equal(0);
            });

            it('content', () => {
                expect(chunks.length).to.equal(0);
            });

            after(async () => {
                await stream.clear();
            });
        });

    });
});