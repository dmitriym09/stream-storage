# Node stream storage

![Version](https://img.shields.io/badge/version-0.0.3-green.svg)
![npm](https://img.shields.io/npm/dy/stream-storage)

Simple duplex streams for cache large data in memory and files.

```
npm install stream-storage --save
```

## Usage

```js
const { StreamStorage } = require('stream-storage');
const streamStorage = new StreamStorage();
// using ...
streamStorage.destroy();
```

### stream-storage

**StreamStorage** extends the standard [stream.Duplex](https://nodejs.org/api/stream.html#stream_class_stream_duplex) interface. All writes data to this stream will accumulate in internal [Buffer](https://nodejs.org/api/buffer.html). If the internal buffer overflows it will be resized automatically. The initial size of the Buffer and the amount in which it grows can be configured in the constructor.  Data exceeding the *maxSize* of the size will be saved to a file.

You can change default options:

```js
const streamStorage = new StreamStorage({
  initialSize:      (8 * 1024),  // initial memory buffer size
  incrementAmount:  (16 * 1024), // grow size after buffer overflows
  maxSize:          (32 * 1024), // max size buffer: will be saved to a file
  tmpDir:           '.',         // temp dir for a file
  chunkSize:        (8 * 1024)   // max reading chunk
});
```

## Contributors
 * dmitriym09 <dmitriym.09.12.1989@gmail.com>
 
Thanks to the [node-stream-buffer](https://github.com/samcday/node-stream-buffer) for inspiration!

## dev

### test

For run test:
```js
npm run test
```
