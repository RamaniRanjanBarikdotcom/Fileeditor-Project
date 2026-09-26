const test = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
const { ConversionOutboxService } = require('../dist/conversions/conversion-outbox.service');

test('outbox publishes with a stable queue id and records success', async () => {
  const queueCalls = [];
  const updates = [];
  const queue = {
    add: async (...args) => {
      queueCalls.push(args);
    },
  };
  const prisma = {
    outboxEvent: {
      updateMany: async () => ({ count: 1 }),
      findUnique: async () => ({
        id: 'event-1',
        aggregateId: 'conversion-1',
        attemptCount: 1,
        payloadJson: {
          queueName: 'conversion-pdf',
          jobData: { conversionId: 'conversion-1' },
        },
      }),
      update: async (request) => {
        updates.push(request);
      },
    },
  };
  const service = new ConversionOutboxService(
    prisma,
    queue,
    queue,
    queue,
    queue,
    queue,
    queue,
    queue,
  );

  assert.equal(await service.publish('event-1'), true);
  assert.equal(queueCalls.length, 1);
  assert.equal(queueCalls[0][0], 'convert');
  assert.equal(queueCalls[0][2].jobId, 'conversion-1');
  assert.equal(updates[0].data.status, 'PUBLISHED');
});

test('outbox keeps failed delivery retryable', async () => {
  const updates = [];
  const queue = { add: async () => Promise.reject(new Error('queue unavailable')) };
  const prisma = {
    outboxEvent: {
      updateMany: async () => ({ count: 1 }),
      findUnique: async () => ({
        id: 'event-2',
        aggregateId: 'conversion-2',
        attemptCount: 2,
        payloadJson: {
          queueName: 'conversion-html',
          jobData: { conversionId: 'conversion-2' },
        },
      }),
      update: async (request) => {
        updates.push(request);
      },
    },
  };
  const service = new ConversionOutboxService(
    prisma,
    queue,
    queue,
    queue,
    queue,
    queue,
    queue,
    queue,
  );

  assert.equal(await service.publish('event-2'), false);
  assert.equal(updates[0].data.status, 'FAILED');
  assert.match(updates[0].data.lastError, /queue unavailable/);
  assert.ok(updates[0].data.nextAttemptAt > new Date());
});
