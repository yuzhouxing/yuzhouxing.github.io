/* ============================================================
   武仙传说 · 攻略总集
   HUD 交互层
   ============================================================ */
(function () {
  'use strict';

  const DATA = window.WX_DATA;
  if (!DATA) { document.body.innerHTML = '<p style="color:#fff;padding:40px">数据加载失败</p>'; return; }

  const GUIDES = DATA.guides;
  const CATS = DATA.cats;
  const CAT_MAP = Object.fromEntries(CATS.map(c => [c.id, c]));
  const CAT_ORDER = CATS.map(c => c.id);
  const ACCENT = {
    start: '#6fb3a0', dungeon: '#d14833', sect: '#d9a94f', mech: '#7a8fd4',
    craft: '#b57edc', alchemy: '#5cb87a', plugin: '#e0a458'
  };
  const BY_ID = Object.fromEntries(GUIDES.map(g => [g.id, g]));
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform);

  const state = { q: '', cat: 'all', sort: 'rec' };
  // 已合并条目的旧链接别名，避免早先分享出去的地址 404
  const ALIAS = { 'c3047fea': 'e4158b9f' };
  let homeScroll = 0;
  let secEls = [];
  let scrollMemo = 0;
  let cmdkIdx = -1;

  const $ = s => document.querySelector(s);
  const el = (t, c) => { const n = document.createElement(t); if (c) n.className = c; return n; };

  const grid = $('#grid'), chips = $('#chips'), search = $('#search');
  const viewHome = $('#viewHome'), viewReader = $('#viewReader');
  const article = $('#article'), tocBox = $('#toc'), pager = $('#pager');
  const lightbox = $('#lightbox'), lbImg = $('#lbImg');
  const progress = $('#progress'), topbar = $('#topbar');
  const cmdk = $('#cmdk'), cmdkInput = $('#cmdkInput'), cmdkList = $('#cmdkList');

  /* ---------- 索引 ---------- */
  const index = GUIDES.map(g => {
    let txt = g.title + ' ' + g.tags.join(' ') + ' ' + g.summary + ' ';
    for (const b of g.blocks) {
      if (b.t === 'p' || b.t === 'h' || b.t === 'code') txt += b.text + ' ';
      else if (b.t === 'table') for (const r of b.rows) txt += r.join(' ') + ' ';
    }
    return { g, txt: txt.toLowerCase() };
  });

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => n >= 10000 ? (n / 10000).toFixed(1).replace(/\.0$/, '') + 'w' : String(n);
  const catName = id => (CAT_MAP[id] || {}).name || id;
  const pad = (n, w = 3) => String(n).padStart(w, '0');

  function hl(text, q) {
    if (!q) return esc(text);
    const i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return esc(text);
    return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + q.length)) + '</mark>' + esc(text.slice(i + q.length));
  }

  /* ---------- 导航 ---------- */
  function buildNav() {
    const nav = $('#topnav');
    nav.innerHTML = '';
    const mk = (id, name, idx) => {
      const a = el('a'); a.href = id === 'all' ? '#/' : '#/c/' + id;
      a.dataset.cat = id;
      a.innerHTML = '<span class="idx">' + idx + '</span>' + esc(name);
      nav.appendChild(a);
    };
    mk('all', '全部', '00');
    CATS.forEach((c, i) => mk(c.id, c.name, pad(i + 1, 2)));
  }

  function buildChips() {
    const counts = {};
    GUIDES.forEach(g => counts[g.cat] = (counts[g.cat] || 0) + 1);
    chips.innerHTML = '';
    const mk = (id, name, n, idx) => {
      const b = el('button', 'chip' + (state.cat === id ? ' on' : ''));
      b.dataset.cat = id;
      b.innerHTML = '<span class="c-idx">' + idx + '</span>' + esc(name) + '<span class="c-num">' + n + '</span>';
      b.onclick = () => { location.hash = id === 'all' ? '#/' : '#/c/' + id; };
      chips.appendChild(b);
    };
    mk('all', '全部', GUIDES.length, '00');
    CATS.forEach((c, i) => { if (counts[c.id]) mk(c.id, c.name, counts[c.id], pad(i + 1, 2)); });
  }

  /* ---------- 过滤 ---------- */
  const terms = q => {
    const s = String(q).trim().toLowerCase();
    return s ? s.split(/\s+/).filter(Boolean) : [];
  };
  function results() {
    const q = state.q.trim().toLowerCase();
    const ts = terms(q);
    let list;
    if (!ts.length) {
      list = GUIDES.slice();
    } else {
      list = index.filter(x => ts.every(t => x.txt.includes(t))).map(x => x.g);
      list.sort((a, b) => {
        const am = ts.every(t => a.title.toLowerCase().includes(t));
        const bm = ts.every(t => b.title.toLowerCase().includes(t));
        if (am !== bm) return am ? -1 : 1;
        return b.w - a.w;
      });
    }
    if (state.cat !== 'all') list = list.filter(g => g.cat === state.cat);
    if (state.q.trim()) return list;
    if (state.sort === 'len') list.sort((a, b) => b.chars - a.chars);
    else if (state.sort === 'img') list.sort((a, b) => b.imgs - a.imgs);
    else list.sort((a, b) => b.w - a.w);
    return list;
  }

  /* ---------- 卡片 ---------- */
  function renderGrid() {
    const list = results();
    grid.innerHTML = '';
    $('#resultCount').textContent = pad(list.length) + ' / ' + pad(GUIDES.length);
    $('#empty').hidden = list.length > 0;

    const q = state.q.trim();
    const base = Math.max(0, 1);

    list.forEach((g, i) => {
      const a = el('a', 'card');
      a.href = '#/g/' + g.id;
      a.dataset.id = g.id;
      a.style.setProperty('--accent', ACCENT[g.cat] || 'var(--gold)');
      a.style.setProperty('--d', Math.min(i, 16) * 24 + 'ms');

      const tags = g.tags.slice(0, 2).map(t => '<span>' + esc(t) + '</span>').join('');
      const no = pad(GUIDES.indexOf(g) >= 0 ? sortedIndex(g) : i + 1);
      a.innerHTML =
        '<div class="card-top">' +
          '<span class="card-cat">' + esc(catName(g.cat)) + '</span>' +
          '<span class="card-no">NO.' + no + '</span>' +
        '</div>' +
        '<h3>' + hl(g.title, q) + '</h3>' +
        '<p>' + hl(g.summary || '', q) + '</p>' +
        '<div class="card-foot">' +
          '<span class="k">' + (g.chars ? fmt(g.chars) + ' 字' : '图集') + '</span>' +
          (g.imgs ? '<span class="sep"></span><span>' + g.imgs + ' 图</span>' : '') +
          (g.chars ? '<span class="sep"></span><span>' + Math.max(1, Math.round(g.chars / 420)) + ' min</span>' : '') +
          '<span class="card-tags">' + tags + '</span>' +
        '</div>';
      grid.appendChild(a);
    });
  }

  // 全站固定编号（按推荐权重）
  const ORDER_MAP = {};
  GUIDES.slice().sort((a, b) => b.w - a.w).forEach((g, i) => { ORDER_MAP[g.id] = i + 1; });
  function sortedIndex(g) { return ORDER_MAP[g.id] || 1; }

  /* ---------- 详情 ---------- */
  function renderReader(id) {
    const g = BY_ID[id];
    if (!g) { location.hash = '#/'; return; }
    const accent = ACCENT[g.cat] || '#d9a94f';
    document.documentElement.style.setProperty('--accent', accent);
    const no = pad(sortedIndex(g));

    // 面包屑
    $('#crumb').innerHTML =
      '<a href="#/">INDEX</a><span class="sep">/</span>' +
      '<a href="#/c/' + g.cat + '">' + esc(catName(g.cat)) + '</a>' +
      '<span class="sep">/</span><span class="cur">NO.' + no + '</span>';

    const head = el('div', 'art-head');
    head.innerHTML =
      '<div class="art-meta">' +
        '<span class="art-cat">' + esc(catName(g.cat)) + '</span>' +
        (g.chars ? '<span>' + fmt(g.chars) + ' 字</span><span class="sep"></span>' : '') +
        (g.imgs ? '<span>' + g.imgs + ' 图</span><span class="sep"></span>' : '') +
        (g.chars ? '<span>' + Math.max(1, Math.round(g.chars / 420)) + ' MIN READ</span>' : '<span>图集</span>') +
      '</div>' +
      '<h1>' + esc(g.title) + '</h1>';

    const frag = document.createDocumentFragment();
    frag.appendChild(head);
    const isGallery = !g.chars && g.imgs > 0;
    if (isGallery) {
      const note = el('p', 'gallery-note');
      note.innerHTML = '本篇为图集攻略，共 <b>' + g.imgs + '</b> 张，点击任意图片可放大查看。';
      frag.appendChild(note);
    }
    let imgCount = 0;
    let hIdx = 0;
    const headings = [];

    g.blocks.forEach(b => {
      if (b.t === 'p') {
        const p = el('p');
        p.innerHTML = esc(b.text)
          .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
          .replace(/`([^`]+)`/g, '<code>$1</code>');
        frag.appendChild(p);
      } else if (b.t === 'h') {
        const lvl = Math.min(Math.max(b.lvl || 3, 2), 4);
        const h = el('h' + lvl);
        h.textContent = b.text;
        if (b.toc !== false && lvl <= 3) {
          h.id = 'sec-' + (hIdx++);
          headings.push({ id: h.id, text: b.text });
        }
        frag.appendChild(h);
      } else if (b.t === 'img') {
        const img = el('img');
        img.src = b.src;
        img.alt = g.title;
        img.loading = 'lazy';
        img.decoding = 'async';
        img.style.opacity = 0;
        img.style.transition = 'opacity .5s';
        img.onload = () => { img.style.opacity = 1; };
        if (img.complete) img.style.opacity = 1;
        if (isGallery) {
          imgCount++;
          const fig = el('figure', 'fig');
          const cap = el('figcaption');
          cap.textContent = 'P.' + pad(imgCount, 2) + ' / ' + pad(g.imgs, 2);
          fig.appendChild(img);
          fig.appendChild(cap);
          frag.appendChild(fig);
        } else {
          frag.appendChild(img);
        }
      } else if (b.t === 'table') {
        const wrap = el('table');
        const maxc = Math.max(...b.rows.map(r => r.length));
        let html = '';
        b.rows.forEach((row, ri) => {
          const tag = ri === 0 && b.rows.length > 1 && maxc > 1 ? 'th' : 'td';
          html += '<tr>' + row.map(c => '<' + tag + '>' + esc(c) + '</' + tag + '>').join('') + '</tr>';
        });
        wrap.innerHTML = html;
        frag.appendChild(wrap);
      } else if (b.t === 'sep') {
        const s2 = el('div', 'page-sep');
        s2.innerHTML = '<span>' + esc(b.text) + '</span>';
        frag.appendChild(s2);
      } else if (b.t === 'code') {
        const pre = el('pre'), code = el('code');
        code.textContent = b.text;
        pre.appendChild(code);
        frag.appendChild(pre);
      }
    });

    article.innerHTML = '';
    article.appendChild(frag);

    // 目录
    tocBox.innerHTML = '';
    if (headings.length > 1) {
      const t = el('p', 'toc-t'); t.textContent = 'CONTENTS'; tocBox.appendChild(t);
      headings.forEach((h, i) => {
        const a = el('a');
        a.dataset.sec = h.id;
        a.tabIndex = 0;
        a.setAttribute('role', 'link');
        a.innerHTML = '<span class="t-n">' + pad(i + 1, 2) + '</span><span class="t-x">' + esc(h.text) + '</span>';
        const go = () => document.getElementById(h.id).scrollIntoView({ behavior: 'smooth', block: 'start' });
        a.onclick = e => { e.preventDefault(); go(); };
        a.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
        tocBox.appendChild(a);
      });
    }

    // 下载
    const dl = $('#dlBtn');
    dl.hidden = !g.src;
    if (g.src) {
      dl.href = 'assets/files/' + encodeURIComponent(g.src.replace(/[\\/:*?"<>|]/g, '_'));
      dl.setAttribute('download', g.src);
    }

    // 上下篇
    const same = GUIDES.filter(x => x.cat === g.cat).sort((a, b) => b.w - a.w);
    const pos = same.findIndex(x => x.id === g.id);
    const prev = pos > 0 ? same[pos - 1] : null;
    const next = pos >= 0 && pos < same.length - 1 ? same[pos + 1] : null;
    pager.innerHTML = '';
    if (prev) {
      const a = el('a', 'prev');
      a.href = '#/g/' + prev.id;
      a.innerHTML = '<span class="lbl">PREV · ' + esc(catName(prev.cat)) + '</span><span class="ttl">' + esc(prev.title) + '</span>';
      pager.appendChild(a);
    }
    if (next) {
      const a = el('a', 'next');
      a.href = '#/g/' + next.id;
      a.innerHTML = '<span class="lbl">NEXT · ' + esc(catName(next.cat)) + '</span><span class="ttl">' + esc(next.title) + '</span>';
      pager.appendChild(a);
    }

    secEls = headings.map(h => document.getElementById(h.id)).filter(Boolean);
    window.scrollTo(0, 0);
    document.title = g.title + ' · 武仙攻略';
  }

  /* ---------- 路由 ---------- */
  function route() {
    const h = location.hash || '#/';
    const mG = h.match(/^#\/g\/([a-f0-9]+)/);
    const mC = h.match(/^#\/c\/(\w+)/);

    if (mG) {
      const gid = ALIAS[mG[1]] || mG[1];
      if (!BY_ID[gid]) { location.hash = '#/'; return; }
      if (gid !== mG[1]) { location.replace('#/g/' + gid); return; }
      viewHome.hidden = true;
      viewReader.hidden = false;
      renderReader(gid);
    } else {
      viewReader.hidden = true;
      viewHome.hidden = false;
      document.title = '武仙传说 · 攻略总集';
      state.cat = (mC && CAT_MAP[mC[1]]) ? mC[1] : 'all';
      buildChips();
      buildNav();
      renderGrid();
      if (window.__fromReader) {
        window.scrollTo({ top: homeScroll, behavior: 'instant' });
        window.__fromReader = false;
      }
    }
    updateNav();
    updateProgress();
  }

  function updateNav() {
    document.querySelectorAll('#topnav a').forEach(a => {
      a.classList.toggle('on', a.dataset.cat === state.cat);
    });
  }

  /* ---------- 命令面板 ---------- */
  function openCmdk(prefill) {
    cmdk.hidden = false;
    document.body.classList.add('locked');
    cmdkInput.value = prefill || state.q || '';
    renderCmdk();
    setTimeout(() => { cmdkInput.focus(); cmdkInput.select(); }, 30);
  }
  function closeCmdk() {
    cmdk.hidden = true;
    document.body.classList.remove('locked');
    cmdkIdx = -1;
  }
  function cmdResults(q) {
    const s = q.trim().toLowerCase();
    const ts = terms(s);
    if (!ts.length) return GUIDES.slice().sort((a, b) => b.w - a.w).slice(0, 8);
    const hit = index.filter(x => ts.every(t => x.txt.includes(t))).map(x => x.g);
    hit.sort((a, b) => {
      const am = ts.every(t => a.title.toLowerCase().includes(t));
      const bm = ts.every(t => b.title.toLowerCase().includes(t));
      if (am !== bm) return am ? -1 : 1;
      return b.w - a.w;
    });
    return hit.slice(0, 9);
  }
  function renderCmdk() {
    const q = cmdkInput.value;
    const list = cmdResults(q);
    cmdkList.innerHTML = '';
    $('#cmdkCount').textContent = list.length + ' 条';
    if (!list.length) {
      cmdkList.innerHTML = '<div class="cmdk-empty">没有匹配条目</div>';
      cmdkIdx = -1;
      return;
    }
    if (cmdkIdx < 0 || cmdkIdx >= list.length) cmdkIdx = 0;
    list.forEach((g, i) => {
      const d = el('div', 'cmdk-item' + (i === cmdkIdx ? ' sel' : ''));
      d.style.setProperty('--accent', ACCENT[g.cat] || 'var(--gold)');
      d.innerHTML =
        '<span class="ci-cat">' + esc(catName(g.cat)) + '</span>' +
        '<span class="ci-main">' +
          '<span class="ci-title">' + hl(g.title, q) + '</span>' +
          '<span class="ci-desc">' + hl((g.summary || '').slice(0, 58), q) + '</span>' +
        '</span>' +
        '<span class="ci-go">NO.' + pad(sortedIndex(g)) + '</span>';
      d.onmouseenter = () => { cmdkIdx = i; paintCmdk(); };
      d.onclick = () => { closeCmdk(); location.hash = '#/g/' + g.id; };
      cmdkList.appendChild(d);
    });
    paintCmdk();
  }
  function paintCmdk() {
    const items = cmdkList.querySelectorAll('.cmdk-item');
    items.forEach((n, i) => n.classList.toggle('sel', i === cmdkIdx));
    const cur = items[cmdkIdx];
    if (cur) {
      const top = cur.offsetTop, h = cur.offsetHeight, box = cmdkList;
      if (top < box.scrollTop) box.scrollTop = top - 6;
      else if (top + h > box.scrollTop + box.clientHeight) box.scrollTop = top + h - box.clientHeight + 6;
    }
  }
  function cmdkGo() {
    const list = cmdResults(cmdkInput.value);
    const g = list[cmdkIdx];
    if (g) { closeCmdk(); location.hash = '#/g/' + g.id; }
  }

  /* ---------- 事件 ---------- */
  search.addEventListener('input', e => { state.q = e.target.value; renderGrid(); });

  $('#sortBtn').onclick = () => {
    const order = ['rec', 'len', 'img'];
    const label = { rec: '推荐', len: '字数', img: '图片' };
    state.sort = order[(order.indexOf(state.sort) + 1) % order.length];
    $('#sortLabel').textContent = label[state.sort];
    renderGrid();
  };

  $('#emptyReset').onclick = () => {
    state.q = ''; search.value = ''; location.hash = '#/';
    setTimeout(() => { buildChips(); renderGrid(); }, 0);
  };

  $('#backBtn').onclick = () => { window.__fromReader = true; history.length > 1 ? history.back() : (location.hash = '#/'); };
  $('#cmdBtn').onclick = () => openCmdk();

  cmdkInput.addEventListener('input', () => { cmdkIdx = 0; renderCmdk(); });
  cmdk.querySelector('[data-close]').onclick = closeCmdk;

  // 图片灯箱
  document.addEventListener('click', e => {
    const img = e.target.closest('.article img');
    if (img && img.src) {
      lbImg.src = img.src;
      lightbox.hidden = false;
    }
  });
  lightbox.addEventListener('click', () => { lightbox.hidden = true; });

  // 卡片光斑
  grid.addEventListener('mousemove', e => {
    const c = e.target.closest('.card');
    if (!c) return;
    const r = c.getBoundingClientRect();
    c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    c.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }, { passive: true });

  // 键盘
  document.addEventListener('keydown', e => {
    const inInput = /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      cmdk.hidden ? openCmdk() : closeCmdk();
      return;
    }
    if (!cmdk.hidden) {
      if (e.key === 'Escape') { e.preventDefault(); closeCmdk(); }
      else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const n = cmdResults(cmdkInput.value).length;
        cmdkIdx = (cmdkIdx + 1) % Math.max(1, n); paintCmdk();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const n = cmdResults(cmdkInput.value).length;
        cmdkIdx = (cmdkIdx - 1 + n) % Math.max(1, n); paintCmdk();
      } else if (e.key === 'Enter') { e.preventDefault(); cmdkGo(); }
      return;
    }
    if (e.key === '/' && !inInput) { e.preventDefault(); if (viewHome.hidden) location.hash = '#/'; setTimeout(() => search.focus(), 30); return; }
    if (e.key === 'Escape') {
      if (!lightbox.hidden) lightbox.hidden = true;
      else if (!viewReader.hidden) { window.__fromReader = true; location.hash = '#/'; }
      else if (inInput) document.activeElement.blur();
      return;
    }
    if (!viewReader.hidden && !inInput) {
      if (e.key.toLowerCase() === 'j') { const n = pager.querySelector('.next'); if (n) { window.__fromReader = true; location.href = n.href; } }
      if (e.key.toLowerCase() === 'k') { const p = pager.querySelector('.prev'); if (p) { window.__fromReader = true; location.href = p.href; } }
      if (e.key === 'ArrowLeft') { const p = pager.querySelector('.prev'); if (p) { window.__fromReader = true; location.href = p.href; } }
      if (e.key === 'ArrowRight') { const n = pager.querySelector('.next'); if (n) { window.__fromReader = true; location.href = n.href; } }
    }
  });

  // 滚动
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      updateProgress();
      topbar.classList.toggle('solid', window.scrollY > 20);
      const t = $('#totop');
      if (t) t.classList.toggle('show', window.scrollY > 620);
      ticking = false;
      if (!viewReader.hidden) highlightToc();
    });
  }, { passive: true });

  function updateProgress() {
    const h = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + '%';
  }

  function highlightToc() {
    if (!secEls.length) return;
    let cur = null;
    for (const s of secEls) if (s.getBoundingClientRect().top < 160) cur = s.id;
    document.querySelectorAll('.toc a').forEach(a => a.classList.toggle('on', a.dataset.sec === cur));
  }

  /* ---------- HUD ---------- */
  function buildStats() {
    const chars = GUIDES.reduce((s, g) => s + g.chars, 0);
    const imgs = GUIDES.reduce((s, g) => s + g.imgs, 0);
    const items = [
      [GUIDES.length, 'ENTRIES', '篇'],
      [Math.round(chars / 10000), 'K CHARS', '万字'],
      [imgs, 'IMAGES', '张图'],
      [CATS.length, 'SECTORS', '分类']
    ];
    $('#stats').innerHTML = items.map(([n, u, cn], i) =>
      '<div class="hud-cell"><span class="hud-num" data-n="' + n + '" data-i="' + i + '">0</span>' +
      '<span class="hud-unit">' + u + '</span></div>').join('');

    $('#hmCount').textContent = GUIDES.length + ' ENTRIES';
    $('#footCount').textContent = GUIDES.length;
    $('#footDate').textContent = (DATA.meta && DATA.meta.updated) || '—';

    // 数字滚动（定时器驱动，确保一定能落地）
    const nums = document.querySelectorAll('.hud-num');
    nums.forEach(n => { n.textContent = '0'; });
    let tick = 0;
    const dur = 700, stepMs = 40;
    const timer = setInterval(() => {
      tick += stepMs;
      const p = Math.min(1, tick / dur);
      const e = 1 - Math.pow(1 - p, 3);
      nums.forEach(n => { n.textContent = Math.round(+n.dataset.n * e); });
      if (p >= 1) {
        clearInterval(timer);
        nums.forEach(n => { n.textContent = n.dataset.n; });
      }
    }, stepMs);
  }

  /* ---------- 返回顶部 ---------- */
  const toTop = el('button', 'totop');
  toTop.id = 'totop';
  toTop.setAttribute('aria-label', '返回顶部');
  toTop.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 19V5m0 0-6 6m6-6 6 6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  toTop.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  document.body.appendChild(toTop);

  /* ---------- 启动 ---------- */
  if (!isMac) { const k = $('#kbdHint'); if (k) k.textContent = 'Ctrl K'; }
  buildNav();
  buildChips();
  buildStats();
  renderGrid();
  window.addEventListener('hashchange', () => {
    if (/^#\/g\//.test(location.hash) && !viewHome.hidden) {
      homeScroll = window.scrollY;
      window.__fromReader = true;
    }
    route();
  });
  route();
  window.addEventListener('beforeunload', () => { scrollMemo = window.scrollY; });

})();
