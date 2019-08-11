'use strict';

const expect = require('chai').expect;
const {
  StreamStorage,
  DEFAULT_INITIAL_SIZE,
  DEFAULT_MAX_SIZE
} = require('..');

const data = require('./data');

const randomInt = (min, max) => {
  return Math.floor(Math.random() * (max - min)) + min;
}

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
        this.stream.on('data', (chunk) => {
          console.log(chunk);
        });
        this.stream.on('end', (chunk) => {
          console.log('end');
        });
        this.stream.on('finish', resolve);
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

    afterEach(function () {
      this.stream.destroy();
    });
  });

  describe('disk usage', function () {
    beforeEach(function () {
      return new Promise((resolve) => {
        this.len = 0;

        this.stream.on('finish', resolve);

        this.len = data.largeBlob.length;
        this.stream.end(data.largeBlob);
      });
    });

    it('length', function () {
      expect(this.stream.size).to.equal(this.len);
    });

    it('file size', function () {
      expect(this.stream.fileSize).to.equal(this.stream.size - this.stream.pos);
    });
  });

  describe('random', function () {
    this.beforeEach(async function () {
      this.timeout(-1);

      return new Promise((resolve) => {
        this.len = 0;

        this.stream.on('finish', resolve);

        const nIter = randomInt(1, 1e3);
        for (let i = 0; i < nIter; ++i) {
          const blob = Buffer.alloc(randomInt(1, 1e4));
          for (let j = 0; j < blob.length; j++) {
            blob[j] = j % 256;
          }
          this.len += blob.length;
          this.stream.write(blob);
        }

        this.stream.end();
      });
    });

    it('length', function () {
      expect(this.stream.size).to.equal(this.len);
    });

    it('file size', function () {
      expect(this.stream.fileSize).to.equal(this.stream.size - this.stream.pos);
    });
  });

  afterEach(function () {
    this.stream.destroy();
  });
});