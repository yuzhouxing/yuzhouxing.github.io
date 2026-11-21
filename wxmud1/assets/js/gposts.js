/* ============================================================
   玩家投稿：攻略提交面板
   ------------------------------------------------------------
   · 只有三个字段：标题、分类、正文（Markdown + 配图）
   · 正文编辑器复用 md.js（工具栏 / 预览 / 图片压缩上传）
   · 草稿存在本机，误关面板不丢；发布成功直接跳到详情
   · 写入只走 guide_post_* 这套 RPC，浏览器碰不到基表
   ============================================================ */
(function () {
  'use strict';

  const CFG = window.WX_SUPABASE || {};
  const BASE = String(CFG.url || '').replace(/\/+$/, '');
  const KEY = String(CFG.key || '');
  const ON = /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(BASE) && KEY.length > 20;

  const DRAFT = 'wx_post_draft_v1';
  const CATS = [
    ['start', '新手开荒'],
    ['dungeon', '副本禁地'],
    ['sect', '武学门派'],
    ['mech', '机制数值'],
    ['craft', '装备炼制'],
    ['alchemy', '丹药符箓']
  ];

  let modal = null, mdApi = null, cat = 'start', busy = false;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function vid() {
    if (window.WXCloud && window.WXCloud.vid) return window.WXCloud.vid();
    try { return localStorage.getItem('wx_vid') || null; } catch (_) { return null; }
  }

  /* ---------- 接口 ---------- */
  function rpc(fn, payload, timeout, retry) {
    if (!window.WXCloud || !window.WXCloud.net) return Promise.reject(new Error('未连接云端'));
    return window.WXCloud.net.rpc(fn, payload, timeout, retry);
  }

  function list() {
    if (!ON) return Promise.resolve([]);
    return rpc('guide_post_list', { p_visitor: vid(), p_limit: 200 }, 12000)
      .then(rows => (Array.isArray(rows) ? rows : []))
      .catch(() => []);
  }

  function create(o) {
    // 发布不是幂等操作，失败不重试，避免同一篇发两遍
    return rpc('guide_post_create', {
      p_title: String(o.title || '').trim(),
      p_body: String(o.body || '').trim(),
      p_cat: o.cat || 'start',
      p_visitor: vid()
    }, 25000, false).then(r => {
      if (!r || !r.ok) throw new Error((r && r.error) || '发布失败');
      return r;
    });
  }

  function del(id) {
    return rpc('guide_post_del', { p_id: id, p_visitor: vid() }, 20000, false).then(r => {
      if (!r || !r.ok) throw new Error((r && r.error) || '撤回失败');
      return r;
    });
  }

  /* ---------- 草稿 ---------- */
  function readDraft() {
    try {
      const o = JSON.parse(localStorage.getItem(DRAFT) || 'null');
      if (o && typeof o === 'object') return { t: o.t || '', c: o.c || '', b: o.b || '' };
    } catch (_) {}
    return null;
  }
  function saveDraft(o) {
    try { localStorage.setItem(DRAFT, JSON.stringify(o)); } catch (_) {}
  }
  function dropDraft() {
    try { localStorage.removeItem(DRAFT); } catch (_) {}
  }

  function toast(text) {
    if (window.WX_TERMS && window.WX_TERMS.toast) { window.WX_TERMS.toast(text); return; }
    let el = document.querySelector('.term-toast');
    if (!el) { el = document.createElement('div'); el.className = 'term-toast'; document.body.appendChild(el); }
    el.textContent = text;
    el.classList.add('on');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('on'), 2000);
  }

  /* ---------- 面板 ---------- */
  function build() {
    modal = document.createElement('div');
    modal.className = 'term-modal gpost';
    modal.hidden = true;
    modal.innerHTML =
      '<div class="gpost-card" role="dialog" aria-modal="true" aria-label="提交攻略">' +
        '<div class="tm-head">' +
          '<b class="tm-title">提交攻略</b>' +
          '<button class="tm-x" type="button" aria-label="关闭">✕</button>' +
        '</div>' +
        '<p class="gpost-sub">发布后出现在「攻略大全 · 玩家投稿」，本机可以撤回。</p>' +
        '<input class="gpost-title" type="text" maxlength="60" autocomplete="off" spellcheck="false"' +
          ' placeholder="标题：一句话说清这篇讲什么，例如「百草渊 · 采药路线速通」">' +
        '<div class="gpost-cats" role="radiogroup" aria-label="分类"></div>' +
        '<textarea class="gpost-body" maxlength="20000" rows="14" spellcheck="false"' +
          ' placeholder="正文，支持 Markdown：## 小标题、- 列表、**加粗**、```代码```；图片直接粘贴或拖进来"></textarea>' +
        '<div class="gpost-row">' +
          '<span class="gpost-tip"></span>' +
          '<span class="gpost-len">0 字</span>' +
          '<button class="tm-save gpost-send" type="button">发布</button>' +
        '</div>' +
        '<p class="gpost-fine">图片会自动压到长边 1600 再上传，单张不超过 2MB。请只发自己写的内容，转载注明出处。</p>' +
      '</div>';
    document.body.appendChild(modal);

    const cats = modal.querySelector('.gpost-cats');
    cats.innerHTML = CATS.map(([id, name]) =>
      '<button class="gc-btn" type="button" data-cat="' + id + '" role="radio" aria-checked="false">' + esc(name) + '</button>'
    ).join('');
    cats.addEventListener('click', e => {
      const b = e.target.closest('.gc-btn');
      if (!b) return;
      setCat(b.dataset.cat);
      dirty();
    });

    modal.addEventListener('click', e => {
      if (e.target === modal || e.target.closest('.tm-x')) close();
    });

    const ta = modal.querySelector('.gpost-body');
    if (window.WXMD) mdApi = window.WXMD.attach(ta, { prefix: 'guide' });

    const title = modal.querySelector('.gpost-title');
    title.addEventListener('input', dirty);
    ta.addEventListener('input', () => { dirty(); paintLen(); });

    modal.querySelector('.gpost-send').addEventListener('click', submit);

    return modal;
  }

  // 面板开着时在 document 上收键盘：Esc 关闭、⌘/Ctrl+Enter 发布。
  // 挂在 document 上是因为焦点可能还在触发按钮上（刚点开的那一瞬间）。
  function onKey(e) {
    if (!modal || modal.hidden) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  }

  function setCat(id) {
    cat = CATS.some(c => c[0] === id) ? id : 'start';
    modal.querySelectorAll('.gc-btn').forEach(b => {
      const on = b.dataset.cat === cat;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
  }

  function paintLen() {
    const ta = modal.querySelector('.gpost-body');
    const n = ta.value.replace(/\s+/g, '').length;
    modal.querySelector('.gpost-len').textContent = n + ' 字';
  }

  let dtimer = null;
  function flushDraft() {
    if (!modal) return;
    const t = modal.querySelector('.gpost-title').value;
    const b = modal.querySelector('.gpost-body').value;
    if (!t.trim() && !b.trim()) { dropDraft(); return; }
    saveDraft({ t, c: cat, b });
  }
  function dirty() {
    clearTimeout(dtimer);
    dtimer = setTimeout(() => {
      saveDraft({
        t: modal.querySelector('.gpost-title').value,
        c: cat,
        b: modal.querySelector('.gpost-body').value
      });
    }, 400);
  }

  function say(msg) {
    const t = modal.querySelector('.gpost-tip');
    t.textContent = msg || '';
    t.classList.toggle('on', !!msg);
  }

  function open(opts) {
    if (!modal) build();
    opts = opts || {};
    const d = readDraft();
    const title = modal.querySelector('.gpost-title');
    const ta = modal.querySelector('.gpost-body');

    if (d && (d.t.trim() || d.b.trim())) {
      title.value = d.t;
      ta.value = d.b;
      setCat(d.c || 'start');
      say('已恢复上次没写完的草稿');
    } else {
      title.value = '';
      ta.value = '';
      setCat(opts.cat || 'start');
      say('');
    }
    if (mdApi) { mdApi.refresh(); mdApi.preview(false); }
    paintLen();
    modal.hidden = false;
    document.body.classList.add('locked');
    document.addEventListener('keydown', onKey, true);
    setTimeout(() => {
      title.focus();
      title.setSelectionRange(title.value.length, title.value.length);
    }, 40);
  }

  // skipDraft：发布成功后关闭，不要把刚发出去的内容又存成草稿
  function close(skipDraft) {
    if (!modal || modal.hidden) return;
    clearTimeout(dtimer);
    if (!skipDraft) flushDraft();
    modal.hidden = true;
    document.removeEventListener('keydown', onKey, true);
    document.body.classList.remove('locked');
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }

  function submit() {
    if (busy || !modal) return;
    const title = modal.querySelector('.gpost-title').value.trim();
    const body = modal.querySelector('.gpost-body').value.trim();
    const btn = modal.querySelector('.gpost-send');

    if (title.length < 2) { say('标题至少两个字'); modal.querySelector('.gpost-title').focus(); return; }
    if (body.length < 20) { say('正文太短，至少 20 个字'); modal.querySelector('.gpost-body').focus(); return; }
    if (!ON) { say('未连接云端，暂时发不了'); return; }

    busy = true;
    btn.disabled = true;
    btn.textContent = '发布中…';
    say('');

    create({ title, body, cat }).then(r => {
      dropDraft();
      toast('已发布');
      close(true);
      const post = {
        id: r.id, title: r.title || title, cat: r.cat || cat,
        body: r.body || body, created_at: new Date().toISOString(), mine: true
      };
      if (typeof window.WXPost.onCreated === 'function') window.WXPost.onCreated(post);
      else location.hash = '#/list';
    }).catch(e => {
      say((e && e.message) || '发布失败，稍后再试');
    }).then(() => {
      busy = false;
      btn.disabled = false;
      btn.textContent = '发布';
    });
  }

  window.WXPost = {
    on: ON,
    list,
    create,
    del,
    open,
    close,
    toast,
    CATS,
    onCreated: null
  };
})();
