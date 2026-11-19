/* ============================================================
   武仙传说 · 攻略总集
   互动数据层：点赞 / 浏览量 / 评论
   ------------------------------------------------------------
   · 配了 Supabase 就走云端；没配、超时、被墙、报错一律静默降级到本地
   · 不依赖 supabase-js，直接打 PostgREST，整包 4 KB 左右
   ============================================================ */
(function () {
  'use strict';

  const CFG = window.WX_SUPABASE || {};
  const BASE = String(CFG.url || '').replace(/\/+$/, '');
  const KEY = String(CFG.key || '');
  const HAS_CLOUD = /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(BASE) && KEY.length > 20;

  const VID_KEY = 'wx_vid';
  const LOCAL_KEY = 'wx_local_v1';

  /* ---------- 访客标识 ---------- */
  let cachedVid = null;
  function vid() {
    if (cachedVid) return cachedVid;
    let v = null;
    try { v = localStorage.getItem(VID_KEY); } catch (_) {}
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v || '')) {
      v = newUUID();
      try { localStorage.setItem(VID_KEY, v); } catch (_) {}
    }
    cachedVid = v;
    return v;
  }
  function newUUID() {
    if (window.crypto && crypto.randomUUID) {
      try { return crypto.randomUUID(); } catch (_) {}
    }
    const b = new Uint8Array(16);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(b);
    else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }

  /* ---------- 本地兜底存储 ---------- */
  function readLocal() {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      const o = raw ? JSON.parse(raw) : null;
      if (o && typeof o === 'object') return { likes: o.likes || {}, views: o.views || {}, liked: o.liked || {}, comments: o.comments || {}, seen: o.seen || {} };
    } catch (_) {}
    return { likes: {}, views: {}, liked: {}, comments: {}, seen: {} };
  }
  function writeLocal(o) {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(o)); } catch (_) {}
  }

  /* ---------- HTTP ---------- */
  function headers(extra) {
    return Object.assign({
      apikey: KEY,
      Authorization: 'Bearer ' + KEY,
      Accept: 'application/json'
    }, extra || {});
  }

  async function request(url, opts, timeout) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeout || 6000);
    try {
      const res = await fetch(url, Object.assign({}, opts, { signal: ctl.signal }));
      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch (_) {}
      if (!res.ok) {
        const msg = (data && (data.message || data.hint || data.error_description || data.error)) || ('HTTP ' + res.status);
        const err = new Error(String(msg));
        err.status = res.status;
        throw err;
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  const rest = path => request(BASE + '/rest/v1/' + path, { headers: headers() });
  const rpc = (fn, payload) => request(BASE + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload)
  });

  /* ---------- 状态 ---------- */
  let degraded = false;   // 云端可用但本次失败
  let lastError = '';
  const listeners = new Set();

  function emit() { listeners.forEach(fn => { try { fn(snapshot); } catch (_) {} }); }
  let snapshot = { mode: HAS_CLOUD ? 'cloud' : 'local', degraded: false, map: {} };

  /* ---------- 聚合计数 ---------- */
  async function stats() {
    if (HAS_CLOUD) {
      try {
        const rows = await rest('guide_stats?select=guide_id,likes,views');
        const map = {};
        (Array.isArray(rows) ? rows : []).forEach(r => {
          map[r.guide_id] = { likes: r.likes | 0, views: r.views | 0 };
        });
        degraded = false;
        snapshot = { mode: 'cloud', degraded: false, map };
        return snapshot;
      } catch (e) {
        degraded = true;
        lastError = e.message;
      }
    }
    const lo = readLocal();
    const map = {};
    Object.keys(lo.likes).forEach(id => { map[id] = { likes: lo.likes[id] | 0, views: lo.views[id] | 0 }; });
    Object.keys(lo.views).forEach(id => { if (!map[id]) map[id] = { likes: 0, views: lo.views[id] | 0 }; });
    snapshot = { mode: 'local', degraded, map };
    return snapshot;
  }

  function currentMap() { return snapshot.map || {}; }
  function get(id) { return currentMap()[id] || { likes: 0, views: 0 }; }
  function liked(id) { return !!readLocal().liked[id]; }

  /* ---------- 点赞 ---------- */
  async function toggleLike(id) {
    if (HAS_CLOUD) {
      try {
        const rows = await rpc('guide_toggle_like', { p_guide: id, p_visitor: vid() });
        const row = Array.isArray(rows) ? rows[0] : rows;
        if (row && typeof row.likes === 'number') {
          const m = Object.assign({}, currentMap());
          m[id] = { likes: row.likes, views: (m[id] && m[id].views) || 0 };
          snapshot = Object.assign({}, snapshot, { map: m });
          const lo = readLocal();
          lo.liked[id] = !!row.liked;
          writeLocal(lo);
          emit();
          return { ok: true, likes: row.likes, liked: !!row.liked, mode: 'cloud' };
        }
      } catch (e) {
        lastError = e.message;
      }
    }
    // 本地兜底
    const lo = readLocal();
    const on = !lo.liked[id];
    lo.liked[id] = on;
    lo.likes[id] = Math.max(0, (lo.likes[id] | 0) + (on ? 1 : -1));
    writeLocal(lo);
    const m = Object.assign({}, currentMap());
    m[id] = { likes: lo.likes[id], views: (m[id] && m[id].views) || lo.views[id] | 0 };
    snapshot = Object.assign({}, snapshot, { map: m });
    emit();
    return { ok: true, likes: lo.likes[id], liked: on, mode: 'local' };
  }

  /* ---------- 浏览 ---------- */
  async function hit(id) {
    if (HAS_CLOUD) {
      try {
        const v = await rpc('guide_hit', { p_guide: id, p_visitor: vid() });
        if (typeof v === 'number') {
          const m = Object.assign({}, currentMap());
          m[id] = { likes: (m[id] && m[id].likes) || 0, views: v };
          snapshot = Object.assign({}, snapshot, { map: m });
          emit();
          return v;
        }
      } catch (_) {}
    }
    const lo = readLocal();
    const day = new Date().toISOString().slice(0, 10);
    const mark = id + '@' + day;
    if (!lo.seen[mark]) {
      lo.seen[mark] = 1;
      lo.views[id] = (lo.views[id] | 0) + 1;
      writeLocal(lo);
    }
    const m = Object.assign({}, currentMap());
    m[id] = { likes: (m[id] && m[id].likes) || 0, views: lo.views[id] | 0 };
    snapshot = Object.assign({}, snapshot, { map: m });
    emit();
    return lo.views[id] | 0;
  }

  /* ---------- 评论 ---------- */
  async function comments(id) {
    if (HAS_CLOUD) {
      try {
        const rows = await rpc('guide_list_comments', {
          p_guide: id, p_visitor: vid(), p_limit: 100
        });
        if (Array.isArray(rows)) {
          return {
            mode: 'cloud',
            list: rows.map(r => ({
              id: r.id, nick: r.nick, body: r.body, created_at: r.created_at,
              mine: !!r.mine
            }))
          };
        }
      } catch (e) { lastError = e.message; }
    }
    const lo = readLocal();
    return { mode: 'local', list: (lo.comments[id] || []).slice().reverse() };
  }

  async function addComment(id, nick, body) {
    if (HAS_CLOUD) {
      try {
        const row = await rpc('guide_add_comment', {
          p_guide: id, p_visitor: vid(), p_nick: nick || '', p_body: body
        });
        const r = Array.isArray(row) ? row[0] : row;
        if (r && r.id) {
          return { ok: true, mode: 'cloud', comment: { id: r.id, nick: r.nick, body: r.body, created_at: r.created_at, mine: true } };
        }
      } catch (e) {
        // 云端明确拒绝（太快 / 太长）要如实报给用户，不要偷偷存本地
        if (e.status && e.status >= 400 && e.status < 500) {
          return { ok: false, error: e.message, mode: 'cloud' };
        }
        lastError = e.message;
      }
    }
    const lo = readLocal();
    const list = lo.comments[id] || (lo.comments[id] = []);
    const c = {
      id: 'l' + Date.now(), nick: (nick || '').trim().slice(0, 20) || '无名侠客',
      body: body.trim(), created_at: new Date().toISOString(), mine: true
    };
    list.push(c);
    writeLocal(lo);
    return { ok: true, mode: 'local', comment: c };
  }

  async function delComment(id, cid) {
    if (HAS_CLOUD && typeof cid === 'number') {
      try {
        const ok = await rpc('guide_del_comment', { p_id: cid, p_visitor: vid() });
        return { ok: !!ok, mode: 'cloud' };
      } catch (e) { lastError = e.message; }
    }
    const lo = readLocal();
    lo.comments[id] = (lo.comments[id] || []).filter(c => String(c.id) !== String(cid));
    writeLocal(lo);
    return { ok: true, mode: 'local' };
  }

  window.WXCloud = {
    hasCloud: HAS_CLOUD,
    mode: () => snapshot.mode,
    degraded: () => degraded,
    lastError: () => lastError,
    vid,
    stats,
    get,
    liked,
    toggleLike,
    hit,
    comments,
    addComment,
    delComment,
    onChange: fn => { listeners.add(fn); return () => listeners.delete(fn); },
    snapshot: () => snapshot
  };
})();
