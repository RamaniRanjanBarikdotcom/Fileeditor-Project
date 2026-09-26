'use strict';

const crypto = require('node:crypto');
const os = require('node:os');

// Replaced by the signed release pipeline. A public key is not a secret.
const LICENSE_PUBLIC_KEY = process.env.BLOG_STUDIO_LICENSE_PUBLIC_KEY || '';

function machineFingerprint() {
  return crypto
    .createHash('sha256')
    .update([os.hostname(), os.platform(), os.arch(), os.cpus()[0]?.model || 'unknown'].join('|'))
    .digest('hex');
}

function verifyOfflineCertificate(certificate, expectedMachineHash) {
  const [payloadPart, signaturePart] = certificate.split('.');
  if (!payloadPart || !signaturePart || !LICENSE_PUBLIC_KEY)
    return { valid: false, reason: 'Desktop release public key is not configured.' };
  const valid = crypto.verify(
    null,
    Buffer.from(payloadPart),
    LICENSE_PUBLIC_KEY,
    Buffer.from(signaturePart, 'base64url'),
  );
  if (!valid) return { valid: false, reason: 'Certificate signature is invalid.' };
  const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
  if (
    payload.machineHash !== expectedMachineHash ||
    payload.productSlug !== 'blog-studio-desktop-windows' ||
    payload.perpetualUse !== true
  )
    return { valid: false, reason: 'Certificate does not match this device or product.' };
  return { valid: true, payload };
}

module.exports = { machineFingerprint, verifyOfflineCertificate };
