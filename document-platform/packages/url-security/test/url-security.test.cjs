const test = require('node:test');
const assert = require('node:assert/strict');
const { UrlSecurityService } = require('../dist');

const service = new UrlSecurityService();

test('allows a public HTTP address', async () => {
  await service.validateUrl('https://8.8.8.8/example');
});

for (const url of [
  'http://127.0.0.1/',
  'http://10.0.0.1/',
  'http://169.254.169.254/latest/meta-data/',
  'http://[::1]/',
  'file:///etc/passwd',
  'https://user:password@example.com/',
]) {
  test(`blocks unsafe URL: ${url}`, async () => {
    await assert.rejects(() => service.validateUrl(url));
  });
}
