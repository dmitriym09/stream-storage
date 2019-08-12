'use strict';

const fs = require('fs');

const {
  assert,
  expect
} = require('chai');
const {
  StreamStorage,
  DEFAULT_INITIAL_SIZE,
  DEFAULT_MAX_SIZE
} = require('..');

let MAX_CNT = parseInt(process.env.MAX_CNT);
if(isNaN(MAX_CNT)) {
  MAX_CNT = 1e3;
}

let MAX_LEN = parseInt(process.env.MAX_LEN);
if(isNaN(MAX_LEN)) {
  MAX_LEN = 1e4;
}

const data = require('./data');

const randomInt = (min, max) => {
  return Math.floor(Math.random() * (max - min)) + min;
};

describe('StreamStorage', function () {
  beforeEach(function () {
    this.len = 0;
    this.stream = new StreamStorage();
  });

  it('defaults', function () {
    expect(this.stream.bufferSize).to.equal(DEFAULT_INITIAL_SIZE);
    expect(this.stream.fileSize).to.equal(0);
  });

  describe('simple string', function () {
    beforeEach(function () {
      return new Promise((resolve) => {
        this.chunks = [];
        const onEnd = () => {
          if (!this.stream.readable && !this.stream.writable) {
            resolve();
          }
        };
        this.stream.on('end', onEnd);
        this.stream.on('finish', onEnd);

        this.stream.on('data', (chunk) => {
          this.chunks.push(chunk);
        });
        this.len = data.simpleString.length;
        this.stream.end(data.simpleString);
      });
    });

    it('length', function () {
      expect(this.stream.size).to.equal(this.len);
    });

    it('buffer size', function () {
      expect(this.stream.bufferSize).to.equal(DEFAULT_INITIAL_SIZE);
    });

    it('file size', function () {
      expect(this.stream.fileSize).to.equal(0);
    });

    it('content', function () {
      expect(Buffer.concat([
        fs.existsSync(this.stream.fileName) ? fs.readFileSync(this.stream.fileName) : Buffer.alloc(0), this.stream._buffer.slice(0, this.stream.posWrite)
      ]).toString()).to.equal(data.simpleString);
    });

    it('read', function () {
      expect(Buffer.concat(this.chunks).toString()).to.equal(data.simpleString);
    });

    afterEach(function () {
      this.stream.destroy();
    });
  });

  describe('disk usage', function () {
    beforeEach(function () {
      return new Promise((resolve) => {
        this.chunks = [];
        const onEnd = () => {
          if (!this.stream.readable && !this.stream.writable) {
            resolve();
          }
        };
        this.stream.on('end', onEnd);
        this.stream.on('finish', onEnd);

        this.stream.on('data', (chunk) => {
          this.chunks.push(chunk);
        });
        this.len = data.largeBlob.length;
        this.stream.write(data.largeBlob);
        this.stream.end();
      });
    });

    it('length', function () {
      expect(this.stream.size).to.equal(this.len);
    });

    it('file size', function () {
      expect(this.stream.fileSize).to.equal(this.stream.size - this.stream.posWrite);
    });

    it('content', function () {
      assert.isTrue(Buffer.concat([
        fs.existsSync(this.stream.fileName) ? fs.readFileSync(this.stream.fileName) : Buffer.alloc(0), this.stream._buffer.slice(0, this.stream.posWrite)
      ]).compare(data.largeBlob) === 0);
    });

    it('read', function () {
      assert.isTrue(data.largeBlob.compare(Buffer.concat(this.chunks)) === 0);
    });
  });

  describe('random', function () {
    this.beforeEach(async function () {
      this.timeout(-1);

      return new Promise((resolve) => {
        this.len = 0;
        this.chunks = [];
        this.blob = [];

        const onEnd = () => {
          if (!this.stream.readable && !this.stream.writable) {
            resolve();
          }
        };
        this.stream.on('end', onEnd);
        this.stream.on('finish', onEnd);

        let nChunk = 0;
        this.stream.on('data', (chunk) => {
          this.chunks.push(chunk);
          nChunk++;
        });

        const nIter = randomInt(1, MAX_CNT);
        for (let i = 0; i < nIter; ++i) {
          const blob = Buffer.alloc(randomInt(1, MAX_LEN));
          for (let j = 0; j < blob.length; ++j) {
            blob[j] = randomInt(0, 255);
          }
          this.len += blob.length;
          this.stream.write(blob);
          this.blob.push(blob);
        }

        this.stream.end();
      });
    });

    it('length', function () {
      expect(this.stream.size).to.equal(this.len);
    });

    it('file size', function () {
      expect(this.stream.fileSize).to.equal(this.stream.size - this.stream.posWrite);
    });

    it('content', function () {
      const blob = Buffer.concat(this.blob);
      assert.isTrue(Buffer.concat([
        fs.existsSync(this.stream.fileName) ? fs.readFileSync(this.stream.fileName) : Buffer.alloc(0), this.stream._buffer.slice(0, this.stream.posWrite)
      ]).compare(blob) === 0);
    }).timeout(-1);

    it('read', function () {
      const chunks = Buffer.concat(this.chunks);
      const blob = Buffer.concat(this.blob)

      assert.isTrue(blob.compare(chunks) === 0);
    }).timeout(-1);
  });

  afterEach(function () {
    this.stream.destroy();
  });
});