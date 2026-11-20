/* ============================================================
   武仙传说 · 攻略总集
   互动数据层：点赞 / 浏览量 / 评论
   ------------------------------------------------------------
   · 配了 Supabase 就走云端；没配就走本地
   · 云端请求失败时：写入进队列（不只是本地计数），恢复后自动补传
   · 状态对外可见：offline 时界面显示「—」而不是假 0
   · 不依赖 supabase-js，直接打 PostgREST
   ============================================================ */
(function () {
  'use strict';

  const CFG = window.WX_SUPABASE || {};
  const BASE = String(CFG.url || '').replace(/\/+$/, '');
  const KEY = String(CFG.key || '');
  const HAS_CLOUD = /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(BASE) && KEY.length > 20;

  const VID_KEY = 'wx_vid';
  const LOCAL_KEY = 'wx_local_v1';
  const QUEUE_KEY = 'wx_queue_v1';

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
    if (window.crypto && window.crypto.getRandomValues) crypto.getRandomValues(b);
    else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }

  /* ---------- 本地存储 ---------- */
  function readLocal() {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      const o = raw ? JSON.parse(raw) : null;
      if (o && typeof o === 'object') {
        return {
          likes: o.likes || {}, views: o.views || {}, liked: o.liked || {},
          comments: o.comments || {}, seen: o.seen || {}
        };
      }
    } catch (_) {}
    return { likes: {}, views: {}, liked: {}, comments: {}, seen: {} };
  }
  function writeLocal(o) {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(o)); } catch (_) {}
  }

  /* ---------- 待同步队列 ---------- */
  // 只在云端请求失败时入队，成功后立刻出队。
  // 点赞存的是「目标状态」而不是 toggle，所以重放不会把赞抵消。
  function readQueue() {
    try {
      const a = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
      return Array.isArray(a) ? a : [];
    } catch (_) { return []; }
  }
  function writeQueue(a) {
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(a.slice(-200))); } catch (_) {}
  }
  function queueKey(x) {
    return x.k + ':' + x.id + (x.k === 'view' ? '@' + (x.day || '') : '');
  }
  function enqueue(item) {
    if (item.k === 'view') item.day = new Date().toISOString().slice(0, 10);
    const q = readQueue();
    // 同一篇的点赞只留最新一条；浏览量按天去重
    const key = queueKey(item);
    const kept = q.filter(x => queueKey(x) !== key);
    kept.push(item);
    writeQueue(kept);
    emit();
  }
  function queueLen() { return readQueue().length; }

  /* ---------- HTTP ----------
     国内访问 *.supabase.co 常见「握手卡住几秒」「偶发超时」，
     一次失败就判定断线会让整页数字变「—」，所以这里做三层：
       1) 单次请求 12 秒超时（原来 6 秒，冷启动握手经常不够）
       2) 网络类失败按 0.5s / 1.5s 退避重试，最多 3 次
       3) 仍然失败才置为离线，并交给后台重连循环继续试
     只有幂等请求才重试：读取、点赞（set 语义）、浏览（按天去重）。
     发评论这类非幂等写入只打一次，避免重复楼层。 */
  function headers(extra) {
    return Object.assign({
      apikey: KEY,
      Authorization: 'Bearer ' + KEY,
      Accept: 'application/json'
    }, extra || {});
  }
  const now = () => ((window.performance && performance.now) ? performance.now() : Date.now());
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const READ_TIMEOUT = 12000;
  const RETRY_GAP = [500, 1500];

  function isRetryable(e) {
    if (!e) return false;
    if (e.name === 'AbortError') return true;                 // 超时
    if (e.network) return true;                               // 断网 / TLS / CORS
    return e.status === 408 || e.status === 425 || e.status === 429 || e.status >= 500;
  }

  async function once(url, opts, timeout) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeout || READ_TIMEOUT);
    const t0 = now();
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
    } catch (e) {
      if (!e.status) e.network = true;      // 没拿到 HTTP 状态 = 网络层失败
      e.ms = Math.round(now() - t0);
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  async function request(url, opts, timeout, retry) {
    const tries = retry === false ? 1 : 3;
    const budget = 20000;                       // 总预算：三次重试最多占 20 秒
    const deadline = Date.now() + budget;
    let err;
    for (let i = 0; i < tries; i++) {
      const left = deadline - Date.now();
      if (left < 1200) break;                   // 剩得太少就别再试了
      try {
        return await once(url, opts, Math.min(timeout || READ_TIMEOUT, left));
      } catch (e) {
        err = e;
        if (i >= tries - 1 || !isRetryable(e)) break;
        await sleep(RETRY_GAP[Math.min(i, RETRY_GAP.length - 1)] + Math.round(Math.random() * 300));
      }
    }
    throw err || new Error('request aborted');
  }

  const rest = (path, opts, timeout, retry) => request(BASE + '/rest/v1/' + path,
    Object.assign({ headers: headers() }, opts || {}), timeout, retry);
  const rpc = (fn, payload, timeout, retry) => request(BASE + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload)
  }, timeout, retry);

  /* ---------- 状态 ---------- */
  let degraded = false;         // 配了云端，但最近一次请求失败
  let lastError = '';
  const listeners = new Set();

  function emit() { listeners.forEach(fn => { try { fn(snapshot); } catch (_) {} }); }
  let snapshot = { mode: HAS_CLOUD ? 'cloud' : 'local', degraded: false, stale: false, map: {}, pending: 0 };

  function setSnap(mode, map, extra) {
    snapshot = Object.assign({
      mode, degraded: mode === 'offline', stale: false, cachedAt: 0,
      map: map || {}, pending: queueLen()
    }, extra || {});
    emit();
  }

  function describe(e) {
    if (!e) return '未知错误';
    if (e.network) {
      const n = e.name === 'AbortError' ? '请求超时' : '网络不通';
      return n + (e.message && e.message !== 'Failed to fetch' ? '（' + e.message + '）' : '');
    }
    return (e.status ? 'HTTP ' + e.status + '：' : '') + e.message;
  }

  /* ---------- 聚合计数 ---------- */
  // 评论条数：guide_comments 对匿名只开放非敏感列，拉 guide_id 在本地数一遍。
  // 属于「锦上添花」，超时就放弃，不拖累点赞/浏览的展示。
  async function commentCounts() {
    const rows = await rest('guide_comments?select=guide_id&deleted=eq.false&limit=5000', null, 8000, false);
    const out = {};
    (Array.isArray(rows) ? rows : []).forEach(r => { out[r.guide_id] = (out[r.guide_id] | 0) + 1; });
    return out;
  }

  /* ---------- 上次成功的数字 ----------
     网络抖动时先把上一轮真实数字摆出来（标明是缓存），
     比整页「—」更接近事实，也不会把 0 当默认值。 */
  const CACHE_KEY = 'wx_stats_cache_v1';
  function readCache() {
    try {
      const o = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (o && o.t && o.map && typeof o.map === 'object') return o;
    } catch (_) {}
    return null;
  }
  function writeCache(map) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), map })); } catch (_) {}
  }
  // 单条更新缓存，避免刚点的赞/刚看的文章在下次断线时被旧值盖回去
  function patchCache(id, patch) {
    const c = readCache();
    if (!c) return;
    setStat(c.map, id, patch);
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch (_) {}
  }

  function setStat(m, id, patch) {
    m[id] = Object.assign({ likes: 0, views: 0, comments: 0 }, m[id] || {}, patch);
    return m[id];
  }

  // 发/删评论后马上改首页卡片上的数字，不用等下一次全量拉取
  function bumpComments(id, delta) {
    if (!snapshot.map || !snapshot.map[id]) return;
    const m = Object.assign({}, snapshot.map);
    setStat(m, id, { comments: Math.max(0, ((m[id] && m[id].comments) | 0) + (delta || 0)) });
    patchCache(id, { comments: m[id].comments });
    snapshot = Object.assign({}, snapshot, { map: m });
    emit();
  }

  let statsPromise = null;
  // 同一时刻只允许一次全量拉取：切页、重连、自愈可能同时触发，别互相叠加
  function stats(opts) {
    if (statsPromise) return statsPromise;
    statsPromise = pullStats(opts).catch(e => {
      degraded = true;
      lastError = describe(e);
      return snapshot;
    }).then(s => {
      statsPromise = null;
      return s;
    });
    return statsPromise;
  }

  async function pullStats(opts) {
    const o = opts || {};
    const timeout = o.timeout || READ_TIMEOUT;
    if (HAS_CLOUD) {
      // 两个读并行：总耗时取决于慢的那个，而不是两者相加
      const settled = await Promise.allSettled([
        rest('guide_stats?select=guide_id,likes,views', null, timeout, o.retry),
        commentCounts()
      ]);
      const main = settled[0];
      const extra = settled[1];
      if (main.status === 'fulfilled') {
        const map = {};
        (Array.isArray(main.value) ? main.value : []).forEach(r => {
          map[r.guide_id] = { likes: r.likes | 0, views: r.views | 0, comments: 0 };
        });
        if (extra.status === 'fulfilled') {
          Object.keys(extra.value).forEach(id => { setStat(map, id, { comments: extra.value[id] }); });
        }
        degraded = false;
        lastError = '';
        writeCache(map);
        setSnap('cloud', map);
        if (queueLen()) flushQueue();   // 顺手把积压补传掉
        return snapshot;
      }
      degraded = true;
      lastError = describe(main.reason);
      const c = readCache();
      if (c) {
        // 有上次的真实数字：先展示，标记为缓存，后台继续重连
        setSnap('cloud', c.map, { stale: true, cachedAt: c.t });
      } else {
        setSnap('offline', {});
      }
      if (!o.quiet) scheduleRecovery();
      return snapshot;
    }
    const lo = readLocal();
    const map = {};
    Object.keys(lo.likes).forEach(id => { map[id] = { likes: lo.likes[id] | 0, views: lo.views[id] | 0, comments: (lo.comments[id] || []).length }; });
    Object.keys(lo.views).forEach(id => { if (!map[id]) map[id] = { likes: 0, views: lo.views[id] | 0, comments: (lo.comments[id] || []).length }; });
    setSnap('local', map);
    return snapshot;
  }

  function currentMap() { return snapshot.map || {}; }
  function get(id) { return currentMap()[id] || { likes: 0, views: 0, comments: 0 }; }
  function liked(id) { return !!readLocal().liked[id]; }

  /* ---------- 队列补传 ---------- */
  let flushing = false;
  async function flushQueue() {
    if (!HAS_CLOUD || flushing) return { sent: 0, left: queueLen() };
    flushing = true;
    let sent = 0;
    let q = readQueue();
    try {
      while (q.length) {
        const item = q[0];
        try {
          if (item.k === 'like') {
            await rpc('guide_like_set', { p_guide: item.id, p_visitor: vid(), p_on: !!item.on }, 15000, false);
          } else if (item.k === 'view') {
            await rpc('guide_hit', { p_guide: item.id, p_visitor: vid() }, 15000, false);
          } else if (item.k === 'comment') {
            await rpc('guide_add_comment', { p_guide: item.id, p_visitor: vid(), p_nick: item.nick || '', p_body: item.body }, 15000, false);
          }
          sent++;
        } catch (e) {
          // 4xx 说明服务端明确拒绝（太长、太快、参数非法），留着也没用
          if (e.status && e.status >= 400 && e.status < 500 && e.status !== 429) {
            sent++;
          } else {
            lastError = describe(e);
            degraded = true;
            break;
          }
        }
        q.shift();
        writeQueue(q);
      }
      if (!q.length) degraded = false;
      snapshot = Object.assign({}, snapshot, { pending: queueLen() });
      emit();
    } finally {
      flushing = false;
    }
    return { sent, left: queueLen() };
  }

  /* ---------- 点赞 ---------- */
  async function toggleLike(id) {
    const want = !readLocal().liked[id];
    if (HAS_CLOUD) {
      try {
        // 用 set 语义而不是 toggle：请求超时后重试是幂等的，不会点一次变两次
        const rows = await rpc('guide_like_set', { p_guide: id, p_visitor: vid(), p_on: want }, 15000);
        const row = Array.isArray(rows) ? rows[0] : rows;
        if (row && typeof row.likes === 'number') {
          const m = Object.assign({}, currentMap());
          setStat(m, id, { likes: row.likes });
          const lo = readLocal();
          lo.liked[id] = !!row.liked;
          writeLocal(lo);
          degraded = false;
          patchCache(id, { likes: row.likes });
          snapshot = Object.assign({}, snapshot, { mode: 'cloud', degraded: false, stale: false, map: m, pending: queueLen() });
          emit();
          return { ok: true, likes: row.likes, liked: !!row.liked, mode: 'cloud' };
        }
      } catch (e) {
        lastError = describe(e);
        // 服务端明确拒绝就别假装成功
        if (e.status && e.status >= 400 && e.status < 500 && e.status !== 429) {
          return { ok: false, error: lastError, mode: 'cloud' };
        }
        degraded = true;
      }
    }
    // 离线：本地先记一笔给即时反馈，同时排队等网络恢复
    const lo = readLocal();
    lo.liked[id] = want;
    lo.likes[id] = Math.max(0, (lo.likes[id] | 0) + (want ? 1 : -1));
    writeLocal(lo);
    if (HAS_CLOUD) enqueue({ k: 'like', id, on: want, ts: Date.now() });
    const m = Object.assign({}, currentMap());
    setStat(m, id, { likes: lo.likes[id], views: (m[id] && m[id].views) || lo.views[id] | 0 });
    snapshot = Object.assign({}, snapshot, { map: m, pending: queueLen() });
    emit();
    return { ok: true, likes: lo.likes[id], liked: want, mode: HAS_CLOUD ? 'pending' : 'local', pending: HAS_CLOUD };
  }

  /* ---------- 浏览 ---------- */
  async function hit(id) {
    if (HAS_CLOUD) {
      try {
        const v = await rpc('guide_hit', { p_guide: id, p_visitor: vid() });
        if (typeof v === 'number') {
          const m = Object.assign({}, currentMap());
          setStat(m, id, { views: v });
          patchCache(id, { views: v });
          snapshot = Object.assign({}, snapshot, { mode: 'cloud', stale: false, map: m, pending: queueLen() });
          emit();
          return v;
        }
      } catch (e) {
        lastError = describe(e);
        enqueue({ k: 'view', id, ts: Date.now() });
      }
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
    setStat(m, id, { views: lo.views[id] | 0 });
    snapshot = Object.assign({}, snapshot, { map: m, pending: queueLen() });
    emit();
    return lo.views[id] | 0;
  }

  /* ---------- 评论 ---------- */
  async function comments(id) {
    if (HAS_CLOUD) {
      try {
        const rows = await rpc('guide_list_comments', {
          p_guide: id, p_visitor: vid(), p_limit: 100
        }, 12000);
        if (Array.isArray(rows)) {
          return {
            mode: 'cloud',
            list: rows.map(r => ({
              id: r.id, nick: r.nick, body: r.body, created_at: r.created_at,
              mine: !!r.mine
            }))
          };
        }
      } catch (e) { lastError = describe(e); }
    }
    const lo = readLocal();
    return { mode: HAS_CLOUD ? 'offline' : 'local', list: (lo.comments[id] || []).slice().reverse() };
  }

  async function addComment(id, nick, body) {
    if (HAS_CLOUD) {
      try {
        const row = await rpc('guide_add_comment', {
          p_guide: id, p_visitor: vid(), p_nick: nick || '', p_body: body
        }, 18000, false);   // 非幂等：只打一次，宁可提示失败也不要重复楼层
        const r = Array.isArray(row) ? row[0] : row;
        if (r && r.id) {
          bumpComments(id, 1);
          return { ok: true, mode: 'cloud', comment: { id: r.id, nick: r.nick, body: r.body, created_at: r.created_at, mine: true } };
        }
      } catch (e) {
        // 云端明确拒绝（太快 / 太长）要如实报给用户，不要偷偷存本地
        if (e.status && e.status >= 400 && e.status < 500 && e.status !== 429) {
          return { ok: false, error: e.message, mode: 'cloud' };
        }
        lastError = describe(e);
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
    if (HAS_CLOUD) enqueue({ k: 'comment', id, nick: c.nick, body: c.body, ts: Date.now() });
    return { ok: true, mode: HAS_CLOUD ? 'pending' : 'local', comment: c };
  }

  async function delComment(id, cid) {
    if (HAS_CLOUD && typeof cid === 'number') {
      try {
        const ok = await rpc('guide_del_comment', { p_id: cid, p_visitor: vid() }, 15000, false);
        if (ok) bumpComments(id, -1);
        return { ok: !!ok, mode: 'cloud' };
      } catch (e) { lastError = describe(e); }
    }
    const lo = readLocal();
    lo.comments[id] = (lo.comments[id] || []).filter(c => String(c.id) !== String(cid));
    writeLocal(lo);
    return { ok: true, mode: HAS_CLOUD ? 'pending' : 'local' };
  }

  /* ---------- 自检：读一次、写一次，返回每跳耗时与错误原文 ---------- */
  async function probe() {
    const out = {
      configured: HAS_CLOUD, base: BASE, keyTail: KEY ? KEY.slice(-6) : '',
      vid: vid(), online: navigator.onLine !== false, steps: []
    };
    if (!HAS_CLOUD) { out.verdict = '未配置云端，数据只存本机'; return out; }

    let t0 = now();
    try {
      const rows = await rest('guide_stats?select=guide_id,likes,views');
      out.steps.push({ name: '读取统计 GET /guide_stats', ok: true, ms: Math.round(now() - t0), detail: '返回 ' + (Array.isArray(rows) ? rows.length : 0) + ' 行' });
    } catch (e) {
      out.steps.push({ name: '读取统计 GET /guide_stats', ok: false, ms: Math.round(now() - t0), detail: describe(e) });
    }

    t0 = now();
    try {
      const r = await rpc('guide_probe', { p_visitor: vid() }, 8000);
      const row = Array.isArray(r) ? r[0] : r;
      out.steps.push({ name: '写入通道 POST /rpc/guide_probe', ok: !!(row && row.ok), ms: Math.round(now() - t0), detail: row ? '服务端 ' + row.server_time : '无返回' });
    } catch (e) {
      out.steps.push({ name: '写入通道 POST /rpc/guide_probe', ok: false, ms: Math.round(now() - t0), detail: describe(e) });
    }

    const lo = readLocal();
    out.local = {
      liked: Object.keys(lo.liked).filter(k => lo.liked[k]).length,
      likes: Object.keys(lo.likes).length,
      views: Object.keys(lo.views).length,
      comments: Object.keys(lo.comments).reduce((a, k) => a + (lo.comments[k] || []).length, 0)
    };
    const failed = out.steps.filter(s => !s.ok).length;
    if (!failed && queueLen()) await flushQueue();   // 通了就顺手把积压送出去
    out.pending = queueLen();
    out.verdict = failed === 0
      ? '链路正常：点赞和浏览会实时写入云端'
      : (out.online ? '请求失败：多半被网络或浏览器插件拦住了' : '设备当前离线');
    if (!failed) { degraded = false; }
    return out;
  }

  /* ---------- 本机旧数据补传 ---------- */
  // 把本机点过的赞按「目标状态」推到云端。浏览量不补：它按天去重，
  // 补传会虚高，而且换设备本来也不该继承别人的浏览记录。
  async function pushLocalLikes() {
    if (!HAS_CLOUD) return { ok: false, error: '未配置云端' };
    const lo = readLocal();
    const ids = Object.keys(lo.liked).filter(k => lo.liked[k]);
    let done = 0;
    for (const id of ids) {
      try {
        await rpc('guide_like_set', { p_guide: id, p_visitor: vid(), p_on: true }, 15000, false);
        done++;
      } catch (e) {
        lastError = describe(e);
        return { ok: false, error: lastError, done, total: ids.length };
      }
    }
    await stats();
    return { ok: true, done, total: ids.length };
  }

  /* ---------- 断线自愈 ----------
     连不上就自己隔一会儿再试，指数退避到 60 秒封顶；
     留在页面上不动也能恢复，不需要刷新，更不需要换浏览器。 */
  let recoverTimer = null;
  let recoverDelay = 4000;

  function scheduleRecovery() {
    if (!HAS_CLOUD || recoverTimer) return;
    recoverTimer = setTimeout(runRecovery, recoverDelay + Math.round(Math.random() * 800));
  }

  async function runRecovery() {
    recoverTimer = null;
    if (document.hidden) { scheduleRecovery(); return; }   // 后台标签页不空转
    const s = await stats({ timeout: 9000, quiet: true });
    if (s.mode === 'cloud' && !s.degraded) { recoverDelay = 4000; return; }
    recoverDelay = Math.min(Math.round(recoverDelay * 1.8), 60000);
    scheduleRecovery();
  }

  // 用户点「重试」：立刻重连，不等退避
  async function reconnect() {
    recoverDelay = 4000;
    if (recoverTimer) { clearTimeout(recoverTimer); recoverTimer = null; }
    const s = await stats({ timeout: 9000 });
    if (s.mode === 'cloud' && !s.degraded) {
      recoverDelay = 4000;
      if (queueLen()) flushQueue();
    } else {
      scheduleRecovery();
    }
    return s;
  }

  /* ---------- 生命周期 ---------- */
  function kick() {
    if (!HAS_CLOUD) return;
    if (queueLen()) flushQueue();
    // 之前失败过，回到前台顺手重连一次
    if (degraded || snapshot.stale) reconnect();
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
  window.addEventListener('online', () => { lastError = ''; reconnect(); });
  window.addEventListener('offline', () => { degraded = true; emit(); });
  setInterval(() => { if (!document.hidden && queueLen()) flushQueue(); }, 60000);

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
    probe,
    flush: flushQueue,
    queueLen,
    pushLocalLikes,
    reconnect,
    statsAge: () => {
      const c = readCache();
      return c ? Date.now() - c.t : 0;
    },
    // 供其他模块复用同一套超时 + 重试，别再各写一份裸 fetch
    net: { rest, rpc },
    onChange: fn => { listeners.add(fn); return () => listeners.delete(fn); },
    snapshot: () => snapshot
  };
})();
