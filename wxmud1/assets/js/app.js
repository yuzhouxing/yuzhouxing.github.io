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

  /* 互动数据（点赞 / 浏览量 / 留言），云端不可用时自动走本地 */
  const Cloud = window.WXCloud || null;
  const CloudOn = !!(Cloud && Cloud.hasCloud);   // 只有配了 Supabase 才启用互动功能
  const STATS = { map: {}, mode: 'local', degraded: false };
  let statsReady = false;   // 互动数据是否已就绪，未就绪时卡片留位不显示数字
  const stOf = id => STATS.map[id] || { likes: 0, views: 0 };

  const $ = s => document.querySelector(s);
  const el = (t, c) => { const n = document.createElement(t); if (c) n.className = c; return n; };

  const grid = $('#grid'), chips = $('#chips'), search = $('#search');
  const viewHome = $('#viewHome'), viewReader = $('#viewReader');
  const article = $('#article'), tocBox = $('#toc'), pager = $('#pager');
  const lightbox = $('#lightbox'), lbImg = $('#lbImg');
  const progress = $('#progress'), topbar = $('#topbar');
  const cmdk = $('#cmdk'), cmdkInput = $('#cmdkInput'), cmdkList = $('#cmdkList');
  const qmodal = $('#qmodal'), qmCopy = $('#qmCopy');
  const cmpBar = $('#cmpBar'), cmpState = $('#cmpState');
  const cmpFocus = $('#cmpFocus'), cmpCopy = $('#cmpCopy'), cmpTipEl = $('#cmpTip');
  const pocketNav = $('#pocketNav'), pnPrev = $('#pnPrev'), pnNext = $('#pnNext');
  const pnIdx = $('#pnIdx'), pnName = $('#pnName'), pnMid = $('#pnMid');

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
    else if (state.sort === 'hot') {
      const heat = g => { const s = stOf(g.id); return s.likes * 5 + s.views + (s.likes + s.views > 0 ? 0 : -1); };
      list.sort((a, b) => heat(b) - heat(a) || b.w - a.w);
    }
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
      const st = stOf(g.id);
      const stat = CloudOn
        ? '<span class="card-stat' + (statsReady ? '' : ' is-pending') + '">' +
            '<span class="cs cs-like' + (st.likes > 0 ? ' has' : '') + '" title="' + st.likes + ' 人点赞">' +
              '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7.5-4.6-7.5-9.4A4.1 4.1 0 0 1 12 8a4.1 4.1 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z" fill="currentColor"/></svg>' +
              '<b>' + fmt(st.likes) + '</b>' +
            '</span>' +
            '<span class="cs cs-view' + (st.views > 0 ? ' has' : '') + '" title="' + st.views + ' 次浏览">' +
              '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.2 12S5.8 6.2 12 6.2 21.8 12 21.8 12 18.2 17.8 12 17.8 2.2 12 2.2 12Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/></svg>' +
              '<b>' + fmt(st.views) + '</b>' +
            '</span>' +
          '</span>'
        : '';
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
          (stat ? '<span class="sep"></span>' : '') +
          stat +
          '<span class="card-tags">' + tags + '</span>' +
        '</div>';
      grid.appendChild(a);
    });

    // 标签放不下时整块收起，避免出现半截文字
    grid.querySelectorAll('.card').forEach(card => {
      const tags = card.querySelector('.card-tags');
      if (!tags) return;
      if (tags.scrollWidth > tags.clientWidth + 1) tags.style.display = 'none';
    });
  }

  /* 只刷新卡片上的数字，不重建列表（避免滚动跳动和动画重播） */
  function paintCardStats() {
    grid.querySelectorAll('.card').forEach(card => {
      const id = card.dataset.id;
      if (!id) return;
      const st = stOf(id);
      const like = card.querySelector('.cs-like');
      const view = card.querySelector('.cs-view');
      if (like) {
        like.querySelector('b').textContent = fmt(st.likes);
        like.classList.toggle('has', st.likes > 0);
        like.title = st.likes + ' 人点赞';
      }
      if (view) {
        view.querySelector('b').textContent = fmt(st.views);
        view.classList.toggle('has', st.views > 0);
        view.title = st.views + ' 次浏览';
      }
      const wrap = card.querySelector('.card-stat');
      if (wrap && statsReady) wrap.classList.remove('is-pending');
    });
  }

  /* 回到首页时补拉一次，把文章页里点出来的赞和浏览量同步过来 */
  function refreshHomeStats() {
    if (!CloudOn) return;
    Cloud.stats().then(s => {
      STATS.map = s.map || {};
      statsReady = true;
      if (!viewHome.hidden) paintCardStats();
    }).catch(() => {});
  }

  // 全站固定编号（按推荐权重）
  const ORDER_MAP = {};
  GUIDES.slice().sort((a, b) => b.w - a.w).forEach((g, i) => { ORDER_MAP[g.id] = i + 1; });
  function sortedIndex(g) { return ORDER_MAP[g.id] || 1; }

  /* ---------- 详情 ---------- */
  let currentHeadings = [];   // 当前文章的章节锚点，随身模式的翻节导航用

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

    if (CloudOn) {
      /* ---- 互动条：点赞 / 阅读 / 留言 ---- */
      const st = stOf(g.id);
      const isLiked = !!(Cloud && Cloud.liked(g.id));
      const bar = el('div', 'art-actions');
      bar.innerHTML =
        '<button class="like-btn' + (isLiked ? ' on' : '') + '" id="likeBtn" type="button" aria-pressed="' + isLiked + '">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7.5-4.6-7.5-9.4A4.1 4.1 0 0 1 12 8a4.1 4.1 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>' +
          '<span class="like-txt">' + (isLiked ? '已赞' : '点赞') + '</span>' +
          '<b class="like-num" id="likeNum">' + st.likes + '</b>' +
        '</button>' +
        '<span class="art-view" title="累计阅读"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.6 12S6 5.8 12 5.8 21.4 12 21.4 12 18 18.2 12 18.2 2.6 12 2.6 12Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg><b id="viewNum">' + st.views + '</b> 阅读</span>' +
        '<a class="art-cmt-jump" role="button" tabindex="0"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 11.6c0 4.2-3.8 7.6-8.5 7.6-1 0-2-.15-2.9-.43L4.2 20.2l1.36-3.5C4.3 15.3 3.5 13.5 3.5 11.6 3.5 7.4 7.3 4 12 4s8.5 3.4 8.5 7.6Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>留言 <b id="cmtNumTop">0</b></a>';
      frag.appendChild(bar);

      // 跳到留言区：用脚本滚动，不能改 hash，否则会触发路由返回首页
      const jump = bar.querySelector('.art-cmt-jump');
      const goCmt = () => {
        const t = $('#comments');
        if (t && !t.hidden) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
      jump.onclick = e => { e.preventDefault(); goCmt(); };
      jump.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goCmt(); } };

      const likeBtn = bar.querySelector('#likeBtn');
      likeBtn.onclick = async () => {
        if (!Cloud || likeBtn.disabled) return;
        likeBtn.disabled = true;
        let r;
        try { r = await Cloud.toggleLike(g.id); } catch (_) { r = null; }
        likeBtn.disabled = false;
        if (!r || !r.ok) return;
        likeBtn.classList.toggle('on', r.liked);
        likeBtn.setAttribute('aria-pressed', String(r.liked));
        likeBtn.querySelector('.like-txt').textContent = r.liked ? '已赞' : '点赞';
        likeBtn.querySelector('.like-num').textContent = r.likes;
        STATS.map[g.id] = { likes: r.likes, views: stOf(g.id).views };
        if (r.liked) {
          likeBtn.classList.add('pop');
          setTimeout(() => likeBtn.classList.remove('pop'), 460);
        }
      };

      if (Cloud) {
        Cloud.hit(g.id).then(v => {
          if (typeof v === 'number') {
            STATS.map[g.id] = { likes: stOf(g.id).likes, views: v };
            const vn = bar.querySelector('#viewNum');
            if (vn) vn.textContent = v;
          }
        }).catch(() => {});
      }
    }

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
        const scroller = el('div', 'tbl');
        scroller.appendChild(wrap);
        frag.appendChild(scroller);
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
    currentHeadings = headings;

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

    currentGuideId = g.id;
    renderComments(g.id);
  }

  /* ---------- 留言 ---------- */
  let currentGuideId = null;

  function fmtTime(d) {
    const diff = (Date.now() - d.getTime()) / 1000;
    if (!isFinite(diff)) return '';
    if (diff < 60) return '刚刚';
    if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前';
    if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前';
    if (diff < 86400 * 30) return Math.floor(diff / 86400) + ' 天前';
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function paintComments(arr) {
    const list = $('#cmtList');
    const cnt = $('#cmtCount');
    const top = $('#cmtNumTop');
    if (!list) return;
    if (cnt) cnt.textContent = arr.length;
    if (top) top.textContent = arr.length;
    if (!arr.length) {
      list.innerHTML = '<p class="cmt-empty">还没有留言，来做第一个。</p>';
      return;
    }
    list.innerHTML = arr.map(c => {
      const d = new Date(c.created_at);
      const t = isNaN(d.getTime()) ? '' : fmtTime(d);
      return '<div class="cmt-item">' +
        '<div class="cmt-meta"><b>' + esc(c.nick || '无名侠客') + '</b><span>' + t + '</span>' +
          (c.mine ? '<button class="cmt-del" data-del="' + esc(String(c.id)) + '" type="button">删除</button>' : '') +
        '</div>' +
        '<p class="cmt-text">' + esc(c.body) + '</p>' +
      '</div>';
    }).join('');
  }

  async function renderComments(id) {
    const box = $('#comments');
    if (!box) return;
    if (!CloudOn) { box.hidden = true; return; }
    box.hidden = false;
    bindCommentForm();
    const list = $('#cmtList');
    if (list) list.innerHTML = '<p class="cmt-empty">加载中…</p>';
    let r = { list: [] };
    try { r = await Cloud.comments(id); } catch (_) {}
    if (currentGuideId !== id) return; // 期间已切到别的篇
    paintComments(r.list || []);
  }

  function bindCommentForm() {
    const form = $('#cmtForm');
    if (!form || form.dataset.bound) return;
    form.dataset.bound = '1';
    const body = $('#cmtBody'), nick = $('#cmtNick'), tip = $('#cmtTip'), len = $('#cmtLen'), send = $('#cmtSend');
    try { const n = localStorage.getItem('wx_nick'); if (n) nick.value = n; } catch (_) {}

    body.addEventListener('input', () => {
      len.textContent = body.value.length + '/300';
      if (tip.textContent) tip.textContent = '';
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (!currentGuideId || send.disabled) return;
      const txt = body.value.trim();
      if (txt.length < 2) { tip.textContent = '至少写两个字'; body.focus(); return; }
      send.disabled = true;
      tip.textContent = '发表中…';
      let r;
      try { r = await Cloud.addComment(currentGuideId, nick.value, txt); }
      catch (_) { r = { ok: false, error: '网络异常，稍后再试' }; }
      send.disabled = false;
      if (!r.ok) { tip.textContent = r.error || '发表失败'; return; }
      try { if (nick.value.trim()) localStorage.setItem('wx_nick', nick.value.trim().slice(0, 20)); } catch (_) {}
      body.value = '';
      len.textContent = '0/300';
      tip.textContent = r.mode === 'local' ? '已存在本机（云端未连通）' : '已发表';
      setTimeout(() => { if (tip.textContent.indexOf('已') === 0) tip.textContent = ''; }, 3000);
      renderComments(currentGuideId);
    });

    $('#cmtList').addEventListener('click', async e => {
      const btn = e.target.closest('[data-del]');
      if (!btn || !currentGuideId) return;
      const cid = btn.dataset.del;
      const raw = /^\d+$/.test(cid) ? Number(cid) : cid;
      btn.disabled = true;
      const r = await Cloud.delComment(currentGuideId, raw).catch(() => ({ ok: false }));
      if (r && r.ok) renderComments(currentGuideId);
      else btn.disabled = false;
    });
  }

  /* ---------- 伴读模式 ----------
     游戏站无法在 iframe 里运行：跨源嵌入时它的初始化会中断（登录对象都不创建，
     点按钮只到 DOM 不触发逻辑），而跨源我们无法注入修复。
     所以游戏固定开在独立窗口，本页只把正文收成窄栏，和游戏窗口并排。 */
  const GAME_URL = 'https://www.wxmud1.com/';
  const GAME_WIN = 'wxmud1_game';
  // 设备判断用触屏能力，不用宽度：桌面窄窗（760px）也要按桌面逻辑走
  const mqTouch = window.matchMedia('(hover:none) and (pointer:coarse)');

  let playId = null;
  let gameWin = null;
  let readerYBeforePlay = 0;
  let tipTimerA = null, tipTimerB = null;

  function flashCmp(msg, hold) {
    clearTimeout(tipTimerA); clearTimeout(tipTimerB);
    cmpTipEl.textContent = msg;
    cmpTipEl.hidden = false;
    cmpTipEl.classList.remove('fade');
    tipTimerA = setTimeout(() => cmpTipEl.classList.add('fade'), hold || 1600);
    tipTimerB = setTimeout(() => { cmpTipEl.hidden = true; cmpTipEl.classList.remove('fade'); }, (hold || 1600) + 500);
  }

  /* 打开游戏：复用同一个具名窗口/标签（重复 open 会让页面重新导航，等于把人踢下线） */
  function openGame() {
    if (gameAlive()) {
      try { gameWin.focus(); } catch (_) {}
      return true;
    }
    try {
      const w = window.open(GAME_URL, GAME_WIN);
      if (w) gameWin = w;
      return !!w;
    } catch (_) { return false; }
  }

  function gameAlive() {
    return !!(gameWin && !gameWin.closed);
  }

  function syncCmpState() {
    if (mqTouch.matches) {
      cmpState.innerHTML = '游戏在<b>新标签</b> · 用标签栏切回';
      cmpFocus.textContent = '切到游戏';
      cmpFocus.disabled = false;
      return;
    }
    const ok = gameAlive();
    cmpState.innerHTML = ok
      ? '游戏在<b>独立窗口</b>运行 · 本页和它并排即可'
      : '游戏窗口已关闭';
    cmpFocus.textContent = ok ? '回到游戏' : '重新打开';
    cmpFocus.disabled = false;
  }

  /* ---------- 随身模式（触屏） ----------
     手机浏览器不允许跨站页面浮在游戏上，物理上没法真的并排。
     所以这里把攻略做成"扫一眼"形态：大字号、章节吸顶、底部一键翻节。 */
  let pocketIdx = 0;

  function pocketSections() {
    return currentHeadings
      .map(h => ({ text: h.text, el: document.getElementById(h.id) }))
      .filter(s => s.el);
  }

  function updatePocket() {
    const secs = pocketSections();
    if (!secs.length) {
      pnIdx.textContent = '全文';
      pnName.textContent = '一节到底';
      pnPrev.disabled = true;
      pnNext.disabled = true;
      return;
    }
    pnPrev.disabled = pocketIdx <= 0;
    pnNext.disabled = pocketIdx >= secs.length - 1;
    pnIdx.textContent = (pocketIdx + 1) + '/' + secs.length;
    pnName.textContent = secs[pocketIdx].text;
  }

  function pocketGo(i) {
    const secs = pocketSections();
    if (!secs.length) return;
    pocketIdx = Math.max(0, Math.min(secs.length - 1, i));
    const y = secs[pocketIdx].el.getBoundingClientRect().top + window.scrollY - 44;
    window.scrollTo({ top: y, behavior: 'smooth' });
    updatePocket();
  }

  function buildPocket() {
    document.body.classList.add('pocket');
    pocketNav.hidden = false;
    pocketIdx = 0;
    updatePocket();
  }

  function clearPocket() {
    document.body.classList.remove('pocket');
    pocketNav.hidden = true;
  }

  pnPrev.onclick = () => pocketGo(pocketIdx - 1);
  pnNext.onclick = () => pocketGo(pocketIdx + 1);
  pnMid.onclick = () => pocketGo(pocketIdx);

  window.addEventListener('scroll', () => {
    if (!document.body.classList.contains('pocket')) return;
    const secs = pocketSections();
    if (!secs.length) return;
    let i = 0;
    for (let k = 0; k < secs.length; k++) {
      if (secs[k].el.getBoundingClientRect().top <= 96) i = k;
    }
    if (i !== pocketIdx) { pocketIdx = i; updatePocket(); }
  }, { passive: true });

  function enterPlay(id) {
    const g = BY_ID[id];
    if (!g) { location.hash = '#/'; return; }
    playId = id;
    document.body.classList.add('playing');
    cmpBar.hidden = false;
    document.title = g.title + ' · 伴读';
    syncCmpState();
    if (mqTouch.matches) buildPocket();
    else if (!gameAlive()) flashCmp('点右上角「重新打开」进入游戏', 3000);
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  }

  function exitPlay() {
    const id = playId || currentGuideId;
    if (!id) { location.hash = '#/'; return; }
    playId = null;
    clearPocket();
    document.body.classList.remove('playing');
    cmpBar.hidden = true;
    document.title = '武仙传说 · 攻略总集';
    window.__restoreY = readerYBeforePlay;
    location.hash = '#/g/' + id;
  }

  cmpBack.onclick = () => exitPlay();

  cmpFocus.onclick = () => {
    if (mqTouch.matches) {
      if (!gameAlive()) { openGame(); syncCmpState(); flashCmp('游戏已在新标签打开', 2400); return; }
      try { gameWin.focus(); } catch (_) {}
      flashCmp('没切过去就用浏览器标签栏', 2600);
      return;
    }
    if (gameAlive()) { try { gameWin.focus(); } catch (_) {} flashCmp('已切到游戏窗口'); return; }
    if (openGame()) { syncCmpState(); flashCmp('游戏窗口已打开'); }
    else flashCmp('浏览器拦住了弹窗，请允许后重试', 3000);
  };

  cmpCopy.onclick = () => {
    const done = () => flashCmp('游戏地址已复制');
    const fallback = () => {
      const t = document.createElement('textarea');
      t.value = GAME_URL;
      t.style.cssText = 'position:fixed;top:-999px;opacity:0';
      document.body.appendChild(t);
      t.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (_) {}
      t.remove();
      ok ? done() : flashCmp('复制失败：' + GAME_URL, 3600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(GAME_URL).then(done).catch(fallback);
    } else fallback();
  };

  /* 游戏窗口被关掉时同步状态 */
  setInterval(() => { if (playId && !mqTouch.matches) syncCmpState(); }, 2500);

  /* 入口：必须在点击手势里同步 open，否则会被弹窗拦截 */
  const goPlay = () => {
    if (!currentGuideId) return;
    readerYBeforePlay = window.scrollY;
    const opened = openGame();
    if (location.hash === '#/play/' + currentGuideId) {
      if (playId !== currentGuideId) enterPlay(currentGuideId);
    } else {
      location.hash = '#/play/' + currentGuideId;
    }
    if (!opened) flashCmp('浏览器拦住了游戏窗口，点「重新打开」可重试', 3400);
  };
  $('#playBtn').onclick = goPlay;
  $('#playFab').onclick = goPlay;

  /* ---------- 路由 ---------- */
  function route() {
    const h = location.hash || '#/';
    const mP = h.match(/^#\/play\/([a-f0-9]+)/);
    const mG = h.match(/^#\/g\/([a-f0-9]+)/);
    const mC = h.match(/^#\/c\/(\w+)/);

    if (mP) {
      const gid = ALIAS[mP[1]] || mP[1];
      if (!BY_ID[gid]) { location.hash = '#/'; return; }
      viewHome.hidden = true;
      viewReader.hidden = false;
      if (playId !== gid) {
        if (currentGuideId !== gid || viewReader.hidden) renderReader(gid);
        enterPlay(gid);
      }
      updateNav();
      return;
    }

    // 离开伴读模式
    if (document.body.classList.contains('playing')) {
      playId = null;
      cmpBar.hidden = true;
      if (typeof clearPocket === 'function') clearPocket();
      document.body.classList.remove('playing');
      document.title = '武仙传说 · 攻略总集';
    }

    if (mG) {
      const gid = ALIAS[mG[1]] || mG[1];
      if (!BY_ID[gid]) { location.hash = '#/'; return; }
      if (gid !== mG[1]) { location.replace('#/g/' + gid); return; }
      viewHome.hidden = true;
      viewReader.hidden = false;
      renderReader(gid);
      if (window.__restoreY != null) {
        const y = window.__restoreY;
        window.__restoreY = null;
        requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'instant' }));
      }
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
    const order = CloudOn ? ['rec', 'hot', 'len', 'img'] : ['rec', 'len', 'img'];
    const label = { rec: '推荐', hot: '最热', len: '字数', img: '图片' };
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

  /* ---------- QQ 群 ---------- */
  function openQQ() {
    qmodal.hidden = false;
    document.body.classList.add('locked');
    setTimeout(() => qmCopy.focus(), 40);
  }
  function closeQQ() {
    qmodal.hidden = true;
    if (cmdk.hidden) document.body.classList.remove('locked');
  }
  $('#qqBtn').onclick = openQQ;
  qmodal.querySelectorAll('[data-qclose]').forEach(n => { n.onclick = closeQQ; });

  const isMobileUA = /Android|iPhone|iPad|iPod|Mobile|HarmonyOS/i.test(navigator.userAgent);
  async function copyGroupNum() {
    const num = $('#qmNum').textContent.trim();
    try {
      await navigator.clipboard.writeText(num);
      return true;
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = num;
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
      ta.remove();
      return ok;
    }
  }
  function flash(btn, text) {
    if (!btn.dataset.label) btn.dataset.label = btn.textContent;
    btn.textContent = text;
    btn.classList.add('ok');
    clearTimeout(btn._t);
    btn._t = setTimeout(() => {
      btn.textContent = btn.dataset.label;
      btn.classList.remove('ok');
    }, 1800);
  }
  qmCopy.onclick = async () => flash(qmCopy, (await copyGroupNum()) ? '已复制' : '请手动选择群号');
  // 桌面端没有 mqqapi 协议处理器，改为复制群号，避免点了没反应
  $('#qmOpen').onclick = async e => {
    if (isMobileUA) return;
    e.preventDefault();
    flash($('#qmOpen'), (await copyGroupNum()) ? '已复制，去 QQ 搜索' : '请手动复制');
  };

  cmdkInput.addEventListener('input', () => { cmdkIdx = 0; renderCmdk(); });
  cmdk.querySelector('[data-close]').onclick = closeCmdk;

  // 图片灯箱（正文与伴随浮窗共用）
  document.addEventListener('click', e => {
    const img = e.target.closest('.article img, .fl-body img');
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

    // 伴读模式：Esc 先关灯箱，再退出；其余快捷键照常可用
    if (document.body.classList.contains('playing')) {
      if (e.key === 'Escape') {
        if (!lightbox.hidden) { lightbox.hidden = true; return; }
        e.preventDefault();
        exitPlay();
        return;
      }
    }

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
    if (e.key === '/' && !inInput && qmodal.hidden) { e.preventDefault(); if (viewHome.hidden) location.hash = '#/'; setTimeout(() => search.focus(), 30); return; }
    if (e.key === 'Escape') {
      if (!qmodal.hidden) closeQQ();
      else if (!lightbox.hidden) lightbox.hidden = true;
      else if (!viewReader.hidden) { window.__fromReader = true; location.hash = '#/'; }
      else if (inInput) document.activeElement.blur();
      return;
    }
    if (!viewReader.hidden && !inInput && qmodal.hidden) {
      const jump = (a, fromReader) => {
        if (!a) return;
        const gid = (a.getAttribute('href') || '').replace('#/g/', '');
        // 伴读模式下翻篇要留在伴读，别被踢回普通阅读页
        if (document.body.classList.contains('playing') && gid) { location.hash = '#/play/' + gid; return; }
        window.__fromReader = !!fromReader;
        location.href = a.href;
      };
      if (e.key.toLowerCase() === 'j') jump(pager.querySelector('.next'), true);
      if (e.key.toLowerCase() === 'k') jump(pager.querySelector('.prev'), true);
      if (e.key === 'ArrowLeft') jump(pager.querySelector('.prev'), true);
      if (e.key === 'ArrowRight') jump(pager.querySelector('.next'), true);
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

  /* 互动数据：异步加载，到了再补数字，不阻塞首屏 */
  if (CloudOn) {
    Cloud.stats().then(s => {
      STATS.map = s.map || {};
      STATS.mode = s.mode;
      STATS.degraded = !!s.degraded;
      statsReady = true;
      if (!viewHome.hidden) {
        const y = window.scrollY;
        renderGrid();
        window.scrollTo(0, y);
      }
      if (!viewReader.hidden && currentGuideId) {
        const st = stOf(currentGuideId);
        const ln = $('#likeNum'), vn = $('#viewNum');
        if (ln) ln.textContent = st.likes;
        if (vn) vn.textContent = st.views;
      }
    }).catch(() => {});

    // 文章页点赞后即时回写首页数字
    if (Cloud.onChange) {
      Cloud.onChange(snap => {
        if (!snap || !snap.map) return;
        STATS.map = snap.map;
        statsReady = true;
        if (!viewHome.hidden) paintCardStats();
      });
    }
  }

  window.addEventListener('hashchange', () => {
    if (/^#\/g\//.test(location.hash) && !viewHome.hidden) {
      homeScroll = window.scrollY;
      window.__fromReader = true;
    }
    route();
    refreshHomeStats();
  });
  route();
  window.addEventListener('beforeunload', () => { scrollMemo = window.scrollY; });

})();
