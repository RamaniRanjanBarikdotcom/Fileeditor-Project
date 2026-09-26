const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { loadEnvFile } = require('node:process');

const apiDirectory = path.resolve(__dirname, '..');
const repositoryRoot = path.resolve(apiDirectory, '..', '..');

try {
  loadEnvFile(path.join(repositoryRoot, '.env'));
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = address.port;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

async function waitForApi(url, child, logs) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Queue-disabled API exited early.\n${logs.join('')}`);
    }
    try {
      const response = await fetch(`${url}/health/liveness`, {
        signal: AbortSignal.timeout(750),
      });
      if (response.ok) return;
    } catch {
      // Startup is still in progress.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for queue-disabled API.\n${logs.join('')}`);
}

async function stopChild(child) {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    new Promise((resolve) =>
      setTimeout(() => {
        child.kill('SIGKILL');
        resolve();
      }, 5_000),
    ),
  ]);
}

test('queue-disabled API starts and rejects server conversion without creating a job', async () => {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required for the live E2E suite');
  const port = await reservePort();
  const apiUrl = `http://127.0.0.1:${port}/api/v1`;
  const origin = 'http://localhost:5173';
  const logs = [];
  const child = spawn(process.execPath, [path.join(apiDirectory, 'dist', 'main.js')], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'test',
      REDIS_ENABLED: 'false',
      COOKIE_SECURE: 'false',
      CLAMAV_ENABLED: 'false',
      SWAGGER_ENABLED: 'false',
      APP_URL: origin,
      PUBLIC_WEB_URL: origin,
      CORS_ORIGIN: origin,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => logs.push(chunk.toString()));
  child.stderr.on('data', (chunk) => logs.push(chunk.toString()));

  try {
    await waitForApi(apiUrl, child, logs);
    const email = `queue-disabled-${Date.now()}@example.com`;
    const registration = await fetch(`${apiUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin },
      body: JSON.stringify({
        email,
        password: 'StrongPassword123!',
        organizationName: `Queue disabled ${crypto.randomUUID()}`,
      }),
    });
    const registrationBody = await registration.text();
    assert.equal(registration.status, 201, registrationBody);
    const registered = JSON.parse(registrationBody);

    const conversion = await fetch(`${apiUrl}/conversions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${registered.data.accessToken}`,
        'Content-Type': 'application/json',
        Origin: origin,
      },
      body: JSON.stringify({ sourceFileId: crypto.randomUUID(), targetFormat: 'pdf' }),
    });
    assert.equal(conversion.status, 503);
    const body = await conversion.json();
    assert.match(String(body.message), /workers are disabled/i);
  } finally {
    await stopChild(child);
  }
});
