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

  async function rest(path) {
    const res = await fetch(SB.url + '/rest/v1/' + path, { headers: SB_H });
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

  /* ============================================================
     插件互动：本站点赞 / 浏览 / 评论（与攻略同一套，从零起算）
     ============================================================ */
  const PSTAT = { map: {}, known: false, by: '' };   // by = visitor id
  const pstOf = id => PSTAT.map[id] || { likes: 0, views: 0, comments: 0 };

  function visitor() {
    if (PSTAT.by) return PSTAT.by;
    try {
      let v = localStorage.getItem('wx_vid');
      if (!v || !/^[0-9a-f-]{36}$/i.test(v)) {
        v = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
          : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
              const r = Math.random() * 16 | 0;
              return (c === 'x' ? r : (r & 3 | 8)).toString(16);
            });
        localStorage.setItem('wx_vid', v);
      }
      PSTAT.by = v;
    } catch (_) {
      PSTAT.by = '00000000-0000-4000-8000-000000000000';
    }
    return PSTAT.by;
  }

  const numTxt = n => n >= 10000 ? (n / 10000).toFixed(1).replace(/\.0$/, '') + 'w' : String(n | 0);

  async function loadPlugStats(force) {
    if (!HAS_SB) return PSTAT;
    if (PSTAT.known && !force) return PSTAT;
    try {
      const [rows, cmts] = await Promise.all([
        rest('plugin_stats?select=plugin_id,likes,views'),
        rest('plugin_comments?select=plugin_id&deleted=eq.false&limit=5000')
      ]);
      const map = {};
      (Array.isArray(rows) ? rows : []).forEach(r => {
        map[r.plugin_id] = { likes: r.likes | 0, views: r.views | 0, comments: 0 };
      });
      (Array.isArray(cmts) ? cmts : []).forEach(r => {
        const k = r.plugin_id;
        if (!map[k]) map[k] = { likes: 0, views: 0, comments: 0 };
        map[k].comments++;
      });
      PSTAT.map = map;
      PSTAT.known = true;
    } catch (_) {
      PSTAT.known = false;
    }
    return PSTAT;
  }

  function setPStat(id, patch) {
    const cur = PSTAT.map[id] || { likes: 0, views: 0, comments: 0 };
    PSTAT.map[id] = Object.assign({ likes: 0, views: 0, comments: 0 }, cur, patch);
    return PSTAT.map[id];
  }


  function nick() {
    try { return localStorage.getItem('wx_note_nick') || ''; } catch (_) { return ''; }
  }
  function setNick(v) {
    try { localStorage.setItem('wx_note_nick', v); } catch (_) {}
  }

  async function noteGet(id) {
    if (!HAS_SB) return { mode: 'local', note: null };
    try {
      const rows = await rpc('plugin_note_get', { p_plugin: Number(id) });
      const row = Array.isArray(rows) ? rows[0] : rows;
      return { mode: 'cloud', note: row ? { body: row.body || '', nick: row.nick || '', at: row.updated_at || '' } : null };
    } catch (e) {
      return { mode: 'offline', note: null };
    }
  }

  async function noteHist(id) {
    if (HAS_SB) {
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
  let plState = { q: '', sort: 'rec' };

  function loadPlugins() {
    if (PLUG) return Promise.resolve(PLUG);
    if (plLoading) return plLoading;
    plLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'assets/data/plugins.js?v=20261120-13';
      s.onload = () => {
        if (window.WX_PLUGINS && Array.isArray(WX_PLUGINS.items)) {
          PLUG = WX_PLUGINS.items.slice();   // 数组本身已按原榜序排好
          PLUG.forEach((p, i) => { p._rank = i + 1; });
          resolve(PLUG);
        } else reject(new Error('数据格式不对'));
      };
      s.onerror = () => reject(new Error('插件数据加载失败'));
      document.head.appendChild(s);
    });
    return plLoading;
  }

  const PL_SORTS = ['rec', 'like', 'time', 'name'];
  const PL_LABELS = { rec: '推荐', like: '按点赞', time: '按时间', name: '按名称' };

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
    else if (plState.sort === 'like') {
      list.sort((a, b) => (pstOf(b.i).likes - pstOf(a.i).likes) || (pstOf(b.i).views - pstOf(a.i).views) || a._rank - b._rank);
    } else list.sort((a, b) => a._rank - b._rank);   // 推荐 = 入库时的原始排序
    return list;
  }

  function statHtml(id) {
    const st = pstOf(id);
    const k = PSTAT.known;
    const one = (cls, icon, n) =>
      '<span class="ps ' + cls + (k && n > 0 ? ' has' : '') + '">' + icon +
        '<b>' + (k ? numTxt(n) : '—') + '</b></span>';
    return '<span class="pl-stats">' +
      one('ps-like', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7.5-4.6-7.5-9.4A4.1 4.1 0 0 1 12 8a4.1 4.1 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z" fill="currentColor"/></svg>', st.likes) +
      one('ps-view', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.6 12S6 6.4 12 6.4 21.4 12 21.4 12 18 17.6 12 17.6 2.6 12 2.6 12Z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/></svg>', st.views) +
      one('ps-cmt', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 11.6c0 4.2-3.8 7.6-8.5 7.6-1 0-2-.15-2.9-.43L4.2 20.2l1.36-3.5C4.3 15.3 3.5 13.5 3.5 11.6 3.5 7.4 7.3 4 12 4s8.5 3.4 8.5 7.6Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>', st.comments) +
      '</span>';
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
        '</span>' +
        '<span class="pl-sub">' +
          '<span class="ev">' + esc(p.e || '未注明触发') + '</span>' +
          '<span class="dot-sep"></span>' +
          '<span>' + esc(p.a || '佚名') + '</span>' +
          '<span class="dot-sep"></span>' +
          '<span>' + esc(p.t || '—') + '</span>' +
        '</span>' +
        statHtml(p.i) +
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
    const st = pstOf(p.i);
    const k = PSTAT.known;
    const I = {
      like: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7.5-4.6-7.5-9.4A4.1 4.1 0 0 1 12 8a4.1 4.1 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z" fill="currentColor"/></svg>',
      view: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.6 12S6 6.4 12 6.4 21.4 12 21.4 12 18 17.6 12 17.6 2.6 12 2.6 12Z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/></svg>',
      cmt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 11.6c0 4.2-3.8 7.6-8.5 7.6-1 0-2-.15-2.9-.43L4.2 20.2l1.36-3.5C4.3 15.3 3.5 13.5 3.5 11.6 3.5 7.4 7.3 4 12 4s8.5 3.4 8.5 7.6Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>'
    };
    const num = n => (k ? numTxt(n) : '—');

    box.innerHTML =
      '<div class="page-crumb"><a href="#/">首页</a><span>/</span><a href="#/p">流程与插件</a><span>/</span><b>' + esc(p.n) + '</b></div>' +
      '<div class="pd-head">' +
        '<h1 class="pd-title">' + esc(p.n) + '<span class="pd-rank">HOT ' + p._rank + '</span></h1>' +
        '<div class="pd-meta">' +
          '<span>分享者 <b>' + esc(p.a || '佚名') + '</b></span><span class="dot-sep"></span>' +
          '<span>' + esc(p.t || '—') + '</span><span class="dot-sep"></span>' +
          '<span>' + (p.on ? '默认启用' : '默认停用') + '</span>' +
        '</div>' +
      '</div>' +

      '<div class="pd-statbar">' +
        '<button class="pd-like" id="pdLike" type="button" aria-pressed="false">' +
          I.like + '<b id="pdLikeNum">' + num(st.likes) + '</b>' +
        '</button>' +
        '<span class="pd-sstat">' + I.view + '<b id="pdViewNum">' + num(st.views) + '</b><i>浏览</i></span>' +
        '<button class="pd-sstat as-btn" id="pdCmtJump" type="button">' + I.cmt +
          '<b id="pdCmtNum">' + num(st.comments) + '</b><i>留言</i></button>' +
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
        '<h3 id="pdNoteTitle">上传者说明</h3>' +
        '<div class="pd-note" id="pdNote">' +
          '<div class="pd-note-body empty" id="pdNoteBody">读取中…</div>' +
          '<div class="pd-note-foot">' +
            '<span class="grow" id="pdNoteBy"></span>' +
            '<button type="button" id="pdNoteOwner" hidden>编辑说明</button>' +
          '</div>' +
          '<div class="pd-note-edit" id="pdNoteForm">' +
            '<textarea id="pdNoteText" maxlength="2000" placeholder="这条流程/插件是做什么用的、什么场合开、编写时的背景"></textarea>' +
            '<div class="pd-note-row">' +
              '<input id="pdNoteNick" maxlength="20" placeholder="署名（默认「上传者」）">' +
              '<button type="button" id="pdNoteSave">保存</button>' +
            '</div>' +
            '<p class="pd-note-msg" id="pdNoteMsg"></p>' +
          '</div>' +
          '<div class="pd-hist" id="pdNoteHistBox"><ul></ul></div>' +
        '</div>' +
      '</section>' +

      '<section class="pd-sec" id="pdCmtSec">' +
        '<h3>留言</h3>' +
        '<div class="cmt-card">' +
          '<div class="cmt-head"><span class="cmt-title">共 <b id="plCmtCount">0</b> 条</span>' +
            '<span class="cmt-hint">说点用后感，或指出哪里已经不适用</span></div>' +
          '<form class="cmt-form" id="plCmtForm" autocomplete="off">' +
            '<input class="cmt-nick" id="plCmtNick" maxlength="20" placeholder="昵称（可留空）">' +
            '<textarea class="cmt-body" id="plCmtBody" maxlength="300" placeholder="写点什么…"></textarea>' +
            '<div class="cmt-actions">' +
              '<span class="cmt-len" id="plCmtLen">0/300</span>' +
              '<span class="cmt-tip" id="plCmtTip"></span>' +
              '<button class="cmt-send" id="plCmtSend" type="submit">发表</button>' +
            '</div>' +
          '</form>' +
          '<div class="cmt-list" id="plCmtList"></div>' +
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

    bindPlugStats(p);
    bindPlugStatOnly(p);
    bindNote(p);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  /* ---------- 详情页：点赞 / 浏览 ---------- */
  async function bindPlugStats(p) {
    const likeBtn = $('#pdLike');
    if (!likeBtn) return;

    if (HAS_SB) {
      // 浏览 +1（同一天同一访客只算一次），顺便拿回真实数字
      try {
        const v = await rpc('plugin_hit', { p_plugin: p.i, p_visitor: visitor() });
        if (typeof v === 'number') {
          setPStat(p.i, { views: v });
          PSTAT.known = true;
          const nv = $('#pdViewNum'); if (nv) nv.textContent = numTxt(v);
          const nk = $('#plCmtNum'); if (nk) nk.textContent = numTxt(pstOf(p.i).comments);
          const nl = $('#pdLikeNum'); if (nl) nl.textContent = numTxt(pstOf(p.i).likes);
        }
      } catch (_) {}
      // 我是否已经赞过
      try {
        const rows = await rpc('plugin_my_likes', { p_visitor: visitor() });
        const liked = Array.isArray(rows) && rows.some(r => String(r.plugin_id) === String(p.i));
        likeBtn.classList.toggle('on', !!liked);
        likeBtn.setAttribute('aria-pressed', liked ? 'true' : 'false');
      } catch (_) {}
    }

    likeBtn.onclick = async () => {
      if (!HAS_SB || likeBtn.disabled) return;
      likeBtn.disabled = true;
      try {
        const rows = await rpc('plugin_toggle_like', { p_plugin: p.i, p_visitor: visitor() });
        const r = Array.isArray(rows) ? rows[0] : rows;
        if (r && typeof r.likes === 'number') {
          setPStat(p.i, { likes: r.likes });
          PSTAT.known = true;
          const n = $('#pdLikeNum'); if (n) n.textContent = numTxt(r.likes);
          likeBtn.classList.toggle('on', !!r.liked);
          likeBtn.setAttribute('aria-pressed', r.liked ? 'true' : 'false');
        }
      } catch (_) {}
      likeBtn.disabled = false;
    };

    const jump = $('#pdCmtJump');
    if (jump) jump.onclick = () => {
      const sec = $('#pdCmtSec');
      if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const t = $('#plCmtBody'); if (t) setTimeout(() => t.focus(), 320);
    };
  }

  /* ---------- 详情页：留言 ---------- */
  let cmtBoundFor = null;
  function fmtAgo(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return '刚刚';
    if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前';
    if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前';
    if (diff < 86400 * 30) return Math.floor(diff / 86400) + ' 天前';
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function paintPlComments(arr) {
    const list = $('#plCmtList'), cnt = $('#plCmtCount');
    if (!list) return;
    if (cnt) cnt.textContent = arr.length;
    if (!arr.length) {
      list.innerHTML = '<p class="cmt-empty">还没有留言，来做第一个。</p>';
      return;
    }
    list.innerHTML = arr.map(c =>
      '<div class="cmt-item">' +
        '<div class="cmt-meta"><b>' + esc(c.nick || '无名侠客') + '</b><span>' + esc(fmtAgo(c.created_at)) + '</span>' +
          (c.mine ? '<button class="cmt-del" data-del="' + esc(String(c.id)) + '" type="button">删除</button>' : '') +
        '</div>' +
        '<p class="cmt-text">' + esc(c.body) + '</p>' +
      '</div>'
    ).join('');
  }

  async function loadPlComments(p) {
    const list = $('#plCmtList');
    if (!list) return;
    if (!HAS_SB) { list.innerHTML = '<p class="cmt-empty">留言需要云端服务，当前不可用。</p>'; return; }
    list.innerHTML = '<p class="cmt-empty">加载中…</p>';
    try {
      const rows = await rpc('plugin_list_comments', { p_plugin: p.i, p_visitor: visitor(), p_limit: 100 });
      paintPlComments(Array.isArray(rows) ? rows : []);
      setPStat(p.i, { comments: (Array.isArray(rows) ? rows.length : 0) });
      const n = $('#pdCmtNum'); if (n) n.textContent = numTxt(pstOf(p.i).comments);
    } catch (_) {
      list.innerHTML = '<p class="cmt-empty">留言加载失败，稍后再试。</p>';
    }
  }

  function bindPlugStatOnly(p) {
    loadPlComments(p);
    const form = $('#plCmtForm');
    if (!form) return;
    const body = $('#plCmtBody'), nickIn = $('#plCmtNick'), tip = $('#plCmtTip'),
      len = $('#plCmtLen'), send = $('#plCmtSend'), listBox = $('#plCmtList');
    try { const n = localStorage.getItem('wx_nick'); if (n) nickIn.value = n; } catch (_) {}

    body.addEventListener('input', () => {
      len.textContent = body.value.length + '/300';
      if (tip.textContent) tip.textContent = '';
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (send.disabled) return;
      const txt = body.value.trim();
      if (txt.length < 2) { tip.textContent = '至少写两个字'; body.focus(); return; }
      send.disabled = true;
      tip.textContent = '发表中…';
      let r = null;
      try {
        r = await rpc('plugin_add_comment', {
          p_plugin: p.i, p_visitor: visitor(), p_nick: nickIn.value.trim(), p_body: txt
        });
      } catch (err) {
        send.disabled = false;
        tip.textContent = (err && err.message) || '发表失败';
        return;
      }
      send.disabled = false;
      if (!r) { tip.textContent = '发表失败'; return; }
      try { if (nickIn.value.trim()) localStorage.setItem('wx_nick', nickIn.value.trim().slice(0, 20)); } catch (_) {}
      body.value = '';
      len.textContent = '0/300';
      tip.textContent = '已发表';
      setTimeout(() => { if (tip.textContent === '已发表') tip.textContent = ''; }, 3000);
      loadPlComments(p);
    });

    listBox.addEventListener('click', async e => {
      const btn = e.target.closest('[data-del]');
      if (!btn) return;
      btn.disabled = true;
      const r = await rpc('plugin_del_comment', { p_id: Number(btn.dataset.del), p_visitor: visitor() }).catch(() => null);
      if (r === true) loadPlComments(p);
      else btn.disabled = false;
    });
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

  const OWN_KEY = 'wx_pnote_owner';    // 上传者口令，只有本机记住
  const ownerToken = () => { try { return localStorage.getItem(OWN_KEY) || ''; } catch (_) { return ''; } };

  function paintNote(data) {
    const body = $('#pdNoteBody'), by = $('#pdNoteBy');
    if (!body) return;
    const note = data && data.note;
    body.classList.toggle('empty', !(note && note.body));
    body.textContent = (note && note.body)
      ? note.body
      : '上传者还没有附说明。这一栏只由上传者撰写，用来交代它解决什么问题、什么时候该开、有什么已知的坑。';
    by.textContent = (note && note.body)
      ? (note.nick || '上传者') + ' 撰写 · ' + fmtTime(note.at)
      : '';
  }

  function bindNote(p) {
    const form = $('#pdNoteForm');
    const text = $('#pdNoteText');
    const nickIn = $('#pdNoteNick');
    const msg = $('#pdNoteMsg');
    const saveBtn = $('#pdNoteSave');
    const histBox = $('#pdNoteHistBox');
    const ownerBtn = $('#pdNoteOwner');
    const title = $('#pdNoteTitle');
    if (!form) return;

    nickIn.value = nick() || '';

    const load = async () => { paintNote(await noteGet(p.i)); };
    load();

    const openForm = (on) => {
      form.classList.toggle('on', !!on);
      if (on) {
        text.value = ($('#pdNoteBody').classList.contains('empty')) ? '' : $('#pdNoteBody').textContent;
        text.focus();
      }
    };

    if (ownerToken()) {
      if (ownerBtn) ownerBtn.hidden = false;
      if (histBox) histBox.classList.add('on');
      (async () => {
        const ul = histBox.querySelector('ul');
        ul.innerHTML = '<li>读取中…</li>';
        const rows = await noteHist(p.i);
        if (!rows.length) { ul.innerHTML = '<li>暂无修改记录</li>'; return; }
        ul.innerHTML = rows.map(r =>
          '<li><b>' + esc(r.nick || '无名侠客') + '</b><time>' + esc(fmtTime(r.created_at)) + '</time><br>' +
          esc(r.body) + '</li>'
        ).join('');
      })();
    }

    if (ownerBtn) ownerBtn.onclick = () => openForm(!form.classList.contains('on'));

    // 上传者入口：连点标题 5 次，弹出输入口令
    if (title) {
      let taps = 0, timer = null;
      title.addEventListener('click', async () => {
        taps++;
        clearTimeout(timer);
        timer = setTimeout(() => { taps = 0; }, 800);
        if (taps < 5) return;
        taps = 0;
        if (ownerToken()) { openForm(true); return; }
        const t = prompt('上传者口令');
        if (!t) return;
        let ok = false;
        try { ok = (await rpc('plugin_note_owner_check', { p_token: t })) === true; } catch (_) {}
        if (!ok) { alert('口令不对'); return; }
        try { localStorage.setItem(OWN_KEY, t); } catch (_) {}
        if (ownerBtn) ownerBtn.hidden = false;
        openForm(true);
      });
    }

    saveBtn.onclick = async () => {
      const token = ownerToken();
      if (!token) { msg.textContent = '只有上传者可以修改说明'; return; }
      const body = text.value.trim();
      if (body.length > 2000) { msg.textContent = '说明最多 2000 字'; return; }
      const name = nickIn.value.trim().slice(0, 20);
      saveBtn.disabled = true;
      msg.textContent = '保存中…';
      let rows;
      try {
        rows = await rpc('plugin_note_owner_set', {
          p_plugin: p.i, p_body: body, p_nick: name, p_token: token
        });
      } catch (e) {
        saveBtn.disabled = false;
        msg.textContent = (e && e.message) || '保存失败';
        return;
      }
      saveBtn.disabled = false;
      setNick(name);
      const row = Array.isArray(rows) ? rows[0] : rows;
      paintNote({ note: row ? { body: row.body, nick: row.nick, at: row.updated_at } : null });
      msg.textContent = body ? '已保存' : '已清空';
      openForm(false);
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

    sortBtn.onclick = () => {
      plState.sort = PL_SORTS[(PL_SORTS.indexOf(plState.sort) + 1) % PL_SORTS.length];
      sortBtn.textContent = PL_LABELS[plState.sort];
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
        return;
      }
      // 统计慢一点无所谓，先出列表；拿到数字再补一次
      try {
        await loadPlugStats();
        renderPlList();
      } catch (_) {}
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
