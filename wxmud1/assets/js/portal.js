/* ============================================================
   门户首页 / 工具包 / 流程与插件
   —— 插件数据按需加载，不影响首页首屏
   ============================================================ */
(function () {
  'use strict';

  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
  const fmt = n => n >= 10000 ? (n / 10000).toFixed(1).replace(/\.0$/, '') + 'w' : String(n | 0);

  // 触发条件：可能是字符串、对象或空
  function condText(v) {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return v.join(' ');
    if (typeof v === 'object') {
      return Object.keys(v).map(k => k + '：' + String(v[k] == null ? '' : v[k]).trim()).join(' · ');
    }
    return String(v);
  }

  function condHtml(v) {
    if (v == null || v === '') return '';
    if (typeof v === 'string') return '<div class="pd-cond">' + esc(v) + '</div>';
    if (typeof v === 'object') {
      const rows = Object.keys(v).map(k => {
        const val = String(v[k] == null ? '' : v[k]).trim();
        return '<div class="pd-kv-row"><span class="pd-kv-k">' + esc(k) + '</span>' +
          '<span class="pd-kv-v">' + (val ? esc(val) : '<i>不限</i>') + '</span></div>';
      }).join('');
      return '<div class="pd-kv">' + rows + '</div>';
    }
    return '<div class="pd-cond">' + esc(String(v)) + '</div>';
  }

  /* ---------- Supabase 直连（只用于插件备注） ---------- */
  const SB = window.WX_SUPABASE || {};
  const HAS_SB = /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(SB.url || '') && (SB.key || '').length > 20;
  const SB_H = HAS_SB ? {
    apikey: SB.key,
    Authorization: 'Bearer ' + SB.key,
    'Content-Type': 'application/json'
  } : null;

  async function rpc(fn, body) {
    const res = await fetch(SB.url + '/rest/v1/rpc/' + fn, {
      method: 'POST', headers: SB_H, body: JSON.stringify(body || {})
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) {}
    if (!res.ok) {
      const e = new Error((data && (data.message || data.hint)) || ('HTTP ' + res.status));
      e.status = res.status;
      throw e;
    }
    return data;
  }

  const LS_OFF = 'wx_pnote_off';       // 服务端备注函数连不上时记个时间戳，30 分钟内不再重试
  const LS_KEY = 'wx_pnote_';
  const OFF_MS = 30 * 60 * 1000;
  const offMode = () => {
    try {
      const v = localStorage.getItem(LS_OFF);
      if (!v) return false;
      const t = Number(v);
      if (!t || Number.isNaN(t)) return false;   // 旧版永久标记（'1'）作废，重新试一次
      return Date.now() - t < OFF_MS;
    } catch (_) { return false; }
  };
  const markOff = () => { try { localStorage.setItem(LS_OFF, String(Date.now())); } catch (_) {} };
  const readLocalNote = id => {
    try { return JSON.parse(localStorage.getItem(LS_KEY + id) || 'null'); } catch (_) { return null; }
  };
  const saveLocalNote = (id, note) => {
    try { localStorage.setItem(LS_KEY + id, JSON.stringify(note)); } catch (_) {}
  };

  function nick() {
    try { return localStorage.getItem('wx_note_nick') || ''; } catch (_) { return ''; }
  }
  function setNick(v) {
    try { localStorage.setItem('wx_note_nick', v); } catch (_) {}
  }

  async function noteGet(id) {
    if (HAS_SB && !offMode()) {
      try {
        const rows = await rpc('plugin_note_get', { p_plugin: Number(id) });
        const row = Array.isArray(rows) ? rows[0] : rows;
        return { mode: 'cloud', note: row ? { body: row.body || '', nick: row.nick || '', at: row.updated_at || '' } : null };
      } catch (e) {
        if (e.status === 404 || e.status === 400) markOff();
        return { mode: 'offline', note: readLocalNote(id) };
      }
    }
    return { mode: HAS_SB ? 'offline' : 'local', note: readLocalNote(id) };
  }

  async function noteSet(id, body, name) {
    if (HAS_SB && !offMode()) {
      try {
        const rows = await rpc('plugin_note_set', {
          p_plugin: Number(id), p_body: body, p_nick: name || '',
          p_visitor: (window.WXCloud && window.WXCloud.vid) ? window.WXCloud.vid() : null
        });
        const row = Array.isArray(rows) ? rows[0] : rows;
        return { ok: true, mode: 'cloud', note: { body: (row && row.body) || body, nick: (row && row.nick) || name, at: (row && row.updated_at) || new Date().toISOString() } };
      } catch (e) {
        if (e.status === 404 || e.status === 400) markOff();
        else return { ok: false, error: e.message || '保存失败' };
      }
    }
    const note = { body: body, nick: name || '无名侠客', at: new Date().toISOString() };
    saveLocalNote(id, note);
    return { ok: true, mode: 'local', note: note };
  }

  async function noteHist(id) {
    if (HAS_SB && !offMode()) {
      try {
        const rows = await rpc('plugin_note_hist', { p_plugin: Number(id), p_limit: 20 });
        return Array.isArray(rows) ? rows : [];
      } catch (_) { return []; }
    }
    return [];
  }

  /* ============================================================
     门户计数
     ============================================================ */
  function setTxt(id, v) { const n = document.getElementById(id); if (n) n.textContent = v; }

  function paintCounts() {
    const guides = (window.WX_DATA && WX_DATA.guides || []).filter(g => g.cat !== 'plugin').length;
    setTxt('pcGuides', guides + ' 篇');
    const t = window.WX_TERMS ? WX_TERMS.count() : 0;
    setTxt('pcTerms', t ? t + ' 条' : '—');
    setTxt('pcTools', TOOLS.length + ' 个');
    setTxt('pcPlugins', (window.WX_PLUGINS && WX_PLUGINS.meta ? WX_PLUGINS.meta.n : 100) + ' 条');
    if (window.WX_TERMS) Promise.resolve(WX_TERMS.ready()).then(() => {
      const n = WX_TERMS.count();
      if (n) setTxt('pcTerms', n + ' 条');
    }).catch(() => {});
  }

  /* ============================================================
     工具包
     ============================================================ */
  const TOOLS = [
    {
      id: 'flower',
      name: '开花计算器',
      tag: 'CALC',
      desc: '按内力、根骨与功法系数推算开花潜力，输入面板就能看到当前能开到几花、还差多少。',
      href: 'tools/flower.html'
    }
  ];

  let toolsDrawn = false;
  function showTools() {
    if (toolsDrawn) return;
    const box = $('#toolGrid');
    if (!box) return;
    box.innerHTML = TOOLS.map(t =>
      '<a class="tool-card" href="' + t.href + '">' +
        '<span class="tc-tag">' + esc(t.tag) + '</span>' +
        '<span class="tc-ico" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3.2v17.6M3.2 12h17.6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="12" cy="12" r="6.4" fill="none" stroke="currentColor" stroke-width="1.3"/></svg></span>' +
        '<span class="tc-title">' + esc(t.name) + '</span>' +
        '<span class="tc-desc">' + esc(t.desc) + '</span>' +
        '<span class="tc-go">打开工具 <i aria-hidden="true">→</i></span>' +
      '</a>'
    ).join('');
    toolsDrawn = true;
  }

  /* ============================================================
     流程与插件
     ============================================================ */
  let PLUG = null;
  let plLoading = null;
  let plState = { q: '', sort: 'hot' };

  function loadPlugins() {
    if (PLUG) return Promise.resolve(PLUG);
    if (plLoading) return plLoading;
    plLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'assets/data/plugins.js?v=20261120-10';
      s.onload = () => {
        if (window.WX_PLUGINS && Array.isArray(WX_PLUGINS.items)) {
          PLUG = WX_PLUGINS.items.slice().sort((a, b) => b.z - a.z);
          PLUG.forEach((p, i) => { p._rank = i + 1; });
          resolve(PLUG);
        } else reject(new Error('数据格式不对'));
      };
      s.onerror = () => reject(new Error('插件数据加载失败'));
      document.head.appendChild(s);
    });
    return plLoading;
  }

  function plFiltered() {
    const q = plState.q.trim().toLowerCase();
    let list = PLUG.slice();
    if (q) {
      const ts = q.split(/\s+/).filter(Boolean);
      list = list.filter(p => {
        const hay = (p.n + ' ' + p.a + ' ' + p.e + ' ' + condText(p.k) + ' ' + p.x).toLowerCase();
        return ts.every(t => hay.indexOf(t) >= 0);
      });
    }
    if (plState.sort === 'time') list.sort((a, b) => String(b.t).localeCompare(String(a.t)));
    else if (plState.sort === 'name') list.sort((a, b) => a.n.localeCompare(b.n, 'zh'));
    else list.sort((a, b) => b.z - a.z || b.i - a.i);
    return list;
  }

  function renderPlList() {
    const grid = $('#plGrid');
    if (!grid) return;
    const list = plFiltered();
    $('#plEmpty').hidden = list.length > 0;
    $('#plMeta').innerHTML = '共 <b>' + list.length + '</b> 条' +
      (plState.q ? '（关键词「' + esc(plState.q) + '」）' : '') +
      ' · 数据取自 wsmud.ii74.com · 更新于 ' + esc((window.WX_PLUGINS.meta || {}).at || '—');
    grid.innerHTML = list.map(p =>
      '<a class="pl-card" href="#/p/' + p.i + '">' +
        '<span class="pl-top">' +
          '<span class="pl-rank' + (p._rank <= 3 ? ' top' : '') + '">' + p._rank + '</span>' +
          '<span class="pl-name">' + esc(p.n) + '</span>' +
          '<span class="pl-hot">' +
            '<svg viewBox="0 0 24 24" width="10" height="10" aria-hidden="true"><path d="M12 20s-7.5-4.6-7.5-9.4A4.1 4.1 0 0 1 12 8a4.1 4.1 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z" fill="currentColor"/></svg>' +
            p.z +
          '</span>' +
        '</span>' +
        '<span class="pl-sub">' +
          '<span class="ev">' + esc(p.e || '未注明触发') + '</span>' +
          '<span class="dot-sep"></span>' +
          '<span>' + esc(p.a || '佚名') + '</span>' +
          '<span class="dot-sep"></span>' +
          '<span>' + esc(p.t || '—') + '</span>' +
        '</span>' +
      '</a>'
    ).join('');
  }

  /* ---------- 详情 ---------- */
  let currentPlugin = null;

  function renderPlDetail(p) {
    const box = $('#plDetailPage');
    if (!box) return;
    currentPlugin = p;
    const cond = condText(p.k).trim();
    box.innerHTML =
      '<div class="page-crumb"><a href="#/">首页</a><span>/</span><a href="#/p">流程与插件</a><span>/</span><b>' + esc(p.n) + '</b></div>' +
      '<div class="pd-head">' +
        '<h1 class="pd-title">' + esc(p.n) + '<span class="pd-rank">HOT ' + p._rank + '</span></h1>' +
        '<div class="pd-meta">' +
          '<span>作者 <b>' + esc(p.a || '佚名') + '</b></span><span class="dot-sep"></span>' +
          '<span>' + esc(p.t || '—') + '</span><span class="dot-sep"></span>' +
          '<span>赞 <b>' + p.z + '</b> / 踩 <b>' + p.c + '</b></span><span class="dot-sep"></span>' +
          '<span>' + (p.on ? '默认启用' : '默认停用') + '</span>' +
        '</div>' +
      '</div>' +

      '<section class="pd-sec">' +
        '<h3>触发条件</h3>' +
        (cond ? condHtml(p.k) : '<div class="pd-cond">没有附加条件，靠「' + esc(p.e || '未知触发') + '」直接触发。</div>') +
      '</section>' +

      '<section class="pd-sec">' +
        '<h3>源码</h3>' +
        '<pre class="pd-code" id="pdCode"></pre>' +
        '<div class="pd-acts">' +
          '<button class="pd-btn primary" id="pdCopyShare" type="button">复制分享码</button>' +
          '<button class="pd-btn" id="pdCopyCode" type="button">复制源码</button>' +
          '<button class="pd-btn" id="pdBack" type="button">← 返回列表</button>' +
        '</div>' +
        '<p class="pd-note-msg" id="pdCopyMsg"></p>' +
      '</section>' +

      '<section class="pd-sec">' +
        '<h3>备注 · 用途与背景</h3>' +
        '<div class="pd-note" id="pdNote">' +
          '<div class="pd-note-body empty" id="pdNoteBody">读取中…</div>' +
          '<div class="pd-note-foot">' +
            '<span class="grow" id="pdNoteBy"></span>' +
            '<button type="button" id="pdNoteEdit">写备注</button>' +
            '<button type="button" id="pdNoteHist">编辑历史</button>' +
          '</div>' +
          '<div class="pd-note-edit" id="pdNoteForm">' +
            '<textarea id="pdNoteText" maxlength="600" placeholder="这个插件是干什么的、适合什么时候开、有什么坑"></textarea>' +
            '<div class="pd-note-row">' +
              '<input id="pdNoteNick" maxlength="20" placeholder="署名（可留空）">' +
              '<button type="button" id="pdNoteSave">保存</button>' +
            '</div>' +
            '<p class="pd-note-msg" id="pdNoteMsg"></p>' +
          '</div>' +
          '<div class="pd-hist" id="pdNoteHistBox"><ul></ul></div>' +
        '</div>' +
      '</section>';

    // 源码用 textContent，避免被当成 HTML
    const pre = $('#pdCode');
    pre.textContent = String(p.x || '// 该条未附带源码，请用分享码导入');

    $('#pdBack').onclick = () => { location.hash = '#/p'; };

    const flash = (msg) => {
      const t = $('#pdCopyMsg');
      t.textContent = msg;
      clearTimeout(flash._t);
      flash._t = setTimeout(() => { t.textContent = ''; }, 2200);
    };

    $('#pdCopyShare').onclick = async () => {
      const ok = await copy(p.s || '');
      flash(ok ? '分享码已复制，到游戏里粘贴导入即可' : '复制失败，请手动选中');
    };
    $('#pdCopyCode').onclick = async () => {
      const ok = await copy(String(p.x || ''));
      flash(ok ? '源码已复制' : '复制失败，请手动选中');
    };

    bindNote(p);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
      } catch (e) { return false; }
    }
  }

  /* ---------- 备注 ---------- */
  function fmtTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return String(iso).slice(0, 10);
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '.' + p(d.getMonth() + 1) + '.' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function paintNote(data) {
    const body = $('#pdNoteBody'), by = $('#pdNoteBy');
    if (!body) return;
    const note = data && data.note;
    body.classList.toggle('empty', !(note && note.body));
    body.textContent = (note && note.body) ? note.body : '还没有人写备注。它解决什么问题、什么时候用、有什么坑，都可以记在这里。';
    by.textContent = (note && note.body)
      ? '最后由 ' + (note.nick || '无名侠客') + ' 编辑 · ' + fmtTime(note.at)
      : (data && data.mode === 'offline' || (data && data.mode === 'local') ? '备注只保存在本机（云服务未开通）' : '');
    const editBtn = $('#pdNoteEdit');
    if (editBtn) editBtn.textContent = (note && note.body) ? '修改备注' : '写备注';
  }

  function bindNote(p) {
    const form = $('#pdNoteForm');
    const text = $('#pdNoteText');
    const nickIn = $('#pdNoteNick');
    const msg = $('#pdNoteMsg');
    const saveBtn = $('#pdNoteSave');
    const histBox = $('#pdNoteHistBox');
    if (!form) return;

    nickIn.value = nick();

    const load = async () => { paintNote(await noteGet(p.i)); };
    load();

    $('#pdNoteEdit').onclick = () => {
      form.classList.toggle('on');
      if (form.classList.contains('on')) {
        text.value = ($('#pdNoteBody').classList.contains('empty')) ? '' : $('#pdNoteBody').textContent;
        text.focus();
      }
    };

    $('#pdNoteHist').onclick = async () => {
      const on = histBox.classList.toggle('on');
      if (!on) return;
      const ul = histBox.querySelector('ul');
      ul.innerHTML = '<li>读取中…</li>';
      const rows = await noteHist(p.i);
      if (!rows.length) { ul.innerHTML = '<li>暂无历史记录（或历史服务未开通）</li>'; return; }
      ul.innerHTML = rows.map(r =>
        '<li><b>' + esc(r.nick || '无名侠客') + '</b><time>' + esc(fmtTime(r.created_at)) + '</time><br>' +
        esc(r.body) + '</li>'
      ).join('');
    };

    saveBtn.onclick = async () => {
      const body = text.value.trim();
      if (body.length < 2) { msg.textContent = '至少写两个字'; return; }
      const name = nickIn.value.trim().slice(0, 20);
      saveBtn.disabled = true;
      msg.textContent = '保存中…';
      const r = await noteSet(p.i, body, name);
      saveBtn.disabled = false;
      if (!r.ok) { msg.textContent = r.error || '保存失败'; return; }
      setNick(name);
      msg.textContent = r.mode === 'cloud' ? '已保存，所有人可见' : '已保存到本机（云服务未开通）';
      form.classList.remove('on');
      paintNote(r);
      setTimeout(() => { msg.textContent = ''; }, 2600);
    };
  }

  /* ---------- 对外 ---------- */
  const listPage = () => $('#plListPage');
  const detailPage = () => $('#plDetailPage');

  let listBound = false;
  function bindList() {
    if (listBound) return;
    const input = $('#plSearch');
    const sortBtn = $('#plSort');
    if (!input || !sortBtn) return;
    input.addEventListener('input', () => { plState.q = input.value; renderPlList(); });

    const labels = { hot: '按热度', time: '按时间', name: '按名称' };
    const order = ['hot', 'time', 'name'];
    sortBtn.onclick = () => {
      plState.sort = order[(order.indexOf(plState.sort) + 1) % order.length];
      sortBtn.textContent = labels[plState.sort];
      renderPlList();
    };
    listBound = true;
  }

  let guidesBound = false;
  function renderGuideLinks() {
    if (guidesBound) return;
    const box = $('#plGuideList');
    if (!box) return;
    const list = (window.WX_DATA && WX_DATA.guides || []).filter(g => g.cat === 'plugin');
    if (window.WX_DATA && window.WX_DATA.cats) {
      const c = WX_DATA.cats.find(x => x.id === 'plugin');
      const n = $('#plGuideNum');
      if (n) n.textContent = list.length ? list.length + ' 篇' : '';
      if (c && c.desc) { /* 说明已在页面顶部 */ }
    }
    box.innerHTML = list.map((g, i) =>
      '<a class="pl-guide" href="#/g/' + g.id + '">' +
        '<i>' + String(i + 1).padStart(2, '0') + '</i><span>' + esc(g.title) + '</span>' +
      '</a>'
    ).join('');
    guidesBound = true;
  }

  async function showPlugins(id) {
    const list = listPage(), detail = detailPage();
    if (!list || !detail) return;
    if (!id) {
      list.hidden = false;
      detail.hidden = true;
      bindList();
      renderGuideLinks();
      if (!PLUG) { $('#plMeta').textContent = '加载中…'; $('#plGrid').innerHTML = ''; }
      try {
        await loadPlugins();
        renderPlList();
      } catch (e) {
        $('#plMeta').textContent = '插件数据加载失败：' + (e.message || '网络问题');
      }
      return;
    }
    list.hidden = true;
    detail.hidden = false;
    detail.innerHTML = '<div class="page-crumb"><a href="#/p">← 流程与插件</a></div><p class="pl-empty">加载中…</p>';
    try {
      const all = await loadPlugins();
      const p = all.find(x => String(x.i) === String(id));
      if (!p) { detail.innerHTML = '<div class="page-crumb"><a href="#/p">返回流程与插件</a></div><p class="pl-empty">找不到这条记录</p>'; return; }
      renderPlDetail(p);
    } catch (e) {
      detail.innerHTML = '<div class="page-crumb"><a href="#/p">返回流程与插件</a></div><p class="pl-empty">数据加载失败</p>';
    }
  }

  window.WXPortal = { paintCounts, showTools, showPlugins };
})();
