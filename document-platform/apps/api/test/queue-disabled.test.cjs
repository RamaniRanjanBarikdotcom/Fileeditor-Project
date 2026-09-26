const test = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
const { ConversionsService } = require('../dist/conversions/conversions.service');

test('server conversion fails closed before database or queue access when Redis is disabled', async () => {
  const previous = process.env.REDIS_ENABLED;
  process.env.REDIS_ENABLED = 'false';
  try {
    const unreachable = new Proxy(
      {},
      {
        get() {
          throw new Error('A disabled conversion must not access infrastructure');
        },
      },
    );
    const service = new ConversionsService(
      unreachable,
      unreachable,
      unreachable,
      unreachable,
      unreachable,
      unreachable,
      unreachable,
      unreachable,
      unreachable,
      unreachable,
    );
    await assert.rejects(
      service.createConversion('user', 'organization', {
        sourceFileId: 'file',
        targetFormat: 'pdf',
      }),
      (error) => error?.status === 503 && /workers are disabled/i.test(error.message),
    );
  } finally {
    if (previous === undefined) delete process.env.REDIS_ENABLED;
    else process.env.REDIS_ENABLED = previous;
  }
});
