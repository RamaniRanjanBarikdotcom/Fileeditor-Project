// Defense-in-depth for logging: strip credential-like fields from any object before it
// is written to a log. Callers should already avoid logging secrets, but this guarantees
// that API keys, access tokens, app passwords and OAuth secrets never reach the DB even
// if some future code passes a settings/destination object into a log payload.

// Substring matches on the normalized (lowercased, alphanumeric-only) field name.
const SENSITIVE_SUBSTRINGS = [
  'apikey',
  'apikeys',
  'accesstoken',
  'refreshtoken',
  'authtoken',
  'apitoken',
  'bearertoken',
  'apppassword',
  'password',
  'passwd',
  'clientsecret',
  'privatekey',
  'encryptionkey',
  'credential',
  'credentials',
  'xapikey',
];
// Exact (normalized) field names that are sensitive on their own.
const SENSITIVE_EXACT = new Set([
  'key',
  'token',
  'secret',
  'password',
  'pwd',
  'pat',
  'authorization',
  'bearer',
  'jwt',
]);

function isSensitiveName(name) {
  const norm = String(name).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!norm) return false;
  if (SENSITIVE_EXACT.has(norm)) return true;
  return SENSITIVE_SUBSTRINGS.some((pattern) => norm.includes(pattern));
}

/**
 * Recursively clone `value`, replacing any credential-like field with '[REDACTED]'.
 * Non-plain values (Date, primitives) are returned unchanged. Depth-capped to avoid
 * runaway recursion on deeply nested or cyclic structures.
 */
export function redactSensitive(value, depth = 0) {
  if (value === null || value === undefined || depth > 6) return value;
  if (Array.isArray(value)) return value.map((item) => redactSensitive(item, depth + 1));
  if (value instanceof Date) return value;
  if (typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = isSensitiveName(key) ? '[REDACTED]' : redactSensitive(val, depth + 1);
    }
    return out;
  }
  return value;
}

export default { redactSensitive };
