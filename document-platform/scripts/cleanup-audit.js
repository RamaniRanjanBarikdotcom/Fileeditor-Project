const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');

// 1. Known cleanup candidates (from PROJECT_EXECUTION_MEMORY.md)
const VITE_FILES = [
  'apps/web/index.html',
  'apps/web/vite.config.ts',
  'apps/web/tsconfig.app.json',
  'apps/web/tsconfig.node.json',
  'apps/web/src/main.tsx',
  'apps/web/src/App.tsx',
  'apps/web/src/App.css',
  'apps/web/src/assets/react.svg',
  'apps/web/src/assets/vite.svg',
];

const LEGACY_DEPS = ['react-router-dom', 'vite', '@vitejs/plugin-react', '@tailwindcss/vite'];

// 2. Artifact directories to scan
const ARTIFACT_DIRS = ['.next', 'dist', '.turbo', 'coverage'];

function getDirSize(dirPath) {
  let size = 0;
  if (!fs.existsSync(dirPath)) return size;

  const stat = fs.statSync(dirPath);
  if (stat.isFile()) return stat.size;
  if (stat.isDirectory()) {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      size += getDirSize(path.join(dirPath, file));
    }
  }
  return size;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function findArtifacts(dir) {
  let results = [];

  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules') continue; // Skip node_modules scanning for artifacts to save time

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (ARTIFACT_DIRS.includes(entry.name)) {
        const size = getDirSize(fullPath);
        results.push({
          path: path.relative(ROOT_DIR, fullPath),
          size: formatBytes(size),
          bytes: size,
        });
      } else {
        results = results.concat(findArtifacts(fullPath));
      }
    }
  }
  return results;
}

async function runAudit() {
  console.log('\n=========================================');
  console.log('🧹 READ-ONLY CLEANUP AUDIT (CLEAN-001)');
  console.log('=========================================\n');

  console.log('🔍 1. Scanning for Legacy Vite Files...');
  const foundViteFiles = [];
  for (const relativePath of VITE_FILES) {
    const fullPath = path.join(ROOT_DIR, relativePath);
    if (fs.existsSync(fullPath)) {
      foundViteFiles.push(relativePath);
    }
  }

  if (foundViteFiles.length > 0) {
    console.log(
      `   ⚠️ Found ${foundViteFiles.length} legacy files slated for removal (Pending Equivalence Tests):`,
    );
    foundViteFiles.forEach((f) => console.log(`      - ${f}`));
  } else {
    console.log('   ✅ No legacy Vite files found.');
  }

  console.log('\n🔍 2. Scanning for Legacy Dependencies (apps/web)...');
  const webPkgPath = path.join(ROOT_DIR, 'apps/web/package.json');
  if (fs.existsSync(webPkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(webPkgPath, 'utf8'));
    const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

    const foundDeps = LEGACY_DEPS.filter((dep) => allDeps[dep]);
    if (foundDeps.length > 0) {
      console.log(`   ⚠️ Found ${foundDeps.length} legacy dependencies slated for removal:`);
      foundDeps.forEach((dep) => console.log(`      - ${dep} (v${allDeps[dep]})`));
    } else {
      console.log('   ✅ No legacy dependencies found.');
    }
  } else {
    console.log('   ❓ apps/web/package.json not found.');
  }

  console.log('\n🔍 3. Scanning for Generated Artifacts (.next, dist, .turbo)...');
  const artifacts = findArtifacts(ROOT_DIR);
  if (artifacts.length > 0) {
    console.log(`   📦 Found ${artifacts.length} artifact directories:`);

    // Sort by size descending
    artifacts.sort((a, b) => b.bytes - a.bytes);

    const tableData = artifacts.map((a) => ({ Directory: a.path, Size: a.size }));
    console.table(tableData);

    const totalBytes = artifacts.reduce((acc, curr) => acc + curr.bytes, 0);
    console.log(`   Total Artifact Footprint: ${formatBytes(totalBytes)}`);
    console.log('   (These can be safely removed via CLEAN-002: Safe artifact cleanup)');
  } else {
    console.log('   ✅ No generated artifact directories found.');
  }

  console.log('\n=========================================');
  console.log('Audit complete. No files were deleted.');
  console.log('=========================================\n');
}

runAudit().catch(console.error);
