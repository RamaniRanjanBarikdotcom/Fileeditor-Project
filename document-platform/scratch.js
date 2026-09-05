const fetch = require('node-fetch');
const FormData = require('form-data');

async function test() {
  try {
    // 1. Register
    const reg = await fetch('http://localhost:4201/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test_url_upload@example.com',
        password: 'password',
        organizationName: 'Test Org',
      }),
    });
    const regData = await reg.json();
    console.log('Register:', reg.status, regData);

    const token = regData.accessToken;

    // 2. Upload URL
    const form = new FormData();
    form.append('file', Buffer.from('https://example.com'), {
      filename: 'website.url',
      contentType: 'text/uri-list',
    });

    const upload = await fetch('http://localhost:4201/api/v1/files/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        ...form.getHeaders(),
      },
      body: form,
    });

    const uploadData = await upload.text();
    console.log('Upload URL:', upload.status, uploadData);
  } catch (e) {
    console.error(e);
  }
}
test();
