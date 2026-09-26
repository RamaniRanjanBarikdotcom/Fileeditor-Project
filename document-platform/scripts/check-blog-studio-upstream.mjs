import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCKFILE_PATH = path.join(__dirname, '../blog-studio-upstream.lock.json');

async function fetchGitHubAPI(endpoint) {
  const token = process.env.GITHUB_TOKEN;
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'AppToolkitLab-Upstream-Watcher'
  };
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }
  
  const response = await fetch(`https://api.github.com${endpoint}`, { headers });
  if (!response.ok) {
    throw new Error(`GitHub API Error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function checkUpstream() {
  try {
    const lockfileContent = await fs.readFile(LOCKFILE_PATH, 'utf-8');
    const lockData = JSON.parse(lockfileContent);
    
    console.log(`Checking upstream repository: ${lockData.repository}`);
    console.log(`Locked Commit: ${lockData.commit}`);
    
    // Fetch the latest commit on the tracked branch
    const branchData = await fetchGitHubAPI(`/repos/${lockData.repository}/branches/${lockData.branch}`);
    const latestCommitSha = branchData.commit.sha;
    
    console.log(`Latest Remote Commit: ${latestCommitSha}`);
    
    if (latestCommitSha === lockData.commit) {
      console.log('✅ Upstream is fully synchronized. No new changes.');
      return;
    }
    
    // Check if it's a fast-forward or force-push by checking if locked commit is ancestor of latest
    const compareData = await fetchGitHubAPI(`/repos/${lockData.repository}/compare/${lockData.commit}...${latestCommitSha}`);
    
    const status = compareData.status; // 'identical', 'ahead', 'behind', 'diverged'
    console.log(`Comparison Status: ${status}`);
    
    if (status === 'diverged' || status === 'behind') {
      console.error('🚨 WARNING: Upstream history has diverged or force-pushed. Manual review required immediately.');
    } else {
      console.log(`Upstream has advanced by ${compareData.ahead_by} commits.`);
    }
    
    // Classify changes
    const changedFiles = compareData.files.map(f => f.filename);
    const classifications = new Set();
    
    for (const file of changedFiles) {
      if (file.match(/package\.json|dependencies/i)) classifications.add('Dependencies');
      if (file.match(/ui|components|pages|styles/i)) classifications.add('UI');
      if (file.match(/api|server|routes/i)) classifications.add('API');
      if (file.match(/model|schema|db|prisma/i)) classifications.add('Database');
      if (file.match(/auth|security/i)) classifications.add('Security');
      if (file.match(/doc|readme|md/i)) classifications.add('Documentation');
    }
    
    if (classifications.size === 0) classifications.add('Miscellaneous');
    
    console.log('\n--- COMPATIBILITY REPORT ---');
    console.log(`New Commits Detected: ${compareData.ahead_by}`);
    console.log(`Classifications: ${Array.from(classifications).join(', ')}`);
    console.log('Action Required: Please review the upstream changes and port relevant behavior into native AppToolkitLab packages.');
    console.log('DO NOT automatically merge or deploy these changes.');
    
    // If run in CI, we could output this to the step summary
    if (process.env.GITHUB_STEP_SUMMARY) {
      const summary = `
### 🚨 Blog Studio Upstream Changes Detected
- **Repository:** ${lockData.repository}
- **Status:** ${status === 'diverged' ? '⚠️ Diverged / Force Pushed' : '✅ Ahead'}
- **New Commits:** ${compareData.ahead_by}
- **Areas Affected:** ${Array.from(classifications).join(', ')}

Please review the changes at: https://github.com/${lockData.repository}/compare/${lockData.commit}...${latestCommitSha}
      `;
      await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
    }
    
  } catch (error) {
    console.error('Error checking upstream parity:', error.message);
    process.exit(1);
  }
}

checkUpstream();
