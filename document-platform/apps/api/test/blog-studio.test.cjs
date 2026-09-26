const test = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');

const { SubscriptionPlanTier, CurrencyCode, PaymentProvider } = require('@prisma/client');
const { getBlogStudioAllowance } = require('../dist/blog-studio/blog-usage.service');
const { subscriptionProviderForCurrency } = require('../dist/payments/saas-subscriptions.service');
const { BlogOutboxService } = require('../dist/blog-studio/blog-outbox.service');

test('Blog Studio uses exact base allowances and add-on replacement limits', () => {
  assert.deepEqual(getBlogStudioAllowance(SubscriptionPlanTier.FREE, false), {
    blogs: 1,
    credits: 25,
  });
  assert.deepEqual(getBlogStudioAllowance(SubscriptionPlanTier.PRO, false), {
    blogs: 5,
    credits: 100,
  });
  assert.deepEqual(getBlogStudioAllowance(SubscriptionPlanTier.BUSINESS, false), {
    blogs: 15,
    credits: 300,
  });
  assert.deepEqual(getBlogStudioAllowance(SubscriptionPlanTier.BUSINESS, true), {
    blogs: 40,
    credits: 800,
  });
  assert.deepEqual(getBlogStudioAllowance(SubscriptionPlanTier.FREE, false, true), {
    blogs: 2_000_000_000,
    credits: 2_000_000_000,
  });
});

test('subscription currency routing is deterministic', () => {
  assert.equal(subscriptionProviderForCurrency(CurrencyCode.USD), PaymentProvider.STRIPE);
  assert.equal(subscriptionProviderForCurrency(CurrencyCode.INR), PaymentProvider.RAZORPAY);
});

test('Blog Studio outbox uses a stable generation job id', async () => {
  const calls = [];
  const updates = [];
  const prisma = {
    outboxEvent: {
      updateMany: async () => ({ count: 1 }),
      findUnique: async () => ({ id: 'event-1', aggregateId: 'generation-1', attemptCount: 1 }),
      update: async (value) => updates.push(value),
    },
  };
  const queue = { add: async (...args) => calls.push(args) };
  const service = new BlogOutboxService(prisma, queue);
  assert.equal(await service.publish('event-1'), true);
  assert.equal(calls[0][0], 'generate-blog');
  assert.equal(calls[0][2].jobId, 'generation-1');
  assert.equal(updates[0].data.status, 'PUBLISHED');
});
