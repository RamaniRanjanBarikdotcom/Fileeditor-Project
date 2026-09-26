const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

test('offline license certificates are Ed25519 verifiable and tamper evident', () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  const encoded = Buffer.from(
    JSON.stringify({ productSlug: 'blog-studio-desktop-windows', perpetualUse: true }),
  ).toString('base64url');
  const signature = crypto.sign(null, Buffer.from(encoded), privateKey);
  assert.equal(crypto.verify(null, Buffer.from(encoded), publicKey, signature), true);
  assert.equal(crypto.verify(null, Buffer.from(`${encoded}x`), publicKey, signature), false);
});

test('desktop verifier binds a signed certificate to this product and machine', () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  process.env.BLOG_STUDIO_LICENSE_PUBLIC_KEY = publicKey.export({ type: 'spki', format: 'pem' });
  delete require.cache[require.resolve('../src/license.cjs')];
  const { machineFingerprint, verifyOfflineCertificate } = require('../src/license.cjs');
  const machineHash = machineFingerprint();
  const encoded = Buffer.from(
    JSON.stringify({
      productSlug: 'blog-studio-desktop-windows',
      machineHash,
      perpetualUse: true,
      updatesValidUntil: '2099-01-01T00:00:00.000Z',
    }),
  ).toString('base64url');
  const signature = crypto.sign(null, Buffer.from(encoded), privateKey).toString('base64url');
  assert.equal(verifyOfflineCertificate(`${encoded}.${signature}`, machineHash).valid, true);
  assert.equal(verifyOfflineCertificate(`${encoded}.${signature}`, 'another-machine').valid, false);
});
