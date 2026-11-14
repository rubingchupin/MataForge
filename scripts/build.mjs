import { readdirSync, readFileSync, writeFileSync, mkdirSync, cpSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const projectsDir = join(root, 'projects');
const siteDir = join(root, 'site');
const outDir = join(root, 'dist');
const configPath = join(root, 'config', 'site.json');
const sharedDir = join(root, 'shared');

export function loadProjects() {
  if (!existsSync(projectsDir)) return [];
  return readdirSync(projectsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const p = join(projectsDir, d.name, 'mataforge.json');
      if (!existsSync(p)) return null;
      try {
        return JSON.parse(readFileSync(p, 'utf8'));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

export function loadConfig() {
  if (!existsSync(configPath)) return { site: { name: 'MataForge' }, author: {} };
  try {
    return JSON.parse(readFileSync(configPath, 'utf8'));
  } catch {
    return { site: { name: 'MataForge' }, author: {} };
  }
}

export function validateProject(proj) {
  const errors = [];
  for (const key of ['id', 'name', 'icon', 'version']) {
    if (!proj[key]) errors.push(`缺少字段: ${key}`);
  }
  if (proj.version && !/^[^\d]*\d+(\.\d+)*([-_+.][0-9A-Za-z-]+)*$/.test(proj.version)) {
    errors.push(`版本号格式错误: ${proj.version}`);
  }
  return errors;
}

export function build() {
  const config = loadConfig();
  const globalAuthor = config.author || {};
  const projects = loadProjects().map((p) => ({ ...p, author: { ...globalAuthor, ...(p.author || {}) } }));
  const errors = [];
  for (const p of projects) {
    for (const e of validateProject(p)) errors.push(`${p.name ?? p.id}: ${e}`);
  }
  if (errors.length) throw new Error(errors.join('\n'));

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, 'projects.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), site: config.site || { name: 'MataForge' }, projects }, null, 2)
  );
  if (existsSync(siteDir)) {
    cpSync(siteDir, outDir, { recursive: true });
  }
  if (existsSync(sharedDir)) {
    cpSync(sharedDir, join(outDir, 'shared'), { recursive: true });
  }
  return { projectCount: projects.length, outDir };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const r = build();
    console.log(`已生成 ${r.projectCount} 个项目 -> ${r.outDir}`);
  } catch (e) {
    console.error('构建失败:\n' + e.message);
    process.exit(1);
  }
}