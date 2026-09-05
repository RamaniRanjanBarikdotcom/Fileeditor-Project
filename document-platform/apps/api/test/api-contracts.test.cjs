const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const API_URL = process.env.API_URL || 'http://localhost:4201/api/v1';
const ORIGIN = process.env.ORIGIN || 'http://localhost:5173';

test('API Contracts Suite', async (t) => {
  let userToken = '';
  let testFileId = '';
  const testEmail = `contract-test-${Date.now()}@example.com`;
  const testPassword = 'StrongPassword123!';

  // --- Auth Contracts ---
  await t.test('Auth Contracts', async (auth) => {
    await auth.test('POST /auth/register - Rejects invalid email', async () => {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
        body: JSON.stringify({
          email: 'not-an-email',
          password: 'Password123!',
          organizationName: 'Test',
        }),
      });
      assert.strictEqual(response.status, 400, 'Expected 400 Bad Request');
      const data = await response.json();
      assert.ok(data.message, 'Expected Nest validation error details');
    });

    await auth.test('POST /auth/register - Succeeds with valid payload', async () => {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
          organizationName: 'Contract Testers',
        }),
      });
      assert.strictEqual(response.status, 201, 'Expected 201 Created');
      const data = await response.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.data.accessToken, 'Expected accessToken in response');
      assert.ok(data.data.user, 'Expected user object in response');
      assert.strictEqual(data.data.user.email, testEmail);
    });

    await auth.test('POST /auth/login - Rejects invalid password', async () => {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
        body: JSON.stringify({ email: testEmail, password: 'WrongPassword' }),
      });
      assert.strictEqual(response.status, 401, 'Expected 401 Unauthorized');
      const data = await response.json();
      assert.ok(data.message, 'Expected authentication error details');
    });

    await auth.test('POST /auth/login - Succeeds with valid credentials', async () => {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
        body: JSON.stringify({ email: testEmail, password: testPassword }),
      });
      assert.strictEqual(response.status, 200, 'Expected 200 OK');
      const data = await response.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.data.accessToken);
      userToken = data.data.accessToken;
    });

    await auth.test('GET /auth/me - Rejects missing token', async () => {
      const response = await fetch(`${API_URL}/auth/me`);
      assert.strictEqual(response.status, 401, 'Expected 401 Unauthorized');
    });

    await auth.test('GET /auth/me - Returns user profile with token', async () => {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      assert.strictEqual(response.status, 200, 'Expected 200 OK');
      const data = await response.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.email, testEmail);
      assert.ok(data.data.id, 'Expected user ID');
    });
  });

  // --- File Contracts ---
  await t.test('File Contracts', async (files) => {
    await files.test('POST /files/paste - Rejects missing format', async () => {
      const response = await fetch(`${API_URL}/files/paste`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${userToken}`,
          'Content-Type': 'application/json',
          Origin: ORIGIN,
        },
        body: JSON.stringify({ content: 'Hello World' }),
      });
      assert.strictEqual(response.status, 400, 'Expected 400 Bad Request');
    });

    await files.test('POST /files/paste - Succeeds with format and content', async () => {
      const response = await fetch(`${API_URL}/files/paste`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${userToken}`,
          'Content-Type': 'application/json',
          Origin: ORIGIN,
        },
        body: JSON.stringify({ format: 'txt', content: 'Contract test content' }),
      });
      assert.strictEqual(response.status, 201, 'Expected 201 Created');
      const data = await response.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.data.id, 'Expected file ID');
      testFileId = data.data.id;
    });

    await files.test('GET /files/:id - Rejects invalid UUID', async () => {
      const response = await fetch(`${API_URL}/files/invalid-uuid`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      assert.strictEqual(
        response.status,
        404,
        'Expected 404 Not Found for an unknown file identifier',
      );
    });

    await files.test('GET /files/:id - Rejects non-existent UUID', async () => {
      const randomUuid = crypto.randomUUID();
      const response = await fetch(`${API_URL}/files/${randomUuid}`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      assert.strictEqual(response.status, 404, 'Expected 404 Not Found');
    });
  });

  // --- Conversion Contracts ---
  await t.test('Conversion Contracts', async (conv) => {
    await conv.test('POST /conversions - Rejects missing targetFormat', async () => {
      const response = await fetch(`${API_URL}/conversions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${userToken}`,
          'Content-Type': 'application/json',
          Origin: ORIGIN,
        },
        body: JSON.stringify({ sourceFileId: testFileId }),
      });
      assert.strictEqual(response.status, 400, 'Expected 400 Bad Request');
    });

    await conv.test('POST /conversions - Rejects unsupported targetFormat', async () => {
      const response = await fetch(`${API_URL}/conversions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${userToken}`,
          'Content-Type': 'application/json',
          Origin: ORIGIN,
        },
        body: JSON.stringify({ sourceFileId: testFileId, targetFormat: 'unsupported-format-xyz' }),
      });
      assert.strictEqual(response.status, 400, 'Expected 400 Bad Request');
    });

    // We do not test the actual conversion success here, as that is covered by FOUND-002 (baseline conversions).
    // This file strictly protects the API input validation and contract formats.
  });
});
