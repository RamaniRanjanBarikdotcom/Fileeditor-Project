const fs = require('node:fs');
const path = require('node:path');

const API_URL = process.env.API_URL || 'http://localhost:4201/api/v1';
const ORIGIN = process.env.ORIGIN || 'http://localhost:5173';

class ConversionClient {
  constructor() {
    this.token = null;
  }

  async loginOrRegister() {
    // Generate a fresh user for this test run to avoid state collision
    const email = `test-${Date.now()}@example.com`;
    const password = 'TestPassword123!';
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
      body: JSON.stringify({ email, password, organizationName: 'Test Org' }),
    });

    if (!response.ok) {
      throw new Error(`Failed to register user: ${response.statusText}`);
    }

    const data = await response.json();
    this.token = data.data.accessToken;
  }

  async uploadFile(filePath, format) {
    if (!this.token) throw new Error('Must login first');
    const formData = new FormData();
    const bytes = fs.readFileSync(filePath);
    formData.append('file', new Blob([bytes]), path.basename(filePath));
    const response = await fetch(`${API_URL}/files/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        Origin: ORIGIN,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to upload file: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data.id;
  }

  async startConversion(sourceFileId, targetFormat) {
    const response = await fetch(`${API_URL}/conversions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        Origin: ORIGIN,
      },
      body: JSON.stringify({ sourceFileId, targetFormat }),
    });

    if (!response.ok) {
      throw new Error(`Failed to start conversion: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data.id;
  }

  async waitForCompletion(conversionId, timeoutMs = 60000) {
    const response = await fetch(`${API_URL}/conversions/${conversionId}/events`, {
      headers: {
        Accept: 'text/event-stream',
        Authorization: `Bearer ${this.token}`,
        Origin: ORIGIN,
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok || !response.body) {
      throw new Error(`Failed to open conversion progress stream: HTTP ${response.status}`);
    }

    const decoder = new TextDecoder();
    let buffer = '';
    for await (const chunk of response.body) {
      buffer += decoder.decode(chunk, { stream: true });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() || '';
      for (const event of events) {
        const payload = event
          .split(/\r?\n/)
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart())
          .join('\n');
        if (!payload) continue;
        const job = JSON.parse(payload);
        if (job.status === 'COMPLETED') return;
        if (['FAILED', 'CANCELLED', 'EXPIRED'].includes(job.status)) {
          throw new Error(`Conversion failed: ${job.errorMessage || 'unknown error'}`);
        }
      }
    }
    throw new Error('Conversion progress stream closed before a terminal status was delivered.');
  }

  async downloadResult(conversionId) {
    // 1. Get download URL
    const urlResponse = await fetch(`${API_URL}/conversions/${conversionId}/download-url`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, Origin: ORIGIN },
    });

    if (!urlResponse.ok) {
      throw new Error(`Failed to get download URL: ${urlResponse.statusText}`);
    }

    const urlData = await urlResponse.json();
    const downloadUrl = urlData.data.url;

    // 2. Fetch the actual file
    const fileResponse = await fetch(downloadUrl);
    if (!fileResponse.ok) {
      throw new Error(`Failed to download file from ${downloadUrl}`);
    }

    const arrayBuffer = await fileResponse.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}

module.exports = { ConversionClient };
