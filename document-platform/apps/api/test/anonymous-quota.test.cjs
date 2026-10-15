const test = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');

const { normalizeQuotaIp } = require('../dist/tools/anonymous-quota.service');

test('anonymous quota keeps IPv4 and unwraps IPv4-mapped IPv6 addresses', () => {
  assert.equal(normalizeQuotaIp('203.0.113.7'), '203.0.113.7');
  assert.equal(normalizeQuotaIp('::ffff:203.0.113.7'), '203.0.113.7');
  assert.equal(normalizeQuotaIp('::FFFF:198.51.100.1'), '198.51.100.1');
});

test('anonymous quota groups native IPv6 by /64 without collapsing unrelated networks', () => {
  // Same /64 (one subscriber rotating interface IDs) shares a bucket.
  assert.equal(normalizeQuotaIp('2001:db8:1:2::abcd'), '2001:db8:1:2::/64');
  assert.equal(normalizeQuotaIp('2001:0db8:0001:0002:ffff:0:0:1'), '2001:db8:1:2::/64');
  assert.equal(normalizeQuotaIp('[2001:db8:1:2::1%eth0]'), '2001:db8:1:2::/64');
  // Different networks that share only a trailing group must not collide,
  // which the former "strip everything before the last colon" logic did.
  assert.notEqual(normalizeQuotaIp('2001:db8:aaaa::1a2b'), normalizeQuotaIp('2001:db8:bbbb::1a2b'));
  assert.equal(normalizeQuotaIp('2001:db8::1'), '2001:db8:0:0::/64');
});
