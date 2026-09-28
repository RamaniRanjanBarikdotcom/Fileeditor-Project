const test = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');

const { SubscriptionPlanTier, CurrencyCode, PaymentProvider } = require('@prisma/client');
const { getBlogStudioAllowance } = require('../dist/blog-studio/blog-usage.service');
const { subscriptionProviderForCurrency } = require('../dist/payments/saas-subscriptions.service');
const { BlogOutboxService } = require('../dist/blog-studio/blog-outbox.service');
const { buildImageGenerationRequest } = require('../dist/blog-studio/blog-images.service');
const { getBlogModelCatalogUpgrade } = require('../dist/blog-studio/blog-settings.service');
const {
  detectStorePlatform,
  extractStoreProductsFromHtml,
  normalizeSourceType,
} = require('../dist/blog-studio/blog-products.service');

test('product context recognizes JTL, React and custom-coded storefronts', () => {
  assert.equal(normalizeSourceType('JTL-Shop'), 'jtl');
  assert.equal(normalizeSourceType('React / Next.js'), 'react');
  assert.equal(normalizeSourceType('Custom coded'), 'custom');
  assert.equal(detectStorePlatform('<script id="__NEXT_DATA__"></script>'), 'react');
  assert.equal(detectStorePlatform('<div class="artbox"></div><!-- JTL-Shop -->'), 'jtl');
});

test('custom product CSS mappings extract normalized product records', () => {
  const products = extractStoreProductsFromHtml(
    '<section class="tile"><a class="go" href="/catalog/desk"><h2 class="name">Standing Desk</h2></a><span class="cost">€1.299,90</span><img data-src="/desk.jpg"><p class="summary">Solid oak</p><i data-code="DESK-1"></i></section>',
    'https://store.example/catalog',
    'custom',
    {
      productCard: '.tile',
      title: '.name',
      price: '.cost',
      link: '.go',
      image: 'img',
      description: '.summary',
      sku: '[data-code]',
    },
  );
  assert.equal(products.length, 1);
  assert.equal(products[0].title, 'Standing Desk');
  assert.equal(products[0].price, '1299.9');
  assert.equal(products[0].currency, '€');
  assert.equal(products[0].productUrl, 'https://store.example/catalog/desk');
  assert.equal(products[0].imageUrl, 'https://store.example/desk.jpg');
});

test('legacy Blog Studio model defaults are upgraded exactly once', () => {
  assert.deepEqual(
    getBlogModelCatalogUpgrade('gpt-5-mini', 'gpt-image-1', {
      aiProvider: 'openai',
      imageProvider: 'openai',
    }),
    {
      defaultTextModel: 'gpt-6-luna',
      defaultImageModel: 'gpt-image-2.5-flare',
      settingsJson: {
        aiProvider: 'openai',
        imageProvider: 'openai',
        modelCatalogVersion: 2,
      },
    },
  );

  assert.equal(
    getBlogModelCatalogUpgrade('customer-fine-tune', 'custom-image-model', {
      modelCatalogVersion: 2,
    }),
    null,
  );
});

test('model catalog migration preserves custom provider model IDs', () => {
  assert.deepEqual(
    getBlogModelCatalogUpgrade('customer-fine-tune', 'custom-image-model', {
      aiProvider: 'openai',
    }),
    {
      settingsJson: {
        aiProvider: 'openai',
        modelCatalogVersion: 2,
      },
    },
  );
});

test('image generation omits the legacy response format for current GPT Image models', () => {
  assert.deepEqual(buildImageGenerationRequest('gpt-image-2.5-flare', 'A cover', '1024x1024'), {
    model: 'gpt-image-2.5-flare',
    prompt: 'A cover',
    size: '1024x1024',
  });
  assert.equal(
    buildImageGenerationRequest('dall-e-3', 'A cover', '1024x1024').response_format,
    'b64_json',
  );
});

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
