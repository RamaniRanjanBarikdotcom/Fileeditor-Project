const test = require('node:test');
const assert = require('node:assert/strict');
const { loadEnvFile } = require('node:process');

try {
  loadEnvFile('../../.env');
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

const { PrismaClient } = require('@prisma/client');

const configuredApiUrl = (process.env.API_URL || 'http://localhost:4201').replace(/\/$/, '');
const API_URL = configuredApiUrl.endsWith('/api/v1')
  ? configuredApiUrl
  : `${configuredApiUrl}/api/v1`;
const ORIGIN = process.env.ORIGIN || 'http://localhost:5173';
const prisma = new PrismaClient();

async function api(path, token, options = {}) {
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      Origin: ORIGIN,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
}

async function register(label) {
  const email = `blog-studio-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
  const response = await api('/auth/register', '', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password: 'StrongPassword123!',
      organizationName: `Blog Studio ${label}`,
    }),
  });
  assert.equal(response.status, 201);
  const payload = await response.json();
  return { email, token: payload.data.accessToken };
}

async function isAvailable() {
  try {
    return (await fetch(`${API_URL}/health/live`, { signal: AbortSignal.timeout(10_000) })).ok;
  } catch {
    return false;
  }
}

test('Blog Studio live tenant, editor, export, usage, and feature-flag contracts', async (t) => {
  if (!(await isAvailable())) {
    const message = `API server not running at ${API_URL}. Start it with 'corepack pnpm start'.`;
    if (process.env.CI) assert.fail(message);
    t.skip(message);
    return;
  }

  const owner = await register('owner');
  const outsider = await register('outsider');
  const ownerRecord = await prisma.user.findUnique({
    where: { email: owner.email },
    include: { memberships: { take: 1 } },
  });
  assert.ok(ownerRecord?.memberships[0]?.organizationId);
  const organizationId = ownerRecord.memberships[0].organizationId;

  const blog = await prisma.blogDocument.create({
    data: {
      organizationId,
      createdByUserId: ownerRecord.id,
      title: 'A safe Blog Studio draft',
      slug: `safe-blog-studio-draft-${Date.now()}`,
      topic: 'Secure content workflows',
      html: '<h1>A safe draft</h1><p>Original content.</p>',
      editorJson: { type: 'doc', content: [] },
      metadataJson: {
        seoTitle: 'A safe Blog Studio draft',
        metaDescription: 'A test article for the native Blog Studio workspace.',
      },
      keywords: ['security', 'content'],
      seoScore: 82,
      language: 'English',
      wordCount: 5,
      status: 'READY',
    },
  });

  await t.test('free usage exposes separate blog and credit limits', async () => {
    const response = await api('/blog-studio/usage', owner.token);
    assert.equal(response.status, 200);
    const usage = (await response.json()).data;
    assert.equal(usage.blogLimit, 1);
    assert.equal(usage.creditLimit, 25);
    assert.equal(usage.blogsRemaining, 1);
    assert.equal(usage.creditsRemaining, 25);
  });

  if (!process.env.AI_API_KEY) {
    await t.test('an unavailable AI provider creates no usage reservation', async () => {
      const before = (await (await api('/blog-studio/usage', owner.token)).json()).data;
      const response = await api('/blog-studio/generations', owner.token, {
        method: 'POST',
        body: JSON.stringify({
          topic: 'Provider outage safety',
          keywords: ['reliability'],
          language: 'English',
          writingStyle: 'Educational',
          tone: 'Professional',
          targetLength: 1200,
        }),
      });
      assert.equal(response.status, 503);
      const after = (await (await api('/blog-studio/usage', owner.token)).json()).data;
      assert.equal(after.reservedBlogs, before.reservedBlogs);
      assert.equal(after.reservedCredits, before.reservedCredits);
      assert.equal(after.blogsConsumed, before.blogsConsumed);
      assert.equal(after.creditsConsumed, before.creditsConsumed);
    });
  }

  await t.test('blog IDs and content are isolated by organization', async () => {
    assert.equal((await api(`/blog-studio/blogs/${blog.id}`, owner.token)).status, 200);
    assert.equal((await api(`/blog-studio/blogs/${blog.id}`, outsider.token)).status, 404);
  });

  await t.test('autosave sanitizes HTML and rejects stale versions', async () => {
    const unsafeHtml =
      '<h1 onclick="alert(1)">Updated</h1><script>alert(1)</script><p><a href="javascript:alert(1)">Safe text</a></p>';
    const update = await api(`/blog-studio/blogs/${blog.id}`, owner.token, {
      method: 'PATCH',
      body: JSON.stringify({
        version: 1,
        title: 'Updated safely',
        html: unsafeHtml,
        editorJson: { type: 'doc', content: [] },
      }),
    });
    assert.equal(update.status, 200);
    const updated = (await update.json()).data;
    assert.equal(updated.version, 2);
    assert.doesNotMatch(updated.html, /<script|onclick|javascript:/i);

    const stale = await api(`/blog-studio/blogs/${blog.id}`, owner.token, {
      method: 'PATCH',
      body: JSON.stringify({ version: 1, title: 'Stale write' }),
    });
    assert.equal(stale.status, 409);
  });

  await t.test('HTML and Markdown exports are stored and downloadable', async () => {
    for (const format of ['html', 'markdown']) {
      const response = await api(`/blog-studio/blogs/${blog.id}/exports`, owner.token, {
        method: 'POST',
        body: JSON.stringify({ format }),
      });
      assert.equal(response.status, 201);
      const result = (await response.json()).data;
      assert.equal(result.status, 'COMPLETED');
      assert.ok(result.url);
      const download = await fetch(result.url);
      assert.equal(download.status, 200);
      const body = await download.text();
      assert.ok(body.length > 5);
      assert.match(body, /Updated/i);
      assert.doesNotMatch(body, /<script|onclick|javascript:/i);
    }
  });

  await t.test('checkout and image generation stay backend-hidden while disabled', async () => {
    const checkout = await api('/blog-studio/subscription/checkout', owner.token, {
      method: 'POST',
      body: JSON.stringify({
        currency: 'USD',
        successUrl: `${ORIGIN}/app/billing?success=1`,
        cancelUrl: `${ORIGIN}/app/billing?cancelled=1`,
      }),
    });
    assert.equal(checkout.status, 404);

    const image = await api(`/blog-studio/blogs/${blog.id}/images`, owner.token, {
      method: 'POST',
      body: JSON.stringify({ prompt: 'A safe abstract illustration' }),
    });
    assert.equal(image.status, 404);
  });

  await t.test('soft deletion removes the blog from all normal reads', async () => {
    const response = await api(`/blog-studio/blogs/${blog.id}`, owner.token, {
      method: 'DELETE',
    });
    assert.equal(response.status, 200);
    assert.equal((await api(`/blog-studio/blogs/${blog.id}`, owner.token)).status, 404);
  });
});

test.after(async () => {
  await prisma.$disconnect();
});
