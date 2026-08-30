import { UrlSecurityService } from './packages/url-security/src/UrlSecurityService';

async function test() {
  const service = new UrlSecurityService();
  const urls = [
    'https://example.com',
    'http://localhost:4201',
    'http://127.0.0.1',
    'http://169.254.169.254',
    'https://google.com'
  ];
  for (const u of urls) {
    try {
      await service.validateUrl(u);
      console.log(`[PASS] ${u}`);
    } catch (e: any) {
      console.log(`[BLOCK] ${u}: ${e.message}`);
    }
  }
}
test();
