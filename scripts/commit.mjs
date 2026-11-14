import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// 作为独立项目发布时排除的目录：项目配置、共享文件与构建产物
const EXCLUDE = ['projects', 'config', 'shared', 'dist', 'node_modules'];

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

export function commit({ remote = 'origin', branch = 'main', message } = {}) {
  if (!existsSync(join(root, '.git'))) {
    throw new Error('当前目录不是 Git 仓库，请先 git init 并关联远程 origin');
  }
  ensureRemote(remote);
  const target = branch || 'main';
  const msg = message || `MataForge 独立项目发布 ${new Date().toISOString()}`;
  const exclude = EXCLUDE.map((p) => `:!${p}`).join(' ');

  run(`git add -A -- . ${exclude}`);
  try {
    run('git diff --cached --quiet');
  } catch {
    run(`git commit -m "${msg}"`);
  }
  run(`git push -u ${remote} ${target}`);
  return { remote, branch: target };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const r = commit();
    console.log(`已提交并推送到 ${r.remote}/${r.branch}`);
  } catch (e) {
    console.error('提交失败:\n' + e.message);
    process.exit(1);
  }
}