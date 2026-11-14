import { createServer } from 'node:http';
import { readFile, readdir, stat, mkdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, loadProjects, loadConfig, validateProject } from '../scripts/build.mjs';
import { publish } from '../scripts/publish.mjs';
import { commit } from '../scripts/commit.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const editorDir = join(root, 'editor');
const distDir = join(root, 'dist');
const projectsDir = join(root, 'projects');
const sharedDir = join(root, 'shared');
const PORT = Number(process.env.PORT) || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.wasm': 'application/wasm',
};

function sendJson(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj, null, 2));
}

const MAX_BODY = 100 * 1024 * 1024; // 100MB，超出改用「打开本地目录」直接放入大型资源

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    let size = 0;
    let overflow = false;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        overflow = true;
        req.destroy();
        reject(new Error('请求体过大（超过 100MB），请使用「打开本地目录」直接放入大型资源'));
        return;
      }
      data += c;
    });
    req.on('end', () => {
      if (overflow) return;
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', (e) => {
      if (!overflow) reject(e);
    });
  });
}

function safeResolve(base, rel) {
  const full = normalize(join(base, rel));
  return full.startsWith(base) ? full : null;
}

function safeName(name) {
  const parts = String(name || '')
    .replace(/\\/g, '/')
    .split('/')
    .map((p) => p.trim())
    .filter((p) => p && p !== '.' && p !== '..');
  if (!parts.length) return '';
  return parts.join('/');
}

function uniqueSharedName(name) {
  if (!existsSync(join(sharedDir, name))) return name;
  const ext = extname(name);
  const base = name.slice(0, name.length - ext.length);
  let i = 1;
  let candidate;
  do {
    candidate = `${base}-${i}${ext}`;
    i++;
  } while (existsSync(join(sharedDir, candidate)));
  return candidate;
}

async function listSharedFiles() {
  const files = [];
  if (!existsSync(sharedDir)) return files;
  async function walk(dir, prefix) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const d of entries) {
      const rel = prefix ? `${prefix}/${d.name}` : d.name;
      if (d.isDirectory()) await walk(join(dir, d.name), rel);
      else if (d.isFile()) files.push(rel);
    }
  }
  await walk(sharedDir, '');
  return files.sort();
}

function openInFileManager(target) {
  const cmd = process.platform === 'win32' ? 'explorer.exe'
    : process.platform === 'darwin' ? 'open'
    : 'xdg-open';
  const args = process.platform === 'win32' ? [target] : [target];
  const child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
  child.on('error', () => {});
  child.unref();
}

async function serveStatic(res, base, rel) {
  const filePath = safeResolve(base, rel);
  if (!filePath) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }
  try {
    const s = await stat(filePath);
    if (s.isDirectory()) {
      await serveStatic(res, base, join(rel, 'index.html'));
      return;
    }
    const ext = extname(filePath).toLowerCase();
    const data = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  }
}

async function handleApi(req, res, pathname, url) {
  if (pathname === '/api/projects' && req.method === 'GET') {
    return sendJson(res, 200, { ok: true, projects: loadProjects() });
  }

  if (pathname === '/api/projects' && req.method === 'POST') {
    const proj = await readBody(req);
    const errors = validateProject(proj);
    if (errors.length) return sendJson(res, 400, { ok: false, errors });

    const id = String(proj.id || '').trim();
    if (!/^[a-z0-9-]+$/.test(id)) {
      return sendJson(res, 400, { ok: false, errors: ['ID 只能包含小写字母、数字、连字符'] });
    }
    const dir = join(projectsDir, id);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'mataforge.json'), JSON.stringify(proj, null, 2) + '\n', 'utf8');
    return sendJson(res, 200, { ok: true, project: proj });
  }

  if (pathname === '/api/projects/import' && req.method === 'POST') {
    const body = await readBody(req);
    const list = Array.isArray(body.projects) ? body.projects : [];
    const errors = [];
    let imported = 0;
    for (const proj of list) {
      const id = String(proj.id || '').trim();
      if (!/^[a-z0-9-]+$/.test(id)) {
        errors.push(`无效 ID: ${id || '(空)'}`);
        continue;
      }
      const verrs = validateProject(proj);
      if (verrs.length) {
        errors.push(...verrs.map((x) => `${id}: ${x}`));
        continue;
      }
      const dir = join(projectsDir, id);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, 'mataforge.json'), JSON.stringify(proj, null, 2) + '\n', 'utf8');
      imported++;
    }
    return sendJson(res, 200, { ok: true, imported, errors });
  }

  const delMatch = pathname.match(/^\/api\/projects\/([a-z0-9-]+)$/);
  if (delMatch && req.method === 'DELETE') {
    const dir = join(projectsDir, delMatch[1]);
    if (existsSync(dir)) {
      await rm(dir, { recursive: true, force: true });
      return sendJson(res, 200, { ok: true });
    }
    return sendJson(res, 404, { ok: false, error: '项目不存在' });
  }

  if (pathname === '/api/build' && req.method === 'POST') {
    const result = build();
    return sendJson(res, 200, { ok: true, ...result });
  }

  if (pathname === '/api/config' && req.method === 'GET') {
    return sendJson(res, 200, { ok: true, config: loadConfig() });
  }

  if (pathname === '/api/config' && req.method === 'POST') {
    const config = await readBody(req);
    const dir = join(root, 'config');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'site.json'), JSON.stringify(config, null, 2) + '\n', 'utf8');
    return sendJson(res, 200, { ok: true, config });
  }

  if (pathname === '/api/publish' && req.method === 'POST') {
    const body = await readBody(req);
    const result = publish({ message: body.message });
    return sendJson(res, 200, { ok: true, ...result });
  }

  if (pathname === '/api/commit' && req.method === 'POST') {
    const body = await readBody(req);
    const result = commit({ message: body.message, remote: body.remote, branch: body.branch });
    return sendJson(res, 200, { ok: true, ...result });
  }

  if (pathname === '/api/shared' && req.method === 'GET') {
    const files = await listSharedFiles();
    return sendJson(res, 200, { ok: true, files });
  }

  if (pathname === '/api/shared' && req.method === 'POST') {
    const body = await readBody(req);
    const name = safeName(body.name);
    if (!name) return sendJson(res, 400, { ok: false, error: '文件名无效' });
    const raw = String(body.data || '');
    const m = raw.match(/^data:.*?;base64,([\s\S]*)$/);
    const buf = Buffer.from(m ? m[1] : raw, 'base64');
    const overwrite = body.overwrite === true;
    const finalName = overwrite ? name : uniqueSharedName(name);
    const file = join(sharedDir, finalName);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, buf);
    return sendJson(res, 200, { ok: true, name: finalName, deduped: !overwrite && finalName !== name });
  }

  if (pathname === '/api/shared' && req.method === 'DELETE') {
    const name = safeName(url.searchParams.get('name'));
    if (!name) return sendJson(res, 400, { ok: false, error: '文件名无效' });
    const file = join(sharedDir, name);
    if (existsSync(file)) {
      await rm(file, { force: true });
      return sendJson(res, 200, { ok: true });
    }
    return sendJson(res, 404, { ok: false, error: '文件不存在' });
  }

  if (pathname === '/api/shared/open' && req.method === 'POST') {
    await mkdir(sharedDir, { recursive: true });
    openInFileManager(sharedDir);
    return sendJson(res, 200, { ok: true, path: sharedDir });
  }

  return sendJson(res, 404, { ok: false, error: '未知接口' });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = decodeURIComponent(url.pathname);

  try {
    if (pathname.startsWith('/api/')) {
      return await handleApi(req, res, pathname, url);
    }
    if (pathname === '/preview' || pathname.startsWith('/preview/')) {
      const rel = pathname === '/preview' ? 'index.html' : pathname.slice('/preview/'.length);
      return await serveStatic(res, distDir, rel);
    }
    if (pathname.startsWith('/shared/')) {
      return await serveStatic(res, sharedDir, pathname.slice('/shared/'.length));
    }
    if (pathname === '/') {
      return await serveStatic(res, editorDir, 'index.html');
    }
    return await serveStatic(res, editorDir, pathname.slice(1));
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: e.message });
  }
});

server.listen(PORT, () => {
  try {
    build();
    console.log('预览数据已生成');
  } catch (e) {
    console.warn('启动时构建失败（可稍后在界面点「生成网站」）:', e.message);
  }
  console.log(`MataForge 编辑器已启动: http://localhost:${PORT}`);
});