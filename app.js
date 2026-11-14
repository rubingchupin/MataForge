let all = [];
let tagFilter = '';
let sortMode = 'default';

const STATUS = {
  production: { label: '生产', cls: 'production' },
  test: { label: '测试', cls: 'test' },
  dev: { label: '开发', cls: 'dev' },
};

async function init() {
  const res = await fetch('./projects.json');
  const data = await res.json();
  all = data.projects || [];
  document.getElementById('siteName').textContent = (data.site && data.site.name) || 'MataForge';
  render();
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function compareVersion(a, b) {
  const pa = String(a || '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b || '').split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x !== y) return x - y;
  }
  return 0;
}

function latestDate(p) {
  const dates = (p.changelog || []).map((c) => c.date).filter(Boolean).sort();
  return dates.length ? dates[dates.length - 1] : '';
}

function sorted(list) {
  const arr = list.slice();
  if (sortMode === 'name') {
    arr.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  } else if (sortMode === 'version') {
    arr.sort((a, b) => compareVersion(a.version, b.version));
  } else if (sortMode === 'updated') {
    arr.sort((a, b) => {
      const da = latestDate(a), db = latestDate(b);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return db.localeCompare(da);
    });
  }
  return arr;
}

function tagBtn(t, count) {
  const active = tagFilter === t ? ' active' : '';
  const n = count != null ? ` <span class="tag-n">${count}</span>` : '';
  return `<button type="button" class="tag${active}" data-tag="${esc(t)}">${esc(t)}${n}</button>`;
}

function logHtml(p) {
  return (p.changelog || []).map((c) => `
    <div class="release">
      <div class="rel-head"><strong>v${esc(c.version)}</strong><span>${esc(c.date)}</span></div>
      <ul>${(c.changes || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      ${c.body ? `<div class="md-body">${md(c.body)}</div>` : ''}
    </div>`).join('');
}

function card(p) {
  const author = p.author || {};
  const st = STATUS[p.status] || {};
  const tags = (p.tags || []).map((t) => tagBtn(t)).join('');
  const links = (p.links || []).filter((l) => l.url).map((l) => `<a class="plink" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label || l.url)}</a>`).join('');

  return `
    <article class="card">
      <div class="card-head">
        <img src="${esc(p.icon)}" alt="${esc(p.name)}" onerror="this.style.visibility='hidden'" />
        <div>
          <h2>${esc(p.name)}</h2>
          <div class="ver">v${esc(p.version)}</div>
        </div>
        ${st.label ? `<span class="badge ${st.cls}">${st.label}</span>` : ''}
      </div>
      <p class="desc">${esc(p.description || '')}</p>
      ${tags ? `<div class="tags">${tags}</div>` : ''}
      ${p.license ? `<div class="license">许可证：${esc(p.license)}</div>` : ''}
      <div class="author">
        ${author.avatar ? `<img src="${esc(author.avatar)}" alt="" onerror="this.style.display='none'" />` : ''}
        <span>${esc(author.name || '')}</span>
        ${author.url ? `<a href="${esc(author.url)}" target="_blank" rel="noopener">主页</a>` : ''}
      </div>
      ${author.info ? `<p class="author-info">${esc(author.info)}</p>` : ''}
      ${links ? `<div class="links">${links}</div>` : ''}
      <details class="log">
        <summary>更新日志</summary>
        ${logHtml(p) || '<p>暂无</p>'}
      </details>
      <div class="card-actions">
        <button type="button" class="detail-btn" data-id="${esc(p.id)}">详情</button>
        <button type="button" class="copy-json" data-id="${esc(p.id)}" title="复制该项目的 JSON 元数据">复制 JSON</button>
        <button type="button" class="download-json" data-id="${esc(p.id)}" title="下载该项目的 JSON 元数据文件">下载 JSON</button>
      </div>
    </article>
  `;
}

function render() {
  const q = (document.getElementById('search').value || '').trim().toLowerCase();
  const statusFilter = (document.querySelector('#statusFilter .active')?.dataset.status) || 'all';
  const filtered = sorted(all.filter((p) => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (tagFilter && !(p.tags || []).includes(tagFilter)) return false;
    if (!q) return true;
    const hay = [p.id, p.name, p.description, (p.author || {}).name, ...(p.tags || [])].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q);
  }));

  document.getElementById('count').textContent = `${filtered.length} / ${all.length} 个项目${tagFilter ? ` · 标签「${tagFilter}」` : ''}`;
  document.getElementById('grid').innerHTML = filtered.map(card).join('') || '<p class="empty">暂无项目</p>';
  renderTagCloud();
}

function renderTagCloud() {
  const counts = new Map();
  for (const p of all) for (const t of (p.tags || [])) counts.set(t, (counts.get(t) || 0) + 1);
  const tags = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const el = document.getElementById('tagCloud');
  if (!tags.length) {
    el.innerHTML = '';
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.innerHTML = tags.map(([t, n]) => tagBtn(t, n)).join('');
}

function toggleTag(tag) {
  tagFilter = tagFilter === tag ? '' : tag;
  render();
}

function downloadJsonById(id) {
  const p = all.find((x) => x.id === id);
  if (!p) return;
  const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${p.id || 'project'}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function copyTextFeedback(btn, fn) {
  fn().then(() => {
    const old = btn.textContent;
    btn.textContent = '已复制';
    setTimeout(() => { btn.textContent = old; }, 1200);
  }).catch(() => {});
}

function openDetail(id) {
  const p = all.find((x) => x.id === id);
  if (!p) return;
  const author = p.author || {};
  const st = STATUS[p.status] || {};
  const tags = (p.tags || []).map((t) => `<span class="tag-plain">${esc(t)}</span>`).join('');
  const links = (p.links || []).filter((l) => l.url).map((l) => `<a class="plink" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label || l.url)}</a>`).join('');

  document.getElementById('detailTitle').textContent = p.name || p.id;
  document.getElementById('detailBody').innerHTML = `
    <div class="detail-head">
      ${p.icon ? `<img src="${esc(p.icon)}" alt="" onerror="this.style.visibility='hidden'" />` : ''}
      <div>
        <h3>${esc(p.name || '未命名')}</h3>
        <div class="ver">v${esc(p.version)}</div>
      </div>
      ${st.label ? `<span class="badge ${st.cls}">${st.label}</span>` : ''}
    </div>
    ${p.description ? `<p class="desc">${esc(p.description)}</p>` : ''}
    ${tags ? `<div class="tags">${tags}</div>` : ''}
    ${p.license ? `<div class="license">许可证：${esc(p.license)}</div>` : ''}
    <div class="detail-author">
      ${author.avatar ? `<img src="${esc(author.avatar)}" alt="" onerror="this.style.display='none'" />` : ''}
      <div>
        <strong>${esc(author.name || '')}</strong>
        ${author.email ? `<div class="detail-email">${esc(author.email)}</div>` : ''}
        ${author.url ? `<a class="plink" href="${esc(author.url)}" target="_blank" rel="noopener">主页</a>` : ''}
      </div>
    </div>
    ${author.info ? `<p class="author-info">${esc(author.info)}</p>` : ''}
    ${links ? `<div class="links">${links}</div>` : ''}
    <details class="log" open>
      <summary>更新日志</summary>
      ${logHtml(p) || '<p>暂无</p>'}
    </details>
    <h4 class="detail-json-title">原始 JSON</h4>
    <pre class="detail-json">${esc(JSON.stringify(p, null, 2))}</pre>
    <div class="card-actions">
      <button type="button" id="copyDetailJson">复制 JSON</button>
      <button type="button" id="dlDetailJson">下载 JSON</button>
    </div>`;
  document.getElementById('detailModal').hidden = false;
  document.getElementById('copyDetailJson').addEventListener('click', function () {
    copyTextFeedback(this, () => navigator.clipboard.writeText(JSON.stringify(p, null, 2)));
  });
  document.getElementById('dlDetailJson').addEventListener('click', () => downloadJsonById(id));
}

function renderStats() {
  const statusCounts = { production: 0, test: 0, dev: 0, other: 0 };
  const tagCounts = new Map();
  let licensed = 0, withChangelog = 0;
  const authorSet = new Set();
  for (const p of all) {
    const s = STATUS[p.status] ? p.status : 'other';
    statusCounts[s]++;
    for (const t of (p.tags || [])) tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
    if (p.license) licensed++;
    if ((p.changelog || []).length) withChangelog++;
    if ((p.author || {}).name) authorSet.add(p.author.name);
  }
  const latest = all.filter((p) => latestDate(p)).sort((a, b) => latestDate(b).localeCompare(latestDate(a))).slice(0, 5);
  const stats = [
    [all.length, '项目总数'],
    [statusCounts.production, '生产'],
    [statusCounts.test, '测试'],
    [statusCounts.dev, '开发'],
    [tagCounts.size, '唯一标签'],
    [licensed, '有许可证'],
    [withChangelog, '有更新日志'],
    [authorSet.size, '作者数'],
  ];
  if (statusCounts.other) stats.push([statusCounts.other, '其他状态']);

  document.getElementById('statsBody').innerHTML = `
    <div class="stats-grid">
      ${stats.map(([n, label]) => `<div class="stat"><div class="stat-num">${n}</div><div class="stat-label">${label}</div></div>`).join('')}
    </div>
    <h4 class="stats-sub">最近更新</h4>
    <ul class="stats-latest">
      ${latest.map((p) => `<li><span class="stats-date">${esc(latestDate(p))}</span> ${esc(p.name)} <span class="ver">v${esc(p.version)}</span></li>`).join('') || '<li>暂无</li>'}
    </ul>`;
  document.getElementById('statsModal').hidden = false;
}

function md(src) {
  const escLocal = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const inline = (t) => {
    let out = escLocal(t);
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
        html += `<pre><code>${escLocal(codeBuf)}</code></pre>`;
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
  if (inCode) html += `<pre><code>${escLocal(codeBuf)}</code></pre>`;
  return html;
}

document.getElementById('search').addEventListener('input', render);
document.getElementById('sortSel').addEventListener('change', (e) => {
  sortMode = e.target.value;
  render();
});
document.getElementById('statusFilter').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  document.querySelectorAll('#statusFilter button').forEach((b) => b.classList.toggle('active', b === btn));
  render();
});
document.getElementById('tagCloud').addEventListener('click', (e) => {
  const t = e.target.closest('.tag');
  if (t) toggleTag(t.dataset.tag);
});
document.getElementById('grid').addEventListener('click', (e) => {
  const detailBtn = e.target.closest('.detail-btn');
  if (detailBtn) { openDetail(detailBtn.dataset.id); return; }
  const copyBtn = e.target.closest('.copy-json');
  if (copyBtn) {
    const p = all.find((x) => x.id === copyBtn.dataset.id);
    if (p) copyTextFeedback(copyBtn, () => navigator.clipboard.writeText(JSON.stringify(p, null, 2)));
    return;
  }
  const dlBtn = e.target.closest('.download-json');
  if (dlBtn) { downloadJsonById(dlBtn.dataset.id); return; }
  const tag = e.target.closest('.tag');
  if (tag) { toggleTag(tag.dataset.tag); return; }
});
document.getElementById('statsBtn').addEventListener('click', renderStats);
document.getElementById('closeStats').addEventListener('click', () => { document.getElementById('statsModal').hidden = true; });
document.getElementById('closeDetail').addEventListener('click', () => { document.getElementById('detailModal').hidden = true; });
for (const id of ['detailModal', 'statsModal']) {
  document.getElementById(id).addEventListener('click', (e) => {
    if (e.target.id === id) e.target.hidden = true;
  });
}
init();