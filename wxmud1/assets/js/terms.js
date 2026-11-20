/* ============================================================
   名词词条：正文自动内链 + 悬停/点击查看 + 在线补写
   ------------------------------------------------------------
   · 词条表由 tools/extract-terms.mjs 从全部攻略里自动抽取，空白词条等待认领
   · 首次加载拉全量（约 300 条），之后走 localStorage 缓存，后台静默更新
   · 无依赖，只用 PostgREST RPC；断网/未配置时安静失效，不影响阅读
   ============================================================ */
(function () {
  'use strict';

  const CFG = window.WX_SUPABASE || {};
  const BASE = String(CFG.url || '').replace(/\/+$/, '');
  const KEY = String(CFG.key || '');
  const ON = /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(BASE) && KEY.length > 20;
  const CACHE = 'wx_terms_v1';
  const CACHE_TTL = 1000 * 60 * 10;

  let map = null;            // name -> term
  let trie = null;
  let loading = null;
  let popEl = null, modalEl = null;
  let active = null;
  let hoverTimer = null, closeTimer = null;

  /* ---------- 工具 ---------- */
  function vid() {
    try {
      const v = localStorage.getItem('wx_vid');
      if (/^[0-9a-f-]{36}$/i.test(v || '')) return v;
    } catch (_) {}
    return null;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ---------- 数据 ---------- */
  function readCache() {
    try {
      const o = JSON.parse(localStorage.getItem(CACHE) || 'null');
      if (o && Array.isArray(o.list) && Date.now() - o.at < CACHE_TTL) return o.list;
    } catch (_) {}
    return null;
  }
  function writeCache(list) {
    try { localStorage.setItem(CACHE, JSON.stringify({ at: Date.now(), list })); } catch (_) {}
  }

  async function fetchList() {
    const res = await fetch(BASE + '/rest/v1/rpc/term_list', {
      method: 'POST',
      headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      body: '{}'
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  function ingest(list) {
    map = new Map();
    for (const t of list) map.set(t.name, {
      name: t.name, cat: t.cat || 'other', body: t.body || '',
      filled: !!t.filled, editor: t.editor || '',
      freq: t.freq | 0, updated_at: t.updated_at || ''
    });
    buildTrie();
  }

  function buildTrie() {
    const root = { c: Object.create(null), w: null };
    for (const name of map.keys()) {
      let n = root;
      for (const ch of name) {
        n = n.c[ch] || (n.c[ch] = { c: Object.create(null), w: null });
      }
      n.w = name;
    }
    trie = root;
  }

  function load() {
    if (map) return Promise.resolve();
    if (loading) return loading;
    loading = (async () => {
      const cached = readCache();
      if (cached) { ingest(cached); }
      if (!ON) { if (!map) ingest([]); return; }
      try {
        const list = await fetchList();
        ingest(list);
        writeCache(list);
      } catch (_) {
        if (!map) ingest([]);
      }
    })();
    return loading;
  }

  /* ---------- 内链 ---------- */
  const SKIP = new Set(['A', 'CODE', 'PRE', 'H1', 'TH', 'SCRIPT', 'STYLE', 'TEXTAREA', 'BUTTON', 'KBD']);

  function matchAt(text, i) {
    let n = trie, j = i, hit = null;
    while (j < text.length && n) {
      n = n.c[text[j]];
      if (!n) break;
      j++;
      if (n.w) hit = n.w;
    }
    return hit;
  }

  function linkNode(node, used) {
    const text = node.nodeValue;
    if (!text || text.length < 2) return;
    const frag = document.createDocumentFragment();
    let i = 0, last = 0, found = false;
    while (i < text.length) {
      const w = matchAt(text, i);
      if (w && !used.has(w)) {
        if (i > last) frag.appendChild(document.createTextNode(text.slice(last, i)));
        const sp = document.createElement('span');
        sp.className = 'term' + (map.get(w).filled ? '' : ' term-empty');
        sp.dataset.term = w;
        sp.textContent = w;
        frag.appendChild(sp);
        used.add(w);
        i += w.length; last = i; found = true;
      } else {
        i++;
      }
    }
    if (!found) return;
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    node.parentNode.replaceChild(frag, node);
  }

  function link(root) {
    if (!root || !trie) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const p = n.parentNode;
        if (!p || SKIP.has(p.nodeName) || p.classList.contains('term')) return NodeFilter.FILTER_REJECT;
        // 分类标签、字数/时长、互动条、翻页条这些界面元素不参与内链
        if (p.closest && p.closest('.art-cat,.art-meta,.art-actions,.pager,.cmt,.term-pop,.term-modal')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    const used = new Set();
    for (const n of nodes) linkNode(n, used);
  }

  /* ---------- 弹层 ---------- */
  const CAT_NAME = { sect: '门派', skill: '武学', equip: '装备', place: '地点', stat: '属性', other: '术语' };

  function ensurePop() {
    if (popEl) return popEl;
    popEl = document.createElement('div');
    popEl.className = 'term-pop';
    popEl.hidden = true;
    document.body.appendChild(popEl);
    popEl.addEventListener('click', onPopClick);
    return popEl;
  }

  let popTerm = null;

  function openPop(span) {
    if (!map) return;
    const t = map.get(span.dataset.term);
    if (!t) return;
    if (active && active !== span) active.classList.remove('on');
    active = span;
    span.classList.add('on');
    popTerm = t;

    const pop = ensurePop();
    const mobile = window.matchMedia('(hover:none) and (pointer:coarse)').matches;
    pop.className = 'term-pop' + (mobile ? ' is-sheet' : '') + (t.filled ? '' : ' is-empty');
    pop.innerHTML =
      '<div class="tp-head">' +
        '<span class="tp-name">' + esc(t.name) + '</span>' +
        '<span class="tp-cat">' + (CAT_NAME[t.cat] || '术语') + '</span>' +
        '<button class="tp-x" type="button" aria-label="关闭">✕</button>' +
      '</div>' +
      (t.filled
        ? '<div class="tp-body">' + esc(window.WXMD ? window.WXMD.plain(t.body, 120) : t.body.slice(0, 120)) + '</div>' +
          '<div class="tp-foot"><span class="tp-by">' + (t.editor ? '由 ' + esc(t.editor) + ' 释义' : '社区释义') + '</span>' +
          '<button class="tp-edit" type="button" data-act="open">查看完整词条 ›</button></div>'
        : '<div class="tp-body tp-hint">这个词条还没有释义。<br>你比下一位玩家更早来到这里 —— 补一句，后面的人就不用猜了。</div>' +
          '<div class="tp-foot"><span class="tp-by">待认领</span>' +
          '<button class="tp-edit" type="button" data-act="open">去写第一条 ›</button></div>');

    pop.hidden = false;
    if (mobile) {
      pop.style.left = ''; pop.style.top = ''; pop.style.bottom = '';
    } else {
      place(span, pop);
    }
  }

  function place(span, pop) {
    const r = span.getBoundingClientRect();
    const pr = pop.getBoundingClientRect();
    let left = r.left + r.width / 2 - pr.width / 2;
    left = Math.max(10, Math.min(left, window.innerWidth - pr.width - 10));
    let top = r.bottom + 8;
    if (top + pr.height > window.innerHeight - 10) top = Math.max(10, r.top - pr.height - 8);
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
  }

  function closePop() {
    if (!popEl) return;
    popEl.hidden = true;
    if (active) active.classList.remove('on');
    active = null;
  }

  function gotoTerm(name) {
    closePop();
    location.hash = '#/t/' + encodeURIComponent(name);
  }

  function onPopClick(e) {
    if (e.target.closest('.tp-x')) { closePop(); return; }
    if (popTerm) gotoTerm(popTerm.name);
  }

  /* ---------- 编辑 ---------- */
  let editCb = null;

  function openEditor(t, cb) {
    if (!t) return;
    editCb = typeof cb === 'function' ? cb : null;
    if (!modalEl) {
      modalEl = document.createElement('div');
      modalEl.className = 'term-modal';
      modalEl.hidden = true;
      modalEl.innerHTML =
        '<div class="tm-card" role="dialog" aria-modal="true">' +
          '<div class="tm-head"><b class="tm-title"></b><button class="tm-x" type="button" aria-label="关闭">✕</button></div>' +
          '<textarea class="tm-body" maxlength="8000" rows="7" placeholder="正文，支持 Markdown"></textarea>' +
          '<div class="tm-row"><input class="tm-nick" maxlength="20" placeholder="署名（可留空）"><button class="tm-save" type="button">保存</button></div>' +
          '<p class="tm-msg"></p>' +
        '</div>';
      document.body.appendChild(modalEl);
      modalEl.addEventListener('click', e => {
        if (e.target === modalEl || e.target.closest('.tm-x')) closeEditor();
      });
    }
    if (!modalEl._md && window.WXMD) modalEl._md = window.WXMD.attach(modalEl.querySelector('.tm-body'));
    modalEl.dataset.term = t.name;
    modalEl.querySelector('.tm-title').textContent = t.name;
    const ta = modalEl.querySelector('.tm-body');
    ta.value = t.body || '';
    if (modalEl._md) { modalEl._md.refresh(); modalEl._md.preview(false); }
    modalEl.querySelector('.tm-msg').textContent = '';
    try { modalEl.querySelector('.tm-nick').value = localStorage.getItem('wx_nick') || ''; } catch (_) {}
    modalEl.hidden = false;
    document.body.classList.add('locked');
    setTimeout(() => { ta.focus(); ta.setSelectionRange(0, 0); ta.scrollTop = 0; }, 30);
    modalEl.querySelector('.tm-save').onclick = () => saveTerm(t);
  }

  function closeEditor() {
    if (!modalEl) return;
    modalEl.hidden = true;
    document.body.classList.remove('locked');
  }

  async function saveTerm(t) {
    const ta = modalEl.querySelector('.tm-body');
    const nick = modalEl.querySelector('.tm-nick');
    const msg = modalEl.querySelector('.tm-msg');
    const btn = modalEl.querySelector('.tm-save');
    const body = ta.value.trim();
    if (body.length < 2) { msg.textContent = '内容太短'; return; }
    if (!ON) { msg.textContent = '未连接词条服务'; return; }
    btn.disabled = true; btn.textContent = '保存中…';
    try {
      const res = await fetch(BASE + '/rest/v1/rpc/term_upsert', {
        method: 'POST',
        headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_name: t.name, p_body: body, p_nick: nick.value.trim() || '无名侠客', p_visitor: vid() })
      });
      const r = await res.json();
      if (!r || !r.ok) { msg.textContent = (r && r.error) || '保存失败'; btn.disabled = false; btn.textContent = '保存'; return; }
      t.body = r.body; t.filled = true; t.editor = r.editor || ''; t.updated_at = new Date().toISOString();
      try { if (nick.value.trim()) localStorage.setItem('wx_nick', nick.value.trim().slice(0, 20)); } catch (_) {}
      // 更新页面上所有该词条的内联样式
      document.querySelectorAll('.term[data-term="' + CSS.escape(t.name) + '"]').forEach(el => el.classList.remove('term-empty'));
      // 更新缓存
      try {
        const o = JSON.parse(localStorage.getItem(CACHE) || 'null');
        if (o && Array.isArray(o.list)) {
          const it = o.list.find(x => x.name === t.name);
          if (it) { it.body = t.body; it.filled = true; it.editor = t.editor; }
          localStorage.setItem(CACHE, JSON.stringify(o));
        }
      } catch (_) {}
      closeEditor();
      toast('已保存，谢谢你的补充');
      if (editCb) { const f = editCb; editCb = null; f(t); }
    } catch (_) {
      msg.textContent = '网络异常，稍后再试';
    } finally {
      btn.disabled = false; btn.textContent = '保存';
    }
  }

  function toast(text) {
    let el = document.querySelector('.term-toast');
    if (!el) { el = document.createElement('div'); el.className = 'term-toast'; document.body.appendChild(el); }
    el.textContent = text;
    el.classList.add('on');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('on'), 1800);
  }

  /* ---------- 事件 ---------- */
  document.addEventListener('pointerover', e => {
    const sp = e.target.closest && e.target.closest('.term');
    if (!sp) return;
    if (window.matchMedia('(hover:none) and (pointer:coarse)').matches) return;
    clearTimeout(closeTimer);
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => openPop(sp), 140);
  });

  document.addEventListener('pointerout', e => {
    if (window.matchMedia('(hover:none) and (pointer:coarse)').matches) return;
    const sp = e.target.closest && e.target.closest('.term');
    if (!sp) return;
    clearTimeout(hoverTimer);
    closeTimer = setTimeout(() => closePop(), 260);
  });

  document.addEventListener('click', e => {
    const sp = e.target.closest && e.target.closest('.term');
    if (sp) {
      e.preventDefault();
      e.stopPropagation();
      gotoTerm(sp.dataset.term);
      return;
    }
    if (popEl && !popEl.hidden && !e.target.closest('.term-pop')) closePop();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (modalEl && !modalEl.hidden) { closeEditor(); return; }
      closePop();
    }
  });

  window.addEventListener('scroll', () => {
    if (!popEl || popEl.hidden) return;
    if (popEl.classList.contains('is-sheet')) return;   // 手机底部面板不随滚动消失
    closePop();
  }, { passive: true });
  window.addEventListener('resize', () => { if (popEl && !popEl.hidden) closePop(); });

  /* ---------- 对外 ---------- */
  function addLocal(t) {
    if (!map) map = new Map();
    const item = {
      name: t.name, cat: t.cat || 'other', body: t.body || '',
      filled: !!t.filled, editor: t.editor || '', freq: t.freq | 0,
      updated_at: t.updated_at || new Date().toISOString()
    };
    map.set(item.name, item);
    buildTrie();
    // 写回缓存，刷新页面后仍然在
    try {
      const o = JSON.parse(localStorage.getItem(CACHE) || 'null');
      const list = (o && Array.isArray(o.list)) ? o.list.filter(x => x.name !== item.name) : [];
      list.unshift(item);
      localStorage.setItem(CACHE, JSON.stringify({ at: Date.now(), list }));
    } catch (_) {}
    return item;
  }

  async function refresh() {
    map = null; trie = null; loading = null;
    try { localStorage.removeItem(CACHE); } catch (_) {}
    await load();
  }

  window.WX_TERMS = {
    link,
    ready: load,
    count: () => (map ? map.size : 0),
    get: name => (map ? map.get(name) : null),
    list: () => (map ? [...map.values()] : []),
    refresh,
    addLocal,
    edit: (name, cb) => { const t = map && map.get(name); if (t) openEditor(t, cb); return !!t; },
    toast,
    CAT_NAME,
    on: ON
  };

  load().then(() => {
    if (window.WX_TERMS_ONREADY) window.WX_TERMS_ONREADY();
  });
})();
