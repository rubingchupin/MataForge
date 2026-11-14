let projects = [];
let currentId = null;
let originalId = null;
let isNew = false;
let saveTimer = null;
let globalConfig = {};
let configSaveTimer = null;
let statusFilter = 'all';
let sharedSelection = new Set();

const listEl = document.getElementById('list');
const formEl = document.getElementById('form');
const emptyEl = document.getElementById('empty');
const toastEl = document.getElementById('toast');
const searchEl = document.getElementById('search');
const previewCard = document.getElementById('previewCard');
const newBtn = document.getElementById('newBtn');
const buildBtn = document.getElementById('buildBtn');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');
const previewLink = document.getElementById('previewLink');
const settingsBtn = document.getElementById('settingsBtn');
const publishBtn = document.getElementById('publishBtn');
const commitBtn = document.getElementById('commitBtn');
const settingsModal = document.getElementById('settingsModal');
const settingsForm = document.getElementById('settingsForm');
const closeSettingsBtn = document.getElementById('closeSettings');
const sharedFile = document.getElementById('sharedFile');
const uploadSharedBtn = document.getElementById('uploadSharedBtn');
const openSharedDirBtn = document.getElementById('openSharedDirBtn');
const sharedList = document.getElementById('sharedList');
const sharedSubdir = document.getElementById('sharedSubdir');
const sharedToolbar = document.getElementById('sharedToolbar');
const sharedSelectAll = document.getElementById('sharedSelectAll');
const deleteSharedSelected = document.getElementById('deleteSharedSelected');

const STATUS = {
  production: { label: '生产', cls: 'production' },
  test: { label: '测试', cls: 'test' },
  dev: { label: '开发', cls: 'dev' },
};
const statusOptions = Object.keys(STATUS);

const fieldDefs = [
  {
    section: '基本信息',
    fields: [
      { key: 'id', label: 'ID（唯一，小写字母/数字/连字符）', type: 'text' },
      { key: 'name', label: '项目名称', type: 'text' },
      { key: 'icon', label: '图标 URL', type: 'text' },
      { key: 'version', label: '版本号', type: 'text', placeholder: '如 1.0.0 / v1.2 / 1.2.3-beta' },
      { key: 'status', label: '状态（生产 / 测试 / 开发）', type: 'select', options: statusOptions, default: 'test' },
      { key: 'description', label: '项目简介', type: 'text' },
      { key: 'tags', label: '标签（用逗号分隔）', type: 'tags', placeholder: '前端, 工具, 运行时' },
      { key: 'license', label: '许可证', type: 'text', placeholder: 'MIT / Apache-2.0 / GPL-3.0' },
    ],
  },
  {
    section: '项目链接',
    fields: [
      { key: 'links', label: '相关链接（主页 / 仓库 / 文档等）', type: 'links' },
    ],
  },
];

const configDefs = [
  { key: 'site.name', label: '站点名称', type: 'text' },
  { key: 'site.url', label: '站点公开地址（可选，用于生成资源公共服务链接，如 https://user.github.io/repo）', type: 'text' },
  { key: 'author.name', label: '作者名称（所有项目共享）', type: 'text' },
  { key: 'author.avatar', label: '头像 URL', type: 'text' },
  { key: 'author.url', label: '主页 URL', type: 'text' },
  { key: 'author.email', label: '邮箱', type: 'text' },
  { key: 'author.info', label: '作者信息', type: 'textarea' },
];

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function md(src) {
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const inline = (t) => {
    let out = esc(t);
    out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/(^|[^*\w])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    return out;
  };
  const lines = String(src ?? '').split(/\r?\n/);
  let html = '';
  let list = null;
  let inCode = false;
  let codeBuf = '';
  const closeList = () => { if (list) { html += `</${list}>`; list = null; } };

  for (const line of lines) {
    if (/^```/.test(line.trim())) {
      if (inCode) {
        html += `<pre><code>${esc(codeBuf)}</code></pre>`;
        codeBuf = '';
        inCode = false;
      } else {
        closeList();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeBuf += (codeBuf ? '\n' : '') + line;
      continue;
    }
    const t = line.trim();
    if (!t) { closeList(); continue; }

    const heading = t.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      closeList();
      const lvl = Math.min(heading[1].length + 2, 6);
      html += `<h${lvl}>${inline(heading[2])}</h${lvl}>`;
      continue;
    }

    const ul = t.match(/^[-*+]\s+(.*)$/);
    if (ul) {
      if (list !== 'ul') { closeList(); html += '<ul>'; list = 'ul'; }
      html += `<li>${inline(ul[1])}</li>`;
      continue;
    }

    const ol = t.match(/^\d+[.)]\s+(.*)$/);
    if (ol) {
      if (list !== 'ol') { closeList(); html += '<ol>'; list = 'ol'; }
      html += `<li>${inline(ol[1])}</li>`;
      continue;
    }

    closeList();
    html += `<p>${inline(t)}</p>`;
  }
  closeList();
  if (inCode) html += `<pre><code>${esc(codeBuf)}</code></pre>`;
  return html;
}

function parseVersion(str) {
  const m = String(str || '').trim().match(/^([^\d]*?)(\d+(?:\.\d+)*)(.*)$/);
  if (!m) return null;
  return {
    prefix: m[1],
    nums: m[2].split('.').map((x) => parseInt(x, 10)),
    suffix: m[3],
  };
}

function formatVersion(prefix, nums) {
  return prefix + nums.join('.');
}

function bumpVersion(str, level) {
  const v = parseVersion(str);
  if (!v) return { value: str, carried: false };
  const seg = v.nums.slice();
  while (seg.length < 3) seg.push(0);
  let carried = false;

  if (level === 'patch') {
    seg[2] += 1;
    if (seg[2] > 99) { seg[2] = 0; seg[1] += 1; carried = true; }
    if (seg[1] > 99) { seg[1] = 0; seg[0] += 1; carried = true; }
  } else if (level === 'minor') {
    seg[1] += 1;
    if (seg[1] > 99) { seg[1] = 0; seg[0] += 1; carried = true; }
    seg[2] = 0;
  } else {
    seg[0] += 1;
    seg[1] = 0;
    seg[2] = 0;
  }

  return { value: formatVersion(v.prefix, seg.slice(0, 3)), carried };
}

function makeVersionBump(input) {
  const box = document.createElement('div');
  box.className = 'version-bump';
  const defs = [
    { level: 'patch', text: '小版本', title: '补丁 +1（如 1.0.0 → 1.0.1）' },
    { level: 'minor', text: '大版本', title: '次版本 +1（如 1.0.0 → 1.1.0）' },
    { level: 'major', text: '跨代', title: '主版本 +1（如 1.0.0 → 2.0.0）' },
  ];
  for (const d of defs) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = d.text;
    btn.title = d.title;
    btn.addEventListener('click', () => {
      const res = bumpVersion(input.value, d.level);
      input.value = res.value;
      showErrors(validate(collect()));
      edit();
      toast((res.carried ? '版本已进位：' : '版本更新：') + res.value);
    });
    box.appendChild(btn);
  }
  return box;
}

function toast(msg, isError = false) {
  toastEl.textContent = msg;
  toastEl.className = 'show' + (isError ? ' error' : '');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { toastEl.className = ''; }, 2200);
}

async function api(path, opts = {}) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || (data.errors && data.errors.join('; ')) || res.statusText);
  }
  return data;
}

function getByPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}

function setByPath(obj, path, val) {
  const keys = path.split('.');
  let o = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (o[keys[i]] == null) o[keys[i]] = {};
    o = o[keys[i]];
  }
  o[keys[keys.length - 1]] = val;
}

function validate(proj) {
  const errors = {};
  if (!proj.id) errors.id = '必填';
  else if (!/^[a-z0-9-]+$/.test(proj.id)) errors.id = '只能是小写字母、数字、连字符';
  if (!proj.name) errors.name = '必填';
  if (!proj.icon) errors.icon = '必填';
  if (!proj.version) errors.version = '必填';
  else if (!/^[vV]?\d+(?:\.\d+)*(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(proj.version)) errors.version = '格式如 1.0.0 / v1.2 / 1.2.3-beta';
  return errors;
}

async function loadList() {
  const data = await api('/api/projects');
  projects = data.projects || [];
  renderList();
}

function renderList() {
  const q = searchEl.value.trim().toLowerCase();
  const list = projects.filter((p) => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (!q) return true;
    const hay = [p.id, p.name, p.description, (p.author || {}).name, ...(p.tags || [])].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q);
  });

  listEl.innerHTML = list
    .map((p) => {
      const ok = Object.keys(validate(p)).length === 0;
      const st = STATUS[p.status] || {};
      return `
      <div class="item ${p.id === currentId ? 'active' : ''}" data-id="${escapeHtml(p.id)}">
        <img src="${escapeHtml(p.icon)}" alt="" onerror="this.style.visibility='hidden'" />
        <div class="meta">
          <div class="name">${escapeHtml(p.name)}</div>
          <div class="sub">v${escapeHtml(p.version)} · ${escapeHtml((p.author || {}).name || '')}</div>
        </div>
        ${st.label ? `<span class="badge ${st.cls}">${st.label}</span>` : ''}
        <span class="dot ${ok ? 'ok' : 'bad'}" title="${ok ? '信息完整' : '信息不完整'}"></span>
      </div>`;
    })
    .join('') || '<div class="hint">暂无项目</div>';

  listEl.querySelectorAll('.item').forEach((el) => {
    el.addEventListener('click', () => selectProject(el.dataset.id));
  });
}

function makeEntry(c) {
  const entry = document.createElement('div');
  entry.className = 'cl-entry';
  entry.innerHTML = `
    <div class="cl-head">
      <input class="cl-version" placeholder="版本 1.0.0" value="${escapeHtml(c.version || '')}" />
      <input class="cl-date" type="date" value="${escapeHtml(c.date || '')}" />
      <button type="button" class="rm-entry">删除</button>
    </div>
    <div class="cl-items"></div>
    <button type="button" class="add-item">＋ 添加变更</button>
    <textarea class="cl-body" rows="4" placeholder="Markdown 说明（可选，支持标题/列表/代码块等）">${escapeHtml(c.body || '')}</textarea>`;
  const items = entry.querySelector('.cl-items');
  (c.changes || []).forEach((ch) => items.appendChild(itemRow(ch)));
  entry.querySelector('.cl-version').addEventListener('input', edit);
  entry.querySelector('.cl-date').addEventListener('input', edit);
  entry.querySelector('.cl-body').addEventListener('input', edit);
  entry.querySelector('.add-item').addEventListener('click', () => {
    items.appendChild(itemRow(''));
    edit();
  });
  entry.querySelector('.rm-entry').addEventListener('click', () => {
    entry.remove();
    edit();
  });
  return entry;
}

function itemRow(text) {
  const row = document.createElement('div');
  row.className = 'cl-item';
  row.innerHTML = `<input placeholder="变更描述" value="${escapeHtml(text || '')}" /><button type="button" class="rm-item">×</button>`;
  row.querySelector('input').addEventListener('input', edit);
  row.querySelector('.rm-item').addEventListener('click', () => {
    row.remove();
    edit();
  });
  return row;
}

function makeLinkRow(l) {
  const row = document.createElement('div');
  row.className = 'link-row';
  row.innerHTML = `
    <input class="link-label" placeholder="名称（如 主页 / 文档）" value="${escapeHtml(l.label || '')}" />
    <input class="link-url" placeholder="https://..." value="${escapeHtml(l.url || '')}" />
    <button type="button" class="rm-link">×</button>`;
  row.querySelector('.link-label').addEventListener('input', edit);
  row.querySelector('.link-url').addEventListener('input', edit);
  row.querySelector('.rm-link').addEventListener('click', () => {
    row.remove();
    edit();
  });
  return row;
}

function makeImageUpload(input, label, prefix, forceName = false) {
  const box = document.createElement('div');
  box.className = 'icon-upload';
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.hidden = true;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = label || '上传本地图片';
  btn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const dot = file.name.lastIndexOf('.');
        const ext = dot > 0 ? file.name.slice(dot + 1).toLowerCase() : '';
        const name = forceName ? (ext ? `${prefix}.${ext}` : prefix) : file.name;
        const body = forceName ? { name, data: reader.result, overwrite: true } : { name, data: reader.result };
        const r = await api('/api/shared', { method: 'POST', body: JSON.stringify(body) });
        input.value = `shared/${r.name || name}`;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        toast(forceName ? `已更新头像：${r.name}` : (r.deduped ? `已上传（重名自动改名）：${r.name}` : '已上传到公共资源'));
      } catch (e) {
        toast('上传失败: ' + e.message, true);
      }
    };
    reader.readAsDataURL(file);
  });
  box.append(btn, fileInput);
  return box;
}

function renderForm(proj) {
  formEl.innerHTML = '';
  emptyEl.hidden = true;
  formEl.hidden = false;

  for (const sec of fieldDefs) {
    const h = document.createElement('h2');
    h.textContent = sec.section;
    formEl.appendChild(h);

    for (const f of sec.fields) {
      if (f.type === 'links') {
        const wrap = document.createElement('div');
        wrap.className = 'field';
        const label = document.createElement('label');
        label.textContent = f.label;
        const box = document.createElement('div');
        box.className = 'links-editor';
        const links = getByPath(proj, f.key) || [];
        links.forEach((l) => box.appendChild(makeLinkRow(l)));
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'add-link';
        addBtn.textContent = '＋ 添加链接';
        addBtn.addEventListener('click', () => {
          box.appendChild(makeLinkRow({ label: '', url: '' }));
          edit();
        });
        box.appendChild(addBtn);
        wrap.append(label, box);
        formEl.appendChild(wrap);
        continue;
      }

      const isTextarea = f.type === 'textarea';
      const wrap = document.createElement('div');
      wrap.className = 'field';
      const label = document.createElement('label');
      label.textContent = f.label;
      let input;
      if (f.type === 'select') {
        input = document.createElement('select');
        for (const opt of f.options || []) {
          const o = document.createElement('option');
          o.value = opt;
          o.textContent = (STATUS[opt] || {}).label || opt;
          input.appendChild(o);
        }
      } else if (f.type === 'tags') {
        input = document.createElement('input');
        input.type = 'text';
        input.dataset.type = 'tags';
      } else {
        input = document.createElement(isTextarea ? 'textarea' : 'input');
        if (!isTextarea) input.type = f.type;
      }
      if (f.placeholder) input.placeholder = f.placeholder;
      input.dataset.key = f.key;
      input.value = (f.type === 'tags')
        ? (getByPath(proj, f.key) || []).join(', ')
        : (getByPath(proj, f.key) || f.default || '');
      input.addEventListener('input', edit);
      input.addEventListener('blur', () => showErrors(validate(collect())));
      const err = document.createElement('small');
      err.className = 'field-error';
      wrap.append(label, input, err);
      if (f.key === 'version') {
        wrap.appendChild(makeVersionBump(input));
      }
      if (f.key === 'icon') {
        wrap.appendChild(makeImageUpload(input, '上传本地图标', 'icon'));
      }
      formEl.appendChild(wrap);
    }
  }

  const h = document.createElement('h2');
  h.textContent = '更新日志';
  formEl.appendChild(h);

  const addEntryBtn = document.createElement('button');
  addEntryBtn.type = 'button';
  addEntryBtn.className = 'add-entry';
  addEntryBtn.textContent = '＋ 添加一条版本日志';
  addEntryBtn.addEventListener('click', () => {
    cl.prepend(makeEntry({ version: '', date: '', changes: [] }));
    edit();
  });
  formEl.appendChild(addEntryBtn);

  const cl = document.createElement('div');
  cl.className = 'changelog';
  (proj.changelog || []).forEach((c) => cl.appendChild(makeEntry(c)));
  formEl.appendChild(cl);

  const footer = document.createElement('div');
  footer.className = 'footer';
  footer.innerHTML = `
    <button type="button" id="saveBtn" class="primary">保存</button>
    <button type="button" id="copyBtn">复制 JSON</button>
    <button type="button" id="dlBtn">下载 JSON</button>
    <button type="button" id="dupBtn">复制</button>
    <button type="button" id="delBtn" class="danger">删除</button>`;
  formEl.appendChild(footer);
  formEl.querySelector('#saveBtn').addEventListener('click', () => {
    clearTimeout(saveTimer);
    save();
  });
  formEl.querySelector('#copyBtn').addEventListener('click', copyProjectJson);
  formEl.querySelector('#dlBtn').addEventListener('click', downloadProjectJson);
  formEl.querySelector('#dupBtn').addEventListener('click', duplicateProject);
  formEl.querySelector('#delBtn').addEventListener('click', removeProject);

  updatePreview();
}

function collect() {
  const proj = {};
  formEl.querySelectorAll('[data-key]').forEach((el) => {
    const v = el.value.trim();
    if (el.dataset.type === 'tags') {
      const arr = v.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
      if (arr.length) setByPath(proj, el.dataset.key, arr);
    } else if (v !== '') {
      setByPath(proj, el.dataset.key, v);
    }
  });
  proj.links = [];
  formEl.querySelectorAll('.link-row').forEach((row) => {
    const label = row.querySelector('.link-label').value.trim();
    const url = row.querySelector('.link-url').value.trim();
    if (label || url) proj.links.push({ label, url });
  });
  proj.changelog = [];
  formEl.querySelectorAll('.cl-entry').forEach((entry) => {
    const version = entry.querySelector('.cl-version').value.trim();
    const date = entry.querySelector('.cl-date').value;
    const changes = [...entry.querySelectorAll('.cl-item input')]
      .map((i) => i.value.trim())
      .filter(Boolean);
    const body = entry.querySelector('.cl-body').value.trim();
    const item = { version, date, changes };
    if (body) item.body = body;
    if (version || date || body) proj.changelog.push(item);
  });
  return proj;
}

function showErrors(errors) {
  formEl.querySelectorAll('.field').forEach((w) => w.classList.remove('has-error'));
  formEl.querySelectorAll('.field-error').forEach((e) => (e.textContent = ''));
  for (const [key, msg] of Object.entries(errors)) {
    const input = formEl.querySelector(`[data-key="${key}"]`);
    if (input) {
      input.closest('.field').classList.add('has-error');
      const err = input.closest('.field').querySelector('.field-error');
      if (err) err.textContent = msg;
    }
  }
}

function edit() {
  scheduleSave();
  updatePreview();
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const proj = collect();
    const errors = validate(proj);
    showErrors(errors);
    if (Object.keys(errors).length) return;
    save();
  }, 800);
}

async function save() {
  const proj = collect();
  const errors = validate(proj);
  showErrors(errors);
  if (Object.keys(errors).length) {
    toast('请先修正表单错误', true);
    return;
  }
  try {
    await api('/api/projects', { method: 'POST', body: JSON.stringify(proj) });
    if (originalId && originalId !== proj.id) {
      await api(`/api/projects/${originalId}`, { method: 'DELETE' }).catch(() => {});
    }
    originalId = proj.id;
    currentId = proj.id;
    isNew = false;
    toast('已保存');
    await loadList();
  } catch (e) {
    toast('保存失败: ' + e.message, true);
  }
}

async function selectProject(id) {
  currentId = id;
  originalId = id;
  isNew = false;
  const p = projects.find((x) => x.id === id);
  if (!p) return;
  renderForm(p);
  renderList();
}

function newProject() {
  currentId = null;
  originalId = null;
  isNew = true;
  renderForm({ id: '', name: '', icon: '', version: '1.0.0', status: 'test', description: '', author: {}, changelog: [] });
  renderList();
}

function duplicateProject() {
  if (!currentId) return;
  const p = projects.find((x) => x.id === currentId);
  if (!p) return;
  const copy = JSON.parse(JSON.stringify(p));
  copy.id = p.id + '-copy';
  copy.name = p.name + '（副本）';
  currentId = null;
  originalId = null;
  isNew = true;
  renderForm(copy);
  renderList();
  toast('已创建副本，可修改后自动保存');
}

async function copyProjectJson() {
  const proj = collect();
  try {
    await navigator.clipboard.writeText(JSON.stringify(proj, null, 2));
    toast('已复制项目 JSON');
  } catch {
    toast('复制失败，请手动选择 JSON 内容', true);
  }
}

function downloadProjectJson() {
  const proj = collect();
  const blob = new Blob([JSON.stringify(proj, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${proj.id || 'project'}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('已下载项目 JSON');
}

async function removeProject() {
  if (!currentId) return;
  if (!confirm(`确定删除项目「${currentId}」吗？`)) return;
  try {
    await api(`/api/projects/${currentId}`, { method: 'DELETE' });
    toast('已删除');
    currentId = null;
    originalId = null;
    formEl.hidden = true;
    emptyEl.hidden = false;
    previewCard.innerHTML = '';
    await loadList();
  } catch (e) {
    toast('删除失败: ' + e.message, true);
  }
}

async function buildSite() {
  try {
    const r = await api('/api/build', { method: 'POST' });
    toast(`生成成功，共 ${r.projectCount} 个项目`);
    previewLink.setAttribute('href', '/preview?t=' + Date.now());
  } catch (e) {
    toast('生成失败: ' + e.message, true);
  }
}

async function exportAll() {
  const data = await api('/api/projects');
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'mataforge-projects.json';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('已导出');
}

async function importProjects(e) {
  const file = e.target.files[0];
  if (!file) return;
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    toast('JSON 解析失败', true);
    return;
  }
  const list = Array.isArray(data) ? data : data.projects;
  if (!Array.isArray(list)) {
    toast('格式不正确', true);
    return;
  }
  try {
    const r = await api('/api/projects/import', { method: 'POST', body: JSON.stringify({ projects: list }) });
    toast(`已导入 ${r.imported} 个项目` + (r.errors && r.errors.length ? `，${r.errors.length} 个失败` : ''));
    await loadList();
  } catch (err) {
    toast('导入失败: ' + err.message, true);
  }
  e.target.value = '';
}

function previewMarkup(p) {
  const author = (p.author && p.author.name) ? p.author : (globalConfig.author || {});
  const st = STATUS[p.status] || {};
  const tags = (p.tags || []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('');
  const links = (p.links || []).filter((l) => l.url).map((l) => `<a class="plink" href="${escapeHtml(l.url)}" target="_blank" rel="noopener">${escapeHtml(l.label || l.url)}</a>`).join('');
  const log = (p.changelog || [])
    .map(
      (c) => `
      <div class="release">
        <div class="rel-head"><strong>v${escapeHtml(c.version)}</strong><span>${escapeHtml(c.date)}</span></div>
        <ul>${(c.changes || []).map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>
        ${c.body ? `<div class="md-body">${md(c.body)}</div>` : ''}
      </div>`
    )
    .join('');
  return `
    <article class="card">
      <div class="card-head">
        <img src="${escapeHtml(p.icon)}" alt="" onerror="this.style.visibility='hidden'" />
        <div>
          <h2>${escapeHtml(p.name) || '未命名'}</h2>
          <div class="ver">v${escapeHtml(p.version)}</div>
        </div>
        ${st.label ? `<span class="badge ${st.cls}">${st.label}</span>` : ''}
      </div>
      <p class="desc">${escapeHtml(p.description || '')}</p>
      ${tags ? `<div class="tags">${tags}</div>` : ''}
      ${p.license ? `<div class="license">许可证：${escapeHtml(p.license)}</div>` : ''}
      <div class="author">
        ${author.avatar ? `<img src="${escapeHtml(author.avatar)}" alt="" onerror="this.style.display='none'" />` : ''}
        <span>${escapeHtml(author.name || '')}</span>
      </div>
      ${links ? `<div class="links">${links}</div>` : ''}
      ${log ? `<div class="log-preview">${log}</div>` : ''}
    </article>`;
}

function updatePreview() {
  previewCard.innerHTML = previewMarkup(collect());
}

newBtn.addEventListener('click', newProject);
buildBtn.addEventListener('click', buildSite);
exportBtn.addEventListener('click', exportAll);
importBtn.addEventListener('click', () => importFile.click());
importFile.addEventListener('change', importProjects);
searchEl.addEventListener('input', renderList);
settingsBtn.addEventListener('click', openSettings);
closeSettingsBtn.addEventListener('click', closeSettings);
settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) closeSettings();
});
publishBtn.addEventListener('click', publishSite);
commitBtn.addEventListener('click', commitCode);
uploadSharedBtn.addEventListener('click', () => sharedFile.click());
sharedFile.addEventListener('change', uploadSharedFiles);
openSharedDirBtn.addEventListener('click', openSharedDir);
document.getElementById('statusFilter').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  statusFilter = btn.dataset.status;
  document.querySelectorAll('#statusFilter button').forEach((b) => b.classList.toggle('active', b === btn));
  renderList();
});

async function loadConfig() {
  const data = await api('/api/config');
  globalConfig = data.config || {};
  renderSettingsForm();
}

function renderSettingsForm() {
  settingsForm.innerHTML = '';
  for (const f of configDefs) {
    const isTextarea = f.type === 'textarea';
    const wrap = document.createElement('div');
    wrap.className = 'field';
    const label = document.createElement('label');
    label.textContent = f.label;
    const input = document.createElement(isTextarea ? 'textarea' : 'input');
    if (!isTextarea) input.type = f.type;
    input.dataset.key = f.key;
    input.value = getByPath(globalConfig, f.key) || '';
    input.addEventListener('input', scheduleConfigSave);
    wrap.append(label, input);
    if (f.key === 'author.avatar') {
      wrap.appendChild(makeImageUpload(input, '上传本地头像', 'avatar', true));
    }
    settingsForm.appendChild(wrap);
  }
}

function collectConfig() {
  const cfg = {};
  settingsForm.querySelectorAll('[data-key]').forEach((el) => {
    const v = el.value.trim();
    if (v !== '') setByPath(cfg, el.dataset.key, v);
  });
  if (!cfg.site || !cfg.site.name) cfg.site = { name: 'MataForge' };
  return cfg;
}

function scheduleConfigSave() {
  clearTimeout(configSaveTimer);
  configSaveTimer = setTimeout(saveConfig, 800);
}

async function saveConfig() {
  const cfg = collectConfig();
  try {
    await api('/api/config', { method: 'POST', body: JSON.stringify(cfg) });
    globalConfig = cfg;
    toast('全局设置已保存');
  } catch (e) {
    toast('保存失败: ' + e.message, true);
  }
}

function openSettings() {
  renderSettingsForm();
  loadShared();
  settingsModal.hidden = false;
}

function closeSettings() {
  settingsModal.hidden = true;
}

async function publishSite() {
  if (!confirm('确定要构建并上传到 GitHub 的 assets 分支吗？')) return;
  toast('正在构建并上传，请稍候...');
  try {
    const r = await api('/api/publish', { method: 'POST', body: JSON.stringify({}) });
    toast(`已上传到 ${r.remote}/${r.branch}`);
  } catch (e) {
    toast('上传失败: ' + e.message, true);
  }
}

async function commitCode() {
  if (!confirm('确定要提交所有代码并推送到远程主分支吗？\n将排除：projects/（项目配置）、config/（站点配置）、shared/（共享文件）、dist/（构建文件）、node_modules/')) return;
  toast('正在提交并推送，请稍候...');
  try {
    const r = await api('/api/commit', { method: 'POST', body: JSON.stringify({}) });
    toast(`已提交并推送到 ${r.remote}/${r.branch}`);
  } catch (e) {
    toast('提交失败: ' + e.message, true);
  }
}

async function loadShared() {
  try {
    const data = await api('/api/shared');
    renderSharedList(data.files || []);
  } catch {
    renderSharedList([]);
  }
}

async function openSharedDir() {
  try {
    const r = await api('/api/shared/open', { method: 'POST', body: JSON.stringify({}) });
    toast(r.path ? `已打开目录：${r.path}` : '已打开本地 shared/ 目录');
    loadShared();
  } catch (e) {
    toast('打开目录失败: ' + e.message, true);
  }
}

const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp', 'avif'];

function isImageFile(name) {
  return IMAGE_EXT.includes((name.split('.').pop() || '').toLowerCase());
}

function sharedRel(name) {
  return 'shared/' + name.split('/').map(encodeURIComponent).join('/');
}

function sharedPublicUrl(name) {
  const base = ((globalConfig.site && globalConfig.site.url) || '').replace(/\/+$/, '');
  return base ? `${base}/${sharedRel(name)}` : sharedRel(name);
}

function renderSharedList(files) {
  sharedList.innerHTML = '';
  sharedSelection = new Set();
  sharedToolbar.hidden = !files.length;
  sharedSelectAll.checked = false;
  if (!files.length) {
    const li = document.createElement('li');
    li.className = 'shared-empty';
    li.textContent = '暂无共享文件，可上传任意类型资源（图标、字体、音频、脚本、数据等）';
    sharedList.appendChild(li);
    return;
  }
  for (const f of files) {
    const li = document.createElement('li');
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.className = 'shared-check';
    chk.dataset.name = f;
    chk.title = '勾选后可用「删除选中」批量删除';
    chk.addEventListener('change', () => {
      if (chk.checked) sharedSelection.add(f);
      else sharedSelection.delete(f);
      sharedSelectAll.checked = sharedSelection.size === files.length;
    });

    if (isImageFile(f)) {
      const thumb = document.createElement('img');
      thumb.className = 'shared-thumb';
      thumb.src = '/shared/' + f.split('/').map(encodeURIComponent).join('/');
      thumb.alt = '';
      thumb.loading = 'lazy';
      li.appendChild(thumb);
    }

    const name = document.createElement('span');
    name.className = 'shared-name';
    name.textContent = f;
    name.title = f;
    const path = document.createElement('code');
    path.className = 'shared-path';
    path.textContent = sharedPublicUrl(f);
    path.title = sharedPublicUrl(f);
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'copy-shared';
    copy.textContent = '复制链接';
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(sharedPublicUrl(f));
        toast('已复制链接');
      } catch {
        toast('复制失败', true);
      }
    });
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'rm-item';
    del.textContent = '删除';
    del.addEventListener('click', () => deleteShared(f));
    li.append(chk, name, path, copy, del);
    sharedList.appendChild(li);
  }
}

function uploadSharedFiles() {
  const files = Array.from(sharedFile.files || []);
  sharedFile.value = '';
  if (!files.length) return;
  const largeFiles = files.filter((f) => f.size > 15 * 1024 * 1024);
  if (largeFiles.length) {
    toast(`检测到 ${largeFiles.length} 个大文件（>15MB），建议使用「打开本地目录」直接放入 shared/ 目录`, true);
  }
  const sub = sharedSubdir.value.trim()
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .filter((p) => p && p !== '.' && p !== '..')
    .join('/');
  const prefix = sub ? sub + '/' : '';
  files.forEach((file) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const r = await api('/api/shared', { method: 'POST', body: JSON.stringify({ name: prefix + file.name, data: reader.result }) });
        toast(r.deduped ? `已上传（重名自动改名）：${r.name}` : `已上传 ${r.name}`);
        loadShared();
      } catch (e) {
        toast(`上传 ${file.name} 失败: ${e.message}`, true);
      }
    };
    reader.readAsDataURL(file);
  });
}

async function deleteShared(name) {
  if (!confirm(`确定删除资源 ${name} 吗？`)) return;
  try {
    await api('/api/shared?name=' + encodeURIComponent(name), { method: 'DELETE' });
    toast('已删除 ' + name);
    loadShared();
  } catch (e) {
    toast('删除失败: ' + e.message, true);
  }
}

async function deleteSharedSelectedFiles() {
  const names = Array.from(sharedSelection);
  if (!names.length) {
    toast('请先勾选要删除的资源', true);
    return;
  }
  if (!confirm(`确定删除选中的 ${names.length} 个资源吗？`)) return;
  let ok = 0;
  for (const name of names) {
    try {
      await api('/api/shared?name=' + encodeURIComponent(name), { method: 'DELETE' });
      ok++;
    } catch (e) {
      toast(`删除 ${name} 失败: ${e.message}`, true);
    }
  }
  if (ok) toast(`已删除 ${ok} 个资源`);
  loadShared();
}

sharedSelectAll.addEventListener('change', () => {
  sharedList.querySelectorAll('.shared-check').forEach((c) => {
    c.checked = sharedSelectAll.checked;
    if (sharedSelectAll.checked) sharedSelection.add(c.dataset.name);
    else sharedSelection.delete(c.dataset.name);
  });
});
deleteSharedSelected.addEventListener('click', deleteSharedSelectedFiles);

loadList();
loadConfig();