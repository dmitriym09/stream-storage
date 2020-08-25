import { DEFAULT_MAX_MEMORY_SIZE } from '../index.mjs';

const simpleString = 'String';

const largeBlob = Buffer.alloc(DEFAULT_MAX_MEMORY_SIZE * 100);
for (let i = 0; i < largeBlob.length; i++) {
    largeBlob[i] = i % 256;
}

export { simpleString, largeBlob };
