# Node stream storage

![Version](https://img.shields.io/badge/version-1.0.0-green.svg)
![npm](https://img.shields.io/npm/dy/stream-storage)

Simple duplex streams for cache large data in memory and files.

## Installing

```bash
npm install stream-storage
```

## Usage

```js
import { StreamStorage } from 'stream-storage';
const streamStorage = new StreamStorage();
// using ...
streamStorage.clear();
```

### stream-storage

**StreamStorage** extends the standard [stream.Duplex](https://nodejs.org/api/stream.html#stream_class_stream_duplex) interface. All writes data to this stream will accumulate in internal [Buffers](https://nodejs.org/api/buffer.html). Data exceeding the *maxMemorySize* of the size will be saved to a file.

You can change default options:

```js
const streamStorage = new StreamStorage({
  maxMemorySize:      (32 * 1024),  // max memory size, bytes
  tmpDir:             '.',          // temp dir for a file
  pushMsec:           1,            // pushed data interval, msec
  chunkSize:          (8 * 1024),   // pushed data chunk size, bytes
});
```

For rereading data you can move current stream to new by `StreamStorage.move()`.

More using cases and examples you can see in [test](test/test.mjs).

## Contributors

- dmitriym09 <dmitriym.09.12.1989@gmail.com>

Thanks to the [node-stream-buffer](https://github.com/samcday/node-stream-buffer) for inspiration!

## dev

### test

For run test:

```js
npm run test
```

## versions

- **0.0.1** - init
- **0.0.2**
- **0.0.3**
- **0.0.4**
- **0.0.5** - fix pause
- **1.0.0** - .mjs, impl StreamStorage.move()
