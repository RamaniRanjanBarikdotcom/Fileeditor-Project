const test = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');

const { SaasEntitlementsService } = require('../dist/saas-plans/saas-entitlements.service');

const FREE = {
  id: 'plan-free',
  key: 'free',
  name: 'Free',
  isFree: true,
  limitsJson: { invoicesPerMonth: 2, items: 3 },
  featuresJson: [],
};
const PRO = {
  id: 'plan-pro',
  key: 'pro',
  name: 'Pro',
  isFree: false,
  limitsJson: { invoicesPerMonth: -1, items: 5000 },
  featuresJson: ['purchasing'],
};

function harness({ subscriptionPlan = null } = {}) {
  let used = 0;
  const db = {
    product: { findUnique: async () => ({ id: 'product-1', name: 'Invoice Studio' }) },
    saasSubscription: {
      findFirst: async () => (subscriptionPlan ? { id: 'sub-1', plan: subscriptionPlan } : null),
    },
    saasPlan: { findFirst: async () => FREE },
    $executeRaw: async () => 0,
    saasUsageCounter: {
      // Mirrors the SQL guard: increment only while used <= limit - amount.
      updateMany: async ({ where, data }) => {
        const max = where.used?.lte;
        if (max !== undefined && used > max) return { count: 0 };
        used += data.used.increment;
        return { count: 1 };
      },
      findMany: async () => [{ metric: 'invoicesPerMonth', used }],
    },
  };
  return { service: new SaasEntitlementsService(db), db, used: () => used };
}

test('organizations without a subscription get the free plan', async () => {
  const { service } = harness();
  const plan = await service.activePlan('org-1', 'invoice-studio');
  assert.equal(plan.planKey, 'free');
  assert.equal(plan.subscriptionId, null);
});

test('metered usage stops at the plan limit', async () => {
  const { service, db, used } = harness();
  await service.consume(db, 'org-1', 'invoice-studio', 'invoicesPerMonth', 'Invoices');
  await service.consume(db, 'org-1', 'invoice-studio', 'invoicesPerMonth', 'Invoices');
  await assert.rejects(
    service.consume(db, 'org-1', 'invoice-studio', 'invoicesPerMonth', 'Invoices'),
    (error) => error.getStatus() === 402 && /used all 2 invoices/.test(error.message),
  );
  assert.equal(used(), 2);
});

test('unlimited plans never block metered usage', async () => {
  const { service, db, used } = harness({ subscriptionPlan: PRO });
  for (let i = 0; i < 50; i += 1) {
    await service.consume(db, 'org-1', 'invoice-studio', 'invoicesPerMonth', 'Invoices');
  }
  assert.equal(used(), 50);
});

test('static limits and features follow the plan', async () => {
  const free = harness().service;
  await free.assertCountBelowLimit('org-1', 'invoice-studio', 'items', 2, 'Items');
  await assert.rejects(free.assertCountBelowLimit('org-1', 'invoice-studio', 'items', 3, 'Items'), /allows 3 items/);
  await assert.rejects(
    free.assertCountBelowLimit('org-1', 'invoice-studio', 'warehouses', 0, 'Warehouses'),
    /not included in the Free plan/,
  );
  await assert.rejects(free.assertFeature('org-1', 'invoice-studio', 'purchasing', 'Purchasing'), /Upgrade/);

  const pro = harness({ subscriptionPlan: PRO }).service;
  assert.equal(await pro.hasFeature('org-1', 'invoice-studio', 'purchasing'), true);
  await pro.assertCountBelowLimit('org-1', 'invoice-studio', 'items', 4999, 'Items');
});
