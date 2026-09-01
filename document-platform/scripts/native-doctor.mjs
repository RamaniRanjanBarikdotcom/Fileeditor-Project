import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { spawnSync } from 'node:child_process';
import net from 'node:net';

const checks = [];
const nodeMajor = Number(process.versions.node.split('.')[0]);
checks.push({ name: `Node.js ${process.versions.node}`, ok: nodeMajor >= 20, hint: 'Install Node.js 20 or newer.' });

const nativeCommands = [
  ['pandoc', ['--version']],
  ['pdftotext', ['-v']],
  ['pdftoppm', ['-v']],
  ['tesseract', ['--version']],
];

for (const [command, args] of nativeCommands) {
  const result = spawnSync(command, args, { stdio: 'ignore' });
  checks.push({
    name: command,
    ok: !result.error && result.status !== null,
    hint: `Install ${command} (macOS: brew install pandoc poppler tesseract).`,
  });
}

try {
  await access('.env', constants.R_OK);
  checks.push({ name: 'Root .env file', ok: true, hint: '' });
} catch {
  checks.push({ name: 'Root .env file', ok: false, hint: 'Copy .env.example to .env and review its secrets.' });
}

const services = [
  ['PostgreSQL', '127.0.0.1', 5432],
  ['Redis', '127.0.0.1', 6379],
  ['MinIO', '127.0.0.1', 9000],
  ['Gotenberg', '127.0.0.1', 3100],
];

const canConnect = (host, port) => new Promise((resolve) => {
  const socket = net.createConnection({ host, port });
  const finish = (ok) => { socket.destroy(); resolve(ok); };
  socket.setTimeout(1500);
  socket.once('connect', () => finish(true));
  socket.once('timeout', () => finish(false));
  socket.once('error', () => finish(false));
});

for (const [name, host, port] of services) {
  checks.push({
    name: `${name} (${host}:${port})`,
    ok: await canConnect(host, port),
    hint: 'Start it locally or run: corepack pnpm infra:up',
  });
}

console.log('\nToolSuite native runtime check\n');
for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'}  ${check.name}`);
  if (!check.ok) console.log(`      ${check.hint}`);
}

if (checks.some((check) => !check.ok)) {
  console.log('\nNative prerequisites are incomplete. See README.md for setup options.\n');
  process.exitCode = 1;
} else {
  console.log('\nAll native prerequisites are available.\n');
}
