import { spawnSync } from 'node:child_process';

const noBuild = process.argv.includes('--no-build');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.error) {
    console.error(`\nUnable to run ${command}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log('\nStarting the complete AppToolkitLab platform...\n');

const dockerCheck = spawnSync('docker', ['info'], { stdio: 'ignore' });
if (dockerCheck.status !== 0) {
  console.error(
    'Docker Desktop is not running. Start Docker Desktop, then run this command again.\n',
  );
  process.exit(1);
}

const upArgs = ['compose', 'up', '-d'];
if (!noBuild) upArgs.push('--build');
upArgs.push('--wait');
run('docker', upArgs);

let healthy = false;
for (let attempt = 1; attempt <= 12; attempt += 1) {
  try {
    const response = await fetch('http://127.0.0.1:4201/api/v1/health', {
      signal: AbortSignal.timeout(5_000),
    });
    if (response.ok) {
      healthy = true;
      break;
    }
  } catch {
    // Docker health checks can finish just before the host port is ready.
  }
  await new Promise((resolve) => setTimeout(resolve, 1_000));
}

if (!healthy) {
  console.error('\nThe stack started, but the website cannot reach the API. Recent logs:\n');
  run('docker', ['compose', 'logs', '--tail=100', 'api', 'worker', 'web']);
  process.exit(1);
}

console.log('\nAppToolkitLab is ready: http://localhost:5173');
console.log('All server conversion dependencies were started and verified.\n');
