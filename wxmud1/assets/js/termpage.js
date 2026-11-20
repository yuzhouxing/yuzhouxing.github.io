/* ============================================================
   词条独立页 + 词条总览
   ------------------------------------------------------------
   · #/t        总览：全部词条、搜索、筛选、新增
   · #/t/名称   详情：释义、出现过的攻略、相关词条、编辑记录
   · 正文里的名词悬停出简义，点击进这里
   ============================================================ */
(function () {
  'use strict';

  const DATA = window.WX_DATA;
  if (!DATA) return;
  const CFG = window.WX_SUPABASE || {};
  const BASE = String(CFG.url || '').replace(/\/+$/, '');
  const KEY = String(CFG.key || '');
  const ON = /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(BASE) && KEY.length > 20;

  const CAT_NAME = { sect: '门派', skill: '武学', equip: '装备', place: '地点', stat: '属性', other: '术语' };
  const CAT_ORDER = ['skill', 'equip', 'sect', 'place', 'stat', 'other'];
  const GCAT = Object.fromEntries((DATA.cats || []).map(c => [c.id, c.name]));
  const GUIDES = DATA.guides;
  const BY_ID = Object.fromEntries(GUIDES.map(g => [g.id, g]));
  const T = () => window.WX_TERMS;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const catName = id => CAT_NAME[id] || '术语';
  const gcatName = id => GCAT[id] || '攻略';

  function dateTxt(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function count(text, w) {
    if (!text || !w) return 0;
    let n = 0, i = 0;
    while ((i = text.indexOf(w, i)) !== -1) { n++; i += w.length; }
    return n;
  }

  function snippet(text, w) {
    const i = text.indexOf(w);
    if (i < 0) return '';
    const a = Math.max(0, i - 26), b = Math.min(text.length, i + w.length + 26);
    return (a > 0 ? '…' : '') + esc(text.slice(a, i)) + '<mark>' + esc(w) + '</mark>' +
      esc(text.slice(i + w.length, b)) + (b < text.length ? '…' : '');
  }

  /* ---------- 正文索引（用于「出现在哪些攻略」） ---------- */
  const textCache = new Map();
  function guideText(g) {
    if (textCache.has(g.id)) return textCache.get(g.id);
    let s = '';
    for (const b of g.blocks) {
      if (b.t === 'p' || b.t === 'h' || b.t === 'sep' || b.t === 'code') s += (b.text || '') + '\n';
      else if (b.t === 'table') s += b.rows.map(r => r.join(' ')).join('\n') + '\n';
    }
    textCache.set(g.id, s);
    return s;
  }

  function scan(name) {
    const out = { total: 0, guides: [] };
    for (const g of GUIDES) {
      let sec = '';
      let n = 0;
      const hits = [];
      for (const b of g.blocks) {
        if (b.t === 'h') { sec = b.text || ''; }
        let text = '';
        if (b.t === 'p' || b.t === 'h' || b.t === 'sep' || b.t === 'code') text = b.text || '';
        else if (b.t === 'table') text = b.rows.map(r => r.join(' ')).join(' ');
        if (!text) continue;
        const c = count(text, name);
        if (c) {
          n += c;
          if (hits.length < 2) hits.push({ sec, snippet: snippet(text, name) });
        }
      }
      if (n) {
        out.total += n;
        out.guides.push({ id: g.id, title: g.title, cat: g.cat, n, hits });
      }
    }
    out.guides.sort((a, b) => b.n - a.n);
    return out;
  }

  function related(name, guideIds) {
    const mod = T();
    if (!mod) return [];
    const names = mod.list();
    const texts = guideIds.slice(0, 6).map(id => guideText(BY_ID[id])).join(' ');
    if (!texts) return [];
    const hits = [];
    for (const t of names) {
      if (t.name === name || t.name.length < 2) continue;
      const c = count(texts, t.name);
      if (c) hits.push({ name: t.name, c, filled: t.filled });
    }
    hits.sort((a, b) => b.c - a.c);
    return hits.slice(0, 12);
  }

  /* ---------- 页面骨架 ---------- */
  const viewList = document.createElement('section');
  viewList.className = 'view term-list-view';
  viewList.id = 'viewTerms';
  viewList.hidden = true;
  viewList.innerHTML =
    '<div class="page-head">' +
      '<div class="page-crumb"><a href="#/">首页</a><span>/</span>词条总览</div>' +
      '<h1>词条总览 <span class="ph-count" id="tlCount"></span></h1>' +
      '<p class="page-sub">正文里带虚线的词都能点开查看。标灰的是还没有人写过的条目，随时可以补上。</p>' +
    '</div>' +
    '<section class="tcl" id="tlContrib" hidden>' +
      '<div class="tcl-head">' +
        '<h2 class="tcl-title">贡献榜</h2>' +
        '<button class="tcl-more" id="tlContribMore" type="button" hidden>展开全部</button>' +
      '</div>' +
      '<ol class="tcl-list" id="tlContribList"></ol>' +
    '</section>' +
    '<div class="tlist-tools">' +
      '<input class="tlist-search" id="tlSearch" type="search" placeholder="搜索词条…" autocomplete="off">' +
      '<button class="tlist-new" id="tlNew" type="button">＋ 新增词条</button>' +
    '</div>' +
    '<div class="tlist-chips" id="tlChips"></div>' +
    '<div class="tlist-grid" id="tlGrid"></div>' +
    '<p class="tlist-empty" id="tlEmpty" hidden>没有匹配的词条</p>';

  const viewTerm = document.createElement('section');
  viewTerm.className = 'view term-page';
  viewTerm.id = 'viewTerm';
  viewTerm.hidden = true;
  viewTerm.innerHTML =
    '<div class="page-head">' +
      '<div class="page-crumb"><a href="#/">首页</a><span>/</span><a href="#/t">词条</a><span>/</span><b id="tdCrumb"></b></div>' +
    '</div>' +
    '<article class="term-article">' +
      '<header class="td-head">' +
        '<h1 id="tdTitle"></h1>' +
        '<span class="td-cat" id="tdCat"></span>' +
        '<button class="td-edit" id="tdEdit" type="button">编辑释义</button>' +
      '</header>' +
      '<div class="td-body" id="tdBody"></div>' +
      '<div class="td-meta" id="tdMeta"></div>' +
      '<section class="td-sec">' +
        '<h2>出现在这些攻略 <span class="td-n" id="tdRefN"></span></h2>' +
        '<div class="td-refs" id="tdRefs"></div>' +
      '</section>' +
      '<section class="td-sec">' +
        '<h2>相关词条</h2>' +
        '<div class="td-rel" id="tdRel"></div>' +
      '</section>' +
      '<section class="td-sec">' +
        '<h2>编辑记录 <span class="td-n" id="tdHistN"></span></h2>' +
        '<div class="td-hist" id="tdHist"></div>' +
      '</section>' +
    '</article>';

  const host = document.getElementById('viewReader');
  (host ? host.parentNode : document.body).appendChild(viewList);
  (host ? host.parentNode : document.body).appendChild(viewTerm);

  /* ---------- 新增词条弹窗 ---------- */
  const modal = document.createElement('div');
  modal.className = 'tn-modal';
  modal.hidden = true;
  modal.innerHTML =
    '<div class="tn-card" role="dialog" aria-modal="true">' +
      '<div class="tn-head"><b>新增词条</b><button class="tn-x" type="button" aria-label="关闭">✕</button></div>' +
      '<label class="tn-label">词名<span>2–12 字</span></label>' +
      '<input class="tn-name" maxlength="12" placeholder="如：玄铁、周天、禁地" autocomplete="off">' +
      '<label class="tn-label">分类</label>' +
      '<select class="tn-cat">' +
        CAT_ORDER.map(c => '<option value="' + c + '">' + CAT_NAME[c] + '</option>').join('') +
      '</select>' +
      '<label class="tn-label">释义<span>可留空</span></label>' +
      '<textarea class="tn-body" maxlength="8000" rows="5" placeholder="正文，支持 Markdown"></textarea>' +
      '<div class="tn-foot">' +
        '<input class="tn-nick" maxlength="20" placeholder="署名（可留空）">' +
        '<button class="tn-save" type="button">创建词条</button>' +
      '</div>' +
      '<p class="tn-msg"></p>' +
    '</div>';
  document.body.appendChild(modal);
  if (window.WXMD) window.WXMD.attach(modal.querySelector('.tn-body'));
  const tnMsg = modal.querySelector('.tn-msg');

  function openNew(prefill) {
    modal.hidden = false;
    document.body.classList.add('locked');
    tnMsg.textContent = '';
    modal.querySelector('.tn-name').value = prefill || '';
    modal.querySelector('.tn-body').value = '';
    if (modal.querySelector('.tn-body')._wxmd) modal.querySelector('.tn-body')._wxmd.refresh();
    try { modal.querySelector('.tn-nick').value = localStorage.getItem('wx_nick') || ''; } catch (_) {}
    setTimeout(() => modal.querySelector('.tn-name').focus(), 30);
  }
  function closeNew() {
    modal.hidden = true;
    document.body.classList.remove('locked');
  }
  modal.addEventListener('click', e => {
    if (e.target === modal || e.target.closest('.tn-x')) closeNew();
  });

  modal.querySelector('.tn-save').onclick = async () => {
    const btn = modal.querySelector('.tn-save');
    const name = modal.querySelector('.tn-name').value.trim();
    const cat = modal.querySelector('.tn-cat').value;
    const body = modal.querySelector('.tn-body').value.trim();
    const nick = modal.querySelector('.tn-nick').value.trim();
    if (name.length < 2 || name.length > 12) { tnMsg.textContent = '词名需要 2–12 个字'; return; }
    if (/\s/.test(name)) { tnMsg.textContent = '词名里不要带空格'; return; }
    if (!ON) { tnMsg.textContent = '未连接词条服务，暂时不能新建'; return; }

    btn.disabled = true;
    btn.textContent = '创建中…';
    tnMsg.textContent = '';
    try {
      const res = await fetch(BASE + '/rest/v1/rpc/term_create', {
        method: 'POST',
        headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          p_name: name, p_cat: cat, p_nick: nick || '无名侠客', p_body: body,
          p_visitor: (window.WXCloud && window.WXCloud.vid) ? window.WXCloud.vid() : null
        })
      });
      const r = await res.json();
      if (!r || !r.ok) {
        tnMsg.textContent = (r && r.error) || '创建失败';
        btn.disabled = false; btn.textContent = '创建词条';
        return;
      }
      if (nick) { try { localStorage.setItem('wx_nick', nick.slice(0, 20)); } catch (_) {} }
      const mod = T();
      if (mod && mod.addLocal) {
        mod.addLocal({ name: r.name, cat: r.cat, body: body, filled: !!r.filled, editor: r.editor });
      }
      const hit = scan(r.name);
      if (mod && mod.toast) {
        mod.toast(hit.guides.length
          ? '已创建 · 在 ' + hit.guides.length + ' 篇攻略里找到它'
          : '已创建 · 正文里暂时没出现，下回补进去就会自动加下划线');
      }
      closeNew();
      dropContrib();
      location.hash = '#/t/' + encodeURIComponent(r.name);
    } catch (_) {
      tnMsg.textContent = '网络异常，稍后再试';
    } finally {
      btn.disabled = false;
      btn.textContent = '创建词条';
    }
  };

  /* ---------- 总览 ---------- */
  let filter = 'all';
  let query = '';

  function paintChips() {
    const mod = T();
    const list = mod ? mod.list() : [];
    const empty = list.filter(t => !t.filled).length;
    const filled = list.length - empty;
    const chips = [
      { k: 'all', label: '全部' },
      { k: 'empty', label: '待认领' },
      { k: 'filled', label: '已释义' },
      ...CAT_ORDER.map(c => ({ k: 'cat:' + c, label: CAT_NAME[c] }))
    ];
    const countFor = k => {
      if (k === 'all') return list.length;
      if (k === 'empty') return empty;
      if (k === 'filled') return filled;
      const c = k.slice(4);
      return list.filter(t => (t.cat || 'other') === c).length;
    };
    const box = viewList.querySelector('#tlChips');
    box.innerHTML = chips.map(c =>
      '<button class="tl-chip' + (filter === c.k ? ' on' : '') + '" type="button" data-k="' + c.k + '">' +
        esc(c.label) + '<i>' + countFor(c.k) + '</i></button>'
    ).join('');
    box.querySelectorAll('.tl-chip').forEach(b => {
      b.onclick = () => { filter = b.dataset.k; paintChips(); paintGrid(); };
    });
  }

  function match(t) {
    if (filter === 'empty' && t.filled) return false;
    if (filter === 'filled' && !t.filled) return false;
    if (filter.startsWith('cat:') && (t.cat || 'other') !== filter.slice(4)) return false;
    if (query) {
      const q = query.toLowerCase();
      if (!(t.name.toLowerCase().includes(q) || (t.body || '').toLowerCase().includes(q))) return false;
    }
    return true;
  }

  function paintGrid() {
    const mod = T();
    const list = mod ? mod.list() : [];
    const rows = list.filter(match);
    viewList.querySelector('#tlCount').textContent = list.length;
    viewList.querySelector('#tlEmpty').hidden = rows.length > 0;

    viewList.querySelector('#tlGrid').innerHTML = rows.map(t =>
      '<a class="tl-item' + (t.filled ? '' : ' is-empty') + '" href="#/t/' + encodeURIComponent(t.name) + '">' +
        '<b>' + esc(t.name) + '</b>' +
        '<span class="tl-meta">' +
          '<i>' + catName(t.cat) + '</i>' +
          (t.freq ? '<i>' + t.freq + ' 次</i>' : '') +
          (t.filled ? '' : '<i class="tl-tag">待认领</i>') +
        '</span>' +
      '</a>'
    ).join('');
  }

  viewList.querySelector('#tlSearch').addEventListener('input', e => {
    query = e.target.value.trim();
    paintGrid();
  });
  viewList.querySelector('#tlNew').onclick = () => openNew('');

  /* ---------- 贡献榜 ---------- */
  // 口径：同一署名在同一条词目下改多少次都只算 1 条，所以主数字是「条」；
  // 「次」只作副信息，用来看谁改得细。数据来自 term_contributors。
  let contribRows = null, contribAt = 0, contribAll = false;
  // 自己刚写完就作废缓存，回到总览能立刻看到名次变化
  function dropContrib() { contribRows = null; contribAt = 0; }

  async function fetchContrib() {
    if (!ON) return null;
    if (contribRows && Date.now() - contribAt < 20000) return contribRows;
    const payload = { p_limit: 30 };
    try {
      let rows;
      const net = window.WXCloud && window.WXCloud.net;
      if (net) {
        rows = await net.rpc('term_contributors', payload, 12000);
      } else {
        const res = await fetch(BASE + '/rest/v1/rpc/term_contributors', {
          method: 'POST',
          headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        rows = await res.json();
      }
      contribRows = Array.isArray(rows) ? rows : [];
      contribAt = Date.now();
    } catch (_) {
      // 拉不到就整块藏起来，别在总览页挂一条报错
    }
    return contribRows;
  }

  function contribDay(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function paintContrib(rows) {
    const box = viewList.querySelector('#tlContrib');
    const listEl = viewList.querySelector('#tlContribList');
    const more = viewList.querySelector('#tlContribMore');
    if (!box || !listEl) return;
    if (!rows || !rows.length) { box.hidden = true; return; }
    box.hidden = false;
    const show = contribAll ? rows : rows.slice(0, 5);
    // 只有一两个人时比例条撑不出信息量，直接收起
    listEl.classList.toggle('tcl-slim', rows.length < 3);
    const max = Math.max(1, rows[0].terms | 0);
    listEl.innerHTML = show.map((r, i) => {
      const pct = Math.max(6, Math.round((r.terms | 0) / max * 100));
      return '<li class="tcl-row' + (i < 3 ? ' top' : '') + '">' +
        '<span class="tcl-rank">' + pad(i + 1) + '</span>' +
        '<span class="tcl-name">' + esc(r.nick) + '</span>' +
        '<span class="tcl-bar" aria-hidden="true"><i style="width:' + pct + '%"></i></span>' +
        '<span class="tcl-num"><b>' + (r.terms | 0) + '</b> 条</span>' +
        '<span class="tcl-edits" title="累计编辑次数">' + (r.edits | 0) + ' 次</span>' +
        '<span class="tcl-time" title="最近一次编辑">' + contribDay(r.last_at) + '</span>' +
      '</li>';
    }).join('');
    more.hidden = rows.length <= 5;
    more.textContent = contribAll ? '收起' : '展开全部 ' + rows.length;
  }

  viewList.querySelector('#tlContribMore').onclick = () => {
    contribAll = !contribAll;
    paintContrib(contribRows);
  };

  function showList() {
    viewTerm.hidden = true;
    viewList.hidden = false;
    const mod = T();
    const p = mod ? mod.ready() : Promise.resolve();
    p.then(() => { paintChips(); paintGrid(); });
    fetchContrib().then(paintContrib);
    document.title = '词条总览 · 武仙传说';
  }

  /* ---------- 详情 ---------- */
  let curName = '';

  async function showTerm(name) {
    const mod = T();
    if (!mod) return;
    const ready = mod.ready();
    await ready;
    if (curName !== name) window.scrollTo({ top: 0, behavior: 'instant' });
    curName = name;
    viewList.hidden = true;
    viewTerm.hidden = false;

    const t = mod.get(name);
    const title = viewTerm.querySelector('#tdTitle');
    const catEl = viewTerm.querySelector('#tdCat');
    const bodyEl = viewTerm.querySelector('#tdBody');
    const metaEl = viewTerm.querySelector('#tdMeta');
    const refsEl = viewTerm.querySelector('#tdRefs');
    const refN = viewTerm.querySelector('#tdRefN');
    const relEl = viewTerm.querySelector('#tdRel');
    const histEl = viewTerm.querySelector('#tdHist');
    const histN = viewTerm.querySelector('#tdHistN');
    const editBtn = viewTerm.querySelector('#tdEdit');

    viewTerm.querySelector('#tdCrumb').textContent = name;
    title.textContent = name;
    catEl.textContent = catName(t ? t.cat : 'other');
    document.title = name + ' · 词条 · 武仙传说';

    if (!t) {
      bodyEl.innerHTML = '<p class="td-hint">词条库里还没有「' + esc(name) + '」。</p>' +
        '<div class="td-cta"><button class="td-new" type="button">＋ 新建这个词条</button></div>';
      metaEl.textContent = '';
      editBtn.hidden = true;
      const nb = bodyEl.querySelector('.td-new');
      if (nb) nb.onclick = () => openNew(name);
      refsEl.innerHTML = refList(scan(name));
      refN.textContent = '';
      relEl.innerHTML = '';
      histEl.innerHTML = '';
      histN.textContent = '';
      return;
    }

    editBtn.hidden = false;
    editBtn.textContent = t.filled ? '编辑释义' : '我来写第一条';
    bodyEl.innerHTML = t.filled
      ? '<div class="md-view">' + (window.WXMD ? window.WXMD.render(t.body) : t.body.split(/\n+/).map(p => '<p>' + esc(p) + '</p>').join('')) + '</div>'
      : '<p class="td-hint">这条还没有人写。<br>你比下一位玩家更早来到这里 —— 补一句，后面的人就不用猜了。</p>' +
        '<div class="td-cta"><button class="td-edit2" type="button">我来写第一条</button></div>';
    const d2 = bodyEl.querySelector('.td-edit2');
    if (d2) d2.onclick = () => mod.edit(name, () => showTerm(name));

    metaEl.innerHTML = t.filled
      ? (t.editor ? '由 <b>' + esc(t.editor) + '</b> 释义' : '社区释义') +
        (t.updated_at ? ' · ' + dateTxt(t.updated_at) + ' 更新' : '')
      : '';

    editBtn.onclick = () => mod.edit(name, () => { dropContrib(); showTerm(name); });

    // 引用
    const refs = scan(name);
    refsEl.innerHTML = refList(refs);
    refN.textContent = refs.guides.length ? refs.guides.length + ' 篇 / 共 ' + refs.total + ' 处' : '';

    // 相关词条
    const rel = related(name, refs.guides.map(g => g.id));
    relEl.innerHTML = rel.length
      ? rel.map(r => '<a class="td-rel-item" href="#/t/' + encodeURIComponent(r.name) + '">' + esc(r.name) +
          '<i>' + catName((mod.get(r.name) || {}).cat) + '</i></a>').join('')
      : '<span class="td-none">没有足够的共现内容</span>';

    // 历史
    histEl.innerHTML = '<span class="td-none">读取中…</span>';
    histN.textContent = '';
    if (!ON) { histEl.innerHTML = '<span class="td-none">未连接词条服务</span>'; return; }
    try {
      const res = await fetch(BASE + '/rest/v1/rpc/term_history', {
        method: 'POST',
        headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_name: name, p_limit: 20 })
      });
      const rows = await res.json();
      if (!Array.isArray(rows) || !rows.length) {
        histEl.innerHTML = '<span class="td-none">' + (t.filled ? '这条释义由站点初始化导入，还没有玩家编辑过' : '还没有编辑记录') + '</span>';
        return;
      }
      histN.textContent = rows.length + ' 次';
      histEl.innerHTML = rows.map(r =>
        '<div class="td-hist-row">' +
          '<div class="th-top"><b>' + esc(r.nick || '无名侠客') + '</b><time>' + dateTxt(r.created_at) + '</time></div>' +
          '<p>' + esc(window.WXMD ? window.WXMD.plain(r.body, 160) : (r.body || '').slice(0, 160)) + '</p>' +
        '</div>'
      ).join('');
    } catch (_) {
      histEl.innerHTML = '<span class="td-none">读取失败</span>';
    }
  }

  function refList(refs) {
    if (!refs.guides.length) return '<span class="td-none">正文里暂时没有出现</span>';
    return refs.guides.map(g =>
      '<a class="td-ref" href="#/g/' + g.id + '">' +
        '<div class="td-ref-top"><b>' + esc(g.title) + '</b>' +
          '<span class="td-ref-cat">' + gcatName(g.cat) + '</span>' +
          '<span class="td-ref-n">' + g.n + ' 处</span></div>' +
        g.hits.map(h =>
          '<p class="td-ref-s">' + (h.sec ? '<em>' + esc(h.sec) + '</em> ' : '') + h.snippet + '</p>'
        ).join('') +
      '</a>'
    ).join('');
  }

  /* ---------- 路由接口 ---------- */
  function hide() {
    viewList.hidden = true;
    viewTerm.hidden = true;
  }

  window.WXTermPage = {
    show(name) {
      if (name) showTerm(name);
      else showList();
    },
    hide,
    isOpen: () => !viewList.hidden || !viewTerm.hidden,
    openNew
  };

  // Esc 返回总览 / 首页
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!modal.hidden) { closeNew(); return; }
    if (!viewTerm.hidden) { location.hash = '#/t'; return; }
    if (!viewList.hidden) { location.hash = '#/'; return; }
  });
})();
