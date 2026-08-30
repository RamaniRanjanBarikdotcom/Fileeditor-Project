import axios from 'axios';
import FormData from 'form-data';

async function test() {
  try {
    const reg = await axios.post('http://localhost:4201/api/v1/auth/register', {
      email: 'test_url_' + Date.now() + '@example.com',
      password: 'password',
      organizationName: 'Test Org'
    });
    console.log('Register:', reg.status);
    const token = reg.data.accessToken;

    const form = new FormData();
    form.append('file', Buffer.from('https://example.com'), {
      filename: 'website.url',
      contentType: 'text/uri-list'
    });

    const upload = await axios.post('http://localhost:4201/api/v1/files/upload', form, {
      headers: {
        'Authorization': `Bearer ${token}`,
        ...form.getHeaders()
      },
      validateStatus: () => true
    });
    
    console.log('Upload:', upload.status, upload.data);
  } catch (e) {
    console.error(e.response?.data || e.message);
  }
}
test();
