import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from './build.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const REPO_URL = 'https://github.com/rubingchupin/MataForge';

function run(cmd) {
  return execSync(cmd, { cwd: root, encoding: 'utf8', stdio: 'pipe' });
}

function ensureRemote(remote) {
  try {
    run(`git remote get-url ${remote}`);
  } catch {
    run(`git remote add ${remote} ${REPO_URL}`);
  }
}

export function publish({ branch = 'assets', remote = 'origin', message } = {}) {
  if (!existsSync(join(root, '.git'))) {
    throw new Error('当前目录不是 Git 仓库，请先 git init 并关联远程 origin');
  }
  ensureRemote(remote);
  build();
  const msg = message || `MataForge 更新 ${new Date().toISOString()}`;

  run('git add -f dist');
  try {
    run('git diff --cached --quiet');
  } catch {
    run(`git commit -m "${msg}"`);
  }

  run(`git subtree push --prefix dist ${remote} ${branch}`);
  return { branch, remote };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const r = publish();
    console.log(`已发布到 ${r.remote}/${r.branch}`);
  } catch (e) {
    console.error('发布失败:\n' + e.message);
    process.exit(1);
  }
}