const test = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');

const { BadRequestException } = require('@nestjs/common');
const { WebhooksController } = require('../dist/payments/webhooks.controller');

function createHarness(overrides = {}) {
  const fulfilled = [];
  const synced = [];
  const updates = [];
  const upserts = [];
  const stripeEvent = overrides.stripeEvent;
  const stripe = {
    constructWebhookEvent: () => {
      if (overrides.stripeError) throw overrides.stripeError;
      return stripeEvent;
    },
    retrieveSubscription: async () => overrides.stripeSubscription,
  };
  const razorpay = {
    verifyWebhookSignature: () => overrides.razorpayValid !== false,
  };
  const payments = {
    fulfillOrder: async (input) => fulfilled.push(input),
  };
  const subscriptions = {
    syncProviderSubscription: async (input) => synced.push(input),
  };
  const prisma = {
    webhookEvent: {
      findUnique: async () => overrides.existingEvent || null,
      upsert: async (input) => {
        upserts.push(input);
        return { id: 'webhook-row-1' };
      },
      update: async (input) => updates.push(input),
    },
  };
  return {
    controller: new WebhooksController(stripe, razorpay, payments, subscriptions, prisma),
    fulfilled,
    synced,
    updates,
    upserts,
  };
}

test('Stripe rejects a webhook when signature verification fails', async () => {
  const { controller } = createHarness({ stripeError: new Error('invalid signature') });
  await assert.rejects(
    controller.handleStripeWebhook({ rawBody: Buffer.from('{}') }, 'bad-signature'),
    BadRequestException,
  );
});

test('Stripe checkout fulfillment is idempotent and marks the event processed', async () => {
  const event = {
    id: 'evt_checkout_1',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_1',
        mode: 'payment',
        client_reference_id: 'order-1',
        payment_intent: 'pi_1',
      },
    },
  };
  const first = createHarness({ stripeEvent: event });
  assert.deepEqual(
    await first.controller.handleStripeWebhook({ rawBody: Buffer.from('{}') }, 'signature'),
    { received: true },
  );
  assert.equal(first.fulfilled.length, 1);
  assert.equal(first.fulfilled[0].orderId, 'order-1');
  assert.equal(first.upserts.length, 1);
  assert.equal(first.updates.length, 1);

  const replay = createHarness({
    stripeEvent: event,
    existingEvent: { id: 'webhook-row-1', processedAt: new Date() },
  });
  await replay.controller.handleStripeWebhook({ rawBody: Buffer.from('{}') }, 'signature');
  assert.equal(replay.fulfilled.length, 0);
  assert.equal(replay.upserts.length, 0);
  assert.equal(replay.updates.length, 0);
});

test('Razorpay rejects invalid signatures before persistence or fulfillment', async () => {
  const { controller, upserts, fulfilled } = createHarness({ razorpayValid: false });
  await assert.rejects(
    controller.handleRazorpayWebhook({ rawBody: Buffer.from('{}'), body: {} }, 'bad-signature'),
    BadRequestException,
  );
  assert.equal(upserts.length, 0);
  assert.equal(fulfilled.length, 0);
});

test('Razorpay subscription events synchronize entitlement state once', async () => {
  const body = {
    event_id: 'rzp_event_1',
    event: 'subscription.activated',
    payload: {
      subscription: {
        entity: {
          id: 'sub_1',
          status: 'active',
          current_start: 1_800_000_000,
          current_end: 1_802_678_400,
          notes: { organizationId: 'org-1', productId: 'product-1' },
        },
      },
    },
  };
  const harness = createHarness();
  await harness.controller.handleRazorpayWebhook(
    { rawBody: Buffer.from(JSON.stringify(body)), body },
    'signature',
  );
  assert.equal(harness.synced.length, 1);
  assert.equal(harness.synced[0].organizationId, 'org-1');
  assert.equal(harness.synced[0].productId, 'product-1');
  assert.equal(harness.synced[0].providerSubId, 'sub_1');
  assert.equal(harness.updates.length, 1);
});

const { SaasSubscriptionsService } = require('../dist/payments/saas-subscriptions.service');

function subscriptionHarness(existing) {
  const upserts = [];
  const audits = [];
  const tx = {
    saasSubscription: {
      findUnique: async () => existing,
      upsert: async (input) => {
        upserts.push(input);
        return { id: existing?.id || 'sub-row-1', ...input.update };
      },
    },
    auditLog: { create: async (input) => audits.push(input.data) },
  };
  const prisma = { $transaction: async (callback) => callback(tx) };
  return {
    service: new SaasSubscriptionsService(prisma, {}, {}, {}),
    upserts,
    audits,
  };
}

const syncInput = (overrides) => ({
  organizationId: 'org-1',
  productId: 'product-1',
  provider: 'STRIPE',
  providerSubId: 'sub_current',
  currency: 'USD',
  status: 'ACTIVE',
  currentPeriodStart: new Date('2026-10-01T00:00:00Z'),
  currentPeriodEnd: new Date('2026-11-01T00:00:00Z'),
  eventType: 'customer.subscription.updated',
  ...overrides,
});

test('a late update cannot reactivate a canceled provider subscription', async () => {
  const { service, upserts, audits } = subscriptionHarness({
    id: 'row-1',
    providerSubId: 'sub_current',
    status: 'CANCELED',
  });
  await service.syncProviderSubscription(syncInput({ status: 'ACTIVE' }));
  assert.equal(upserts.length, 0);
  assert.equal(audits[0].action, 'SAAS_SUBSCRIPTION_STALE_EVENT_IGNORED');
});

test('an event for a superseded subscription cannot deactivate the current one', async () => {
  const { service, upserts } = subscriptionHarness({
    id: 'row-1',
    providerSubId: 'sub_current',
    status: 'ACTIVE',
  });
  await service.syncProviderSubscription(
    syncInput({ providerSubId: 'sub_old', status: 'CANCELED', eventType: 'customer.subscription.deleted' }),
  );
  assert.equal(upserts.length, 0);
});

test('in-order lifecycle changes for the current subscription are applied', async () => {
  const { service, upserts, audits } = subscriptionHarness({
    id: 'row-1',
    providerSubId: 'sub_current',
    status: 'ACTIVE',
  });
  await service.syncProviderSubscription(syncInput({ status: 'CANCELED' }));
  assert.equal(upserts.length, 1);
  assert.equal(upserts[0].update.status, 'CANCELED');
  assert.equal(audits[0].action, 'SAAS_SUBSCRIPTION_SYNCED');
});
