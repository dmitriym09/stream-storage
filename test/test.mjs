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

describe('StreamStorage', function () {
  describe('Writable', function () {
    describe('memory', function () {
      const stream = new StreamStorage({
        maxMemorySize: simpleString.length
      });

      before(function (done) {
        stream.on('finish', done);
        stream.end(simpleString)
      });

      after(async function() {
        await stream.clear();
      })

      it('content', function () {
        expect(stream.size).to.equal(simpleString.length)
        expect(Buffer.concat(stream._buffers).toString()).to.equal(simpleString)
      })
    })

    describe('fs', function () {
      const stream = new StreamStorage({
        maxMemorySize: simpleString.length
      });

      before(function (done) {
        stream.on('finish', done);
        stream.write(simpleString);
        stream.write(simpleString);
        stream.end(simpleString);
      });

      it('content', function () {
        expect(stream.size).to.equal(simpleString.length * 3)
        expect(Buffer.concat(stream._buffers).toString() + fs.readFileSync(stream._fileName)).to.equal(simpleString + simpleString + simpleString);
      });

      it('clear', async function () {
        await stream.clear()
      });
    })

  })


});

// describe('StreamStorage', function () {
//   beforeEach(function () {
//     // this.len = 0;
//     // this.stream = new StreamStorage();
//   });

//   it('defaults', function () {
//     // expect(this.stream.bufferSize).to.equal(DEFAULT_INITIAL_SIZE);
//     // expect(this.stream.fileSize).to.equal(0);
//   });

//   describe('destroy', function () {
//     // it('free', function () {
//     //   const stream = new StreamStorage();
//     //   stream.destroy();
//     // });

//     // it('on read', function () {
//     //   return new Promise(resolve => {
//     //     const stream = new StreamStorage();
//     //     const onEnd = () => {
//     //       if (!stream.readable && !stream.writable) {
//     //         resolve();
//     //       }
//     //     };
//     //     stream.on('end', onEnd);
//     //     stream.on('finish', onEnd);

//     //     stream.on('data', () => {});
//     //     stream.destroy();
//     //   });
//     // });
//   });

//   describe('simple string', function () {
//     beforeEach(function () {
//       return new Promise(resolve => {
//         this.chunks = [];
//         const onEnd = () => {
//           if (!this.stream.readable && !this.stream.writable) {
//             resolve();
//           }
//         };
//         this.stream.on('end', onEnd);
//         this.stream.on('finish', onEnd);

//         this.stream.on('data', chunk => {
//           console.log('chunk1')
//           this.chunks.push(chunk);
//         });
//         this.len = simpleString.length;
//         this.stream.end(simpleString);
//       });
//     });

//     // it('length', function () {
//     //   expect(this.stream.size).to.equal(this.len);
//     // });

//     // it('buffer size', function () {
//     //   expect(this.stream.bufferSize).to.equal(DEFAULT_INITIAL_SIZE);
//     // });

//     // it('file size', function () {
//     //   expect(this.stream.fileSize).to.equal(0);
//     // });

//     // it('content', function () {
//     //   expect(Buffer.concat([
//     //     fs.existsSync(this.stream.fileName) ? fs.readFileSync(this.stream.fileName) : Buffer.alloc(0), this.stream._buffer.slice(0, this.stream.posWrite)
//     //   ]).toString()).to.equal(simpleString);
//     // });

//     // it('chunks', function () {
//     //   expect(Buffer.concat(this.chunks).toString()).to.equal(simpleString);
//     // });

//   //   it('resume', function (done) {
//   //     console.log('\n\n\n\n>>>')

//   //     console.log(this.stream.posWrite);
//   //     console.log(this.stream.posRead);

//   //     const chunks = [];
//   //       const onEnd = () => {
//   //         console.log('onEnd')
//   //         if (!this.stream.readable && !this.stream.writable) {
//   //           done();
//   //         }
//   //       };
//   //       this.stream.on('end', onEnd);
//   //       this.stream.on('finish', onEnd);

//   //       this.stream.on('data', chunk => {
//   //         console.log('chink2')
//   //         this.chunks.push(chunk);
//   //       });
//   //       console.log(this.stream.posWrite);
//   //       console.log(this.stream.posRead);
//   //       this.stream.resume();
//   //       console.log(this.stream)
//   //       //
//   //   });

//   //   afterEach(function () {
//   //     this.stream.destroy();
//   //   });
//    });

//   // describe('disk usage', function () {
//   //   beforeEach(function () {
//   //     return new Promise(resolve => {
//   //       this.chunks = [];
//   //       const onEnd = () => {
//   //         if (!this.stream.readable && !this.stream.writable) {
//   //           resolve();
//   //         }
//   //       };
//   //       this.stream.on('end', onEnd);
//   //       this.stream.on('finish', onEnd);

//   //       this.stream.on('data', chunk => {
//   //         this.chunks.push(chunk);
//   //       });
//   //       this.len = largeBlob.length;
//   //       this.stream.write(largeBlob);
//   //       this.stream.end();
//   //     });
//   //   });

//   //   it('length', function () {
//   //     expect(this.stream.size).to.equal(this.len);
//   //   });

//   //   it('file size', function () {
//   //     expect(this.stream.fileSize).to.equal(this.stream.size - this.stream.posWrite);
//   //   });

//   //   it('content', function () {
//   //     assert.isTrue(Buffer.concat([
//   //       fs.existsSync(this.stream.fileName) ? fs.readFileSync(this.stream.fileName) : Buffer.alloc(0), this.stream._buffer.slice(0, this.stream.posWrite)
//   //     ]).compare(largeBlob) === 0);
//   //   });

//   //   it('read', function () {
//   //     assert.isTrue(largeBlob.compare(Buffer.concat(this.chunks)) === 0);
//   //   });
//   // });

//   // describe('random', function () {
//   //   this.beforeEach(async function () {
//   //     this.timeout(-1);

//   //     return new Promise((resolve) => {
//   //       this.len = 0;
//   //       this.chunks = [];
//   //       this.blob = [];

//   //       const onEnd = () => {
//   //         if (!this.stream.readable && !this.stream.writable) {
//   //           resolve();
//   //         }
//   //       };
//   //       this.stream.on('end', onEnd);
//   //       this.stream.on('finish', onEnd);

//   //       let nChunk = 0;
//   //       this.stream.on('data', (chunk) => {
//   //         this.chunks.push(chunk);
//   //         nChunk++;
//   //       });

//   //       const nIter = randomInt(1, MAX_CNT);
//   //       for (let i = 0; i < nIter; ++i) {
//   //         const blob = Buffer.alloc(randomInt(1, MAX_LEN));
//   //         for (let j = 0; j < blob.length; ++j) {
//   //           blob[j] = randomInt(0, 255);
//   //         }
//   //         this.len += blob.length;
//   //         this.stream.write(blob);
//   //         this.blob.push(blob);
//   //       }

//   //       this.stream.end();
//   //     });
//   //   });

//   //   it('length', function () {
//   //     expect(this.stream.size).to.equal(this.len);
//   //   });

//   //   it('file size', function () {
//   //     expect(this.stream.fileSize).to.equal(this.stream.size - this.stream.posWrite);
//   //   });

//   //   it('content', function () {
//   //     const blob = Buffer.concat(this.blob);
//   //     assert.isTrue(Buffer.concat([
//   //       fs.existsSync(this.stream.fileName) ? fs.readFileSync(this.stream.fileName) : Buffer.alloc(0), this.stream._buffer.slice(0, this.stream.posWrite)
//   //     ]).compare(blob) === 0);
//   //   }).timeout(-1);

//   //   it('read', function () {
//   //     const chunks = Buffer.concat(this.chunks);
//   //     const blob = Buffer.concat(this.blob)

//   //     assert.isTrue(blob.compare(chunks) === 0);
//   //   }).timeout(-1);
//   // });

//   // afterEach(function () {
//   //   this.stream.destroy();
//   // });
// });