const test = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');

const { PaymentsService } = require('../dist/payments/payments.service');
const { WebhooksController } = require('../dist/payments/webhooks.controller');
const { LicensesService } = require('../dist/licenses/licenses.service');

function refundHarness(order) {
  const calls = [];
  const prisma = {
    order: {
      findFirst: async () => order,
      update: (input) => (calls.push(['order', input.data]), input),
    },
    entitlement: { updateMany: (input) => (calls.push(['entitlements', input]), input) },
    licenseKey: { updateMany: (input) => (calls.push(['licenses', input]), input) },
    auditLog: { create: async (input) => (calls.push(['audit', input.data.action]), input) },
    $transaction: async (operations) => operations,
  };
  return { service: new PaymentsService(prisma, {}), calls };
}

test('a full refund revokes the order entitlements and license keys', async () => {
  const { service, calls } = refundHarness({ id: 'order-1', userId: 'user-1', status: 'PAID', totalAmountMinor: 9900 });
  const result = await service.refundOrder({ provider: 'STRIPE', providerPaymentId: 'pi_1', refundedMinorUnits: 9900 });
  assert.equal(result.refunded, true);
  assert.deepEqual(calls.find(([kind]) => kind === 'order')[1], { status: 'REFUNDED' });
  assert.deepEqual(calls.find(([kind]) => kind === 'entitlements')[1].data, { isActive: false });
  assert.deepEqual(calls.find(([kind]) => kind === 'licenses')[1].data, { status: 'REVOKED' });
});

test('a partial refund is recorded without revoking access', async () => {
  const { service, calls } = refundHarness({ id: 'order-1', userId: 'user-1', status: 'PAID', totalAmountMinor: 9900 });
  const result = await service.refundOrder({ provider: 'STRIPE', providerPaymentId: 'pi_1', refundedMinorUnits: 1000 });
  assert.equal(result.reason, 'PARTIAL');
  assert.deepEqual(calls.map(([kind]) => kind), ['audit']);
});

function webhookHarness({ stripeEvent, order } = {}) {
  const fulfilled = [];
  const refunds = [];
  const prisma = {
    webhookEvent: {
      findUnique: async () => null,
      upsert: async () => ({ id: 'row-1' }),
      update: async () => undefined,
    },
    order: { findFirst: async () => order ?? null },
  };
  const controller = new WebhooksController(
    { constructWebhookEvent: () => stripeEvent },
    { verifyWebhookSignature: () => true },
    {
      fulfillOrder: async (input) => fulfilled.push(input),
      refundOrder: async (input) => refunds.push(input),
    },
    {},
    prisma,
  );
  return { controller, fulfilled, refunds };
}

test('Stripe charge.refunded reaches the refund handler with the refunded amount', async () => {
  const { controller, refunds } = webhookHarness({
    stripeEvent: {
      id: 'evt_refund',
      type: 'charge.refunded',
      data: { object: { payment_intent: 'pi_9', amount_refunded: 9900 } },
    },
  });
  await controller.handleStripeWebhook({ rawBody: Buffer.from('{}') }, 'signature');
  assert.deepEqual(refunds, [{ provider: 'STRIPE', providerPaymentId: 'pi_9', refundedMinorUnits: 9900 }]);
});

test('a Razorpay payment without notes is fulfilled through its provider order id', async () => {
  const { controller, fulfilled } = webhookHarness({ order: { id: 'order-7' } });
  const body = {
    event_id: 'rzp_evt_paid',
    event: 'payment.captured',
    payload: { payment: { entity: { id: 'pay_1', order_id: 'order_rzp_1', notes: {} } } },
  };
  await controller.handleRazorpayWebhook({ rawBody: Buffer.from(JSON.stringify(body)), body }, 'signature');
  assert.equal(fulfilled.length, 1);
  assert.equal(fulfilled[0].orderId, 'order-7');
});

test('online license validation rejects deactivated machines and revoked licenses', async () => {
  const activation = (status, machineHash = 'a'.repeat(64)) => ({
    id: 'act-1',
    machineHash,
    licenseKey: { status, expiresAt: null },
  });
  let current = activation('ACTIVE');
  const prisma = {
    licenseActivation: { findUnique: async () => current, update: async () => undefined },
  };
  const service = new LicensesService(prisma, {});
  const request = { activationId: 'act-1', machineHash: 'a'.repeat(64) };
  assert.deepEqual(await service.validateActivation(request), { valid: true });
  current = activation('REVOKED');
  assert.deepEqual(await service.validateActivation(request), { valid: false, reason: 'REVOKED' });
  current = null;
  assert.deepEqual(await service.validateActivation(request), { valid: false, reason: 'DEACTIVATED' });
  current = activation('ACTIVE', 'b'.repeat(64));
  assert.equal((await service.validateActivation(request)).valid, false);
});
