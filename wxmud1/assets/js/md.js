/* ============================================================
   词条 Markdown：渲染 + 可视化编辑
   ------------------------------------------------------------
   · 渲染只输出白名单标签，原文先整体转义，不接受内联 HTML
   · 链接与图片地址限定 http(s)、站内绝对路径、锚点
   · 编辑器：工具栏、编辑/预览切换、图片压缩后直传对象存储
   · 无外部依赖
   ============================================================ */
(function () {
  'use strict';

  var CFG = window.WX_SUPABASE || {};
  var BASE = String(CFG.url || '').replace(/\/+$/, '');
  var KEY = String(CFG.key || '');
  var BUCKET = 'term-media';

  /* ---------- 基础 ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function safeUrl(u) {
    u = String(u == null ? '' : u).trim();
    if (!u) return '';
    if (/^https?:\/\//i.test(u)) return u;
    if (/^\/\//.test(u)) return 'https:' + u;
    if (/^\/(?!\/)/.test(u)) return u;
    if (/^#[^\s]*$/.test(u)) return u;
    return '';
  }

  /* ---------- 行内 ---------- */
  function inline(t) {
    // 先整体转义，再做行内标记替换：除白名单标签外不会产生任何真实 HTML
    var s = esc(t);
    s = s.replace(/`([^`\n]+)`/g, function (_, c) { return '<code>' + c + '</code>'; });
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, function (m, alt, url) {
      var u = safeUrl(url);
      return u ? '<img src="' + u + '" alt="' + alt + '" loading="lazy" decoding="async">' : m;
    });
    s = s.replace(/\[([^\]\n]+)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, function (m, txt, url) {
      var u = safeUrl(url);
      if (!u) return m;
      var ext = /^(https?:)?\/\//i.test(u);
      return '<a href="' + u + '"' + (ext ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + txt + '</a>';
    });
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^\w*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
    s = s.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');
    return s;
  }

  /* ---------- 块级 ---------- */
  function render(src) {
    var lines = String(src == null ? '' : src).replace(/\r\n?/g, '\n').split('\n');
    var out = [], pbuf = [], i = 0, n = lines.length;

    function flushP() {
      if (pbuf.length) {
        out.push('<p>' + pbuf.map(inline).join('<br>') + '</p>');
        pbuf = [];
      }
    }

    while (i < n) {
      var line = lines[i], t = line.replace(/\s+$/, '');

      if (!t.trim()) { flushP(); i++; continue; }

      // 围栏代码块
      if (/^\s*```/.test(t)) {
        flushP();
        var lang = t.replace(/^\s*```/, '').trim();
        var buf = []; i++;
        while (i < n && !/^\s*```/.test(lines[i])) { buf.push(lines[i]); i++; }
        i++;
        out.push('<pre class="md-pre"' + (lang ? ' data-lang="' + esc(lang) + '"' : '') +
          '><code>' + esc(buf.join('\n')) + '</code></pre>');
        continue;
      }

      // 分割线
      if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(t)) { flushP(); out.push('<hr>'); i++; continue; }

      // 标题
      var h = t.match(/^\s{0,3}(#{1,4})\s+(.+?)\s*#*\s*$/);
      if (h) {
        flushP();
        var lv = Math.min(h[1].length + 1, 4);
        out.push('<h' + lv + '>' + inline(h[2]) + '</h' + lv + '>');
        i++; continue;
      }

      // 引用
      if (/^\s*>/.test(t)) {
        flushP();
        var q = [];
        while (i < n && /^\s*>/.test(lines[i])) {
          q.push(lines[i].replace(/^\s*>\s?/, ''));
          i++;
        }
        out.push('<blockquote>' + render(q.join('\n')) + '</blockquote>');
        continue;
      }

      // 列表
      var ul = t.match(/^\s*[-*+]\s+(.+)$/);
      var ol = t.match(/^\s*(\d+)[.)]\s+(.+)$/);
      if (ul || ol) {
        flushP();
        var ordered = !!ol, items = [];
        while (i < n) {
          var cur = lines[i];
          var m1 = cur.match(/^\s*[-*+]\s+(.+)$/);
          var m2 = cur.match(/^\s*(\d+)[.)]\s+(.+)$/);
          if (ordered && m2) { items.push(m2[2]); i++; continue; }
          if (!ordered && m1 && !m2) { items.push(m1[1]); i++; continue; }
          if (items.length && /^\s{2,}\S/.test(cur)) { items[items.length - 1] += '\n' + cur.trim(); i++; continue; }
          break;
        }
        var tag = ordered ? 'ol' : 'ul';
        out.push('<' + tag + '>' + items.map(function (it) {
          return '<li>' + it.split('\n').map(inline).join('<br>') + '</li>';
        }).join('') + '</' + tag + '>');
        continue;
      }

      pbuf.push(t);
      i++;
    }
    flushP();
    return out.join('\n');
  }

  /* ---------- 纯文本（摘要用） ---------- */
  function plain(src, max) {
    var s = String(src == null ? '' : src)
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '[图]')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/^\s{0,3}#{1,6}\s*/gm, '')
      .replace(/^\s*>\s?/gm, '')
      .replace(/^\s*([-*+]|\d+[.)])\s+/gm, '')
      .replace(/[*_~`]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (max && s.length > max) s = s.slice(0, max) + '…';
    return s;
  }

  /* ---------- 图片上传 ---------- */
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    });
  }

  function extOf(type) {
    return ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' })[type] || 'webp';
  }

  // 大图先缩到长边 1600，再转 webp；小图原样传，gif 保持动画
  function shrink(file) {
    return new Promise(function (res, rej) {
      if (!/^image\//.test(file.type)) return rej(new Error('只接受图片'));
      if (/^image\/gif$/i.test(file.type)) {
        if (file.size > 2 * 1024 * 1024) return rej(new Error('GIF 超过 2MB'));
        return res(file);
      }
      if (file.size <= 160 * 1024 && /^image\/(png|jpeg|webp)$/i.test(file.type)) return res(file);
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth || 1, h = img.naturalHeight || 1;
        var scale = Math.min(1, 1600 / Math.max(w, h));
        var c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(w * scale));
        c.height = Math.max(1, Math.round(h * scale));
        var g = c.getContext('2d');
        g.imageSmoothingQuality = 'high';
        g.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        if (c.toBlob) {
          c.toBlob(function (b) { b ? res(b) : rej(new Error('压缩失败')); }, 'image/webp', 0.86);
        } else {
          rej(new Error('压缩失败'));
        }
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('读图失败')); };
      img.src = url;
    });
  }

  function upload(blob) {
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(BASE) || KEY.length < 20) {
      return Promise.reject(new Error('未连接存储'));
    }
    var d = new Date();
    var ym = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0');
    var path = 'term/' + ym + '/' + uuid() + '.' + extOf(blob.type || 'image/webp');
    return fetch(BASE + '/storage/v1/object/' + BUCKET + '/' + path, {
      method: 'POST',
      headers: {
        apikey: KEY,
        Authorization: 'Bearer ' + KEY,
        'Content-Type': blob.type || 'image/webp',
        'x-upsert': 'false'
      },
      body: blob
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error('HTTP ' + r.status); });
      return BASE + '/storage/v1/object/public/' + BUCKET + '/' + path;
    });
  }

  /* ---------- 编辑器 ---------- */
  var ICONS = {
    b: '<b>B</b>',
    i: '<i>I</i>',
    h: 'H',
    ul: '≡',
    ol: '1.',
    quote: '”',
    code: '&lt;&gt;',
    link: '链接',
    img: '图片',
    hr: '—'
  };
  var TITLES = {
    b: '粗体', i: '斜体', h: '小标题', ul: '无序列表', ol: '有序列表',
    quote: '引用', code: '代码', link: '链接', img: '插入图片', hr: '分割线'
  };

  function attach(ta, opts) {
    if (!ta) return null;
    if (ta._wxmd) return ta._wxmd;
    opts = opts || {};

    var wrap = document.createElement('div');
    wrap.className = 'md-ed';
    ta.parentNode.insertBefore(wrap, ta);

    var bar = document.createElement('div');
    bar.className = 'md-bar';
    var html = '';
    Object.keys(ICONS).forEach(function (k) {
      html += '<button type="button" class="md-btn' + (k === 'img' ? ' md-btn-img' : '') + '"' +
        ' data-md="' + k + '" title="' + TITLES[k] + '" aria-label="' + TITLES[k] + '">' + ICONS[k] + '</button>';
    });
    html += '<span class="md-bar-sp"></span>' +
      '<button type="button" class="md-btn md-prev-btn" data-md="preview">预览</button>';
    bar.innerHTML = html;
    wrap.appendChild(bar);

    var pane = document.createElement('div');
    pane.className = 'md-pane';
    wrap.appendChild(pane);
    pane.appendChild(ta);

    var prev = document.createElement('div');
    prev.className = 'md-prev md-view';
    prev.hidden = true;
    wrap.appendChild(prev);

    var media = document.createElement('div');
    media.className = 'md-media';
    media.hidden = true;
    wrap.appendChild(media);

    var tip = document.createElement('p');
    tip.className = 'md-tip';
    tip.hidden = true;
    wrap.appendChild(tip);

    var file = document.createElement('input');
    file.type = 'file';
    file.accept = 'image/png,image/jpeg,image/webp,image/gif';
    file.hidden = true;
    wrap.appendChild(file);

    var previewOn = false;

    function say(msg) {
      if (!msg) { tip.hidden = true; return; }
      tip.textContent = msg;
      tip.hidden = false;
      clearTimeout(tip._t);
      tip._t = setTimeout(function () { tip.hidden = true; }, 2600);
    }

    function fire() {
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function insert(text, selStart, selEnd) {
      var s = ta.selectionStart, e = ta.selectionEnd, v = ta.value;
      ta.value = v.slice(0, s) + text + v.slice(e);
      ta.focus();
      var a = selStart == null ? s + text.length : s + selStart;
      var b = selEnd == null ? a : s + selEnd;
      ta.setSelectionRange(a, b);
      fire();
      refreshMedia();
    }

    function wrapSel(pre, suf, ph) {
      var s = ta.selectionStart, e = ta.selectionEnd, v = ta.value;
      var sel = v.slice(s, e) || ph || '';
      insert(pre + sel + suf, pre.length, pre.length + sel.length);
    }

    function linePrefix(p) {
      var s = ta.selectionStart, e = ta.selectionEnd, v = ta.value;
      var ls = v.lastIndexOf('\n', s - 1) + 1;
      var le = v.indexOf('\n', e);
      if (le < 0) le = v.length;
      var seg = v.slice(ls, le);
      var rows = seg.split('\n');
      var all = rows.every(function (l) { return !l.trim() || l.indexOf(p) === 0; });
      var out = rows.map(function (l) {
        if (!l.trim()) return l;
        return all ? l.slice(p.length) : p + l;
      }).join('\n');
      ta.value = v.slice(0, ls) + out + v.slice(le);
      ta.focus();
      ta.setSelectionRange(ls, ls + out.length);
      fire();
      refreshMedia();
    }

    function addImage(blob, alt) {
      if (!blob) return;
      var btn = bar.querySelector('[data-md="img"]');
      var old = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '…';
      shrink(blob).then(upload).then(function (url) {
        insert('\n\n![' + (alt || '配图') + '](' + url + ')\n\n');
        say('');
      }).catch(function (e) {
        say(e && e.message ? e.message : '上传失败');
      }).then(function () {
        btn.disabled = false;
        btn.innerHTML = old;
        refreshMedia();
      });
    }

    function pickImage() { file.value = ''; file.click(); }

    file.addEventListener('change', function () {
      var f = file.files && file.files[0];
      if (f) addImage(f);
    });

    // 粘贴 / 拖入图片
    ta.addEventListener('paste', function (e) {
      var items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (var i = 0; i < items.length; i++) {
        if (items[i].kind === 'file' && /^image\//.test(items[i].type)) {
          e.preventDefault();
          addImage(items[i].getAsFile());
          return;
        }
      }
    });
    ta.addEventListener('drop', function (e) {
      var fs = e.dataTransfer && e.dataTransfer.files;
      if (fs && fs.length && /^image\//.test(fs[0].type)) {
        e.preventDefault();
        addImage(fs[0]);
      }
    });
    ta.addEventListener('dragover', function (e) {
      if (e.dataTransfer && e.dataTransfer.types && Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') > -1) {
        e.preventDefault();
      }
    });

    bar.addEventListener('click', function (e) {
      var b = e.target.closest('.md-btn');
      if (!b) return;
      var act = b.getAttribute('data-md');
      if (act === 'b') wrapSel('**', '**', '粗体');
      else if (act === 'i') wrapSel('*', '*', '斜体');
      else if (act === 'code') wrapSel('`', '`', 'code');
      else if (act === 'h') linePrefix('## ');
      else if (act === 'ul') linePrefix('- ');
      else if (act === 'ol') linePrefix('1. ');
      else if (act === 'quote') linePrefix('> ');
      else if (act === 'link') {
        var s = ta.selectionStart, e2 = ta.selectionEnd, v = ta.value;
        var sel = v.slice(s, e2) || '链接文字';
        insert('[' + sel + '](https://)', 1, 1 + sel.length);
      } else if (act === 'hr') {
        insert('\n\n---\n\n');
      } else if (act === 'img') pickImage();
      else if (act === 'preview') togglePreview();
    });

    function togglePreview() {
      previewOn = !previewOn;
      prev.hidden = !previewOn;
      pane.hidden = previewOn;
      var b = bar.querySelector('.md-prev-btn');
      b.textContent = previewOn ? '编辑' : '预览';
      b.classList.toggle('on', previewOn);
      if (previewOn) prev.innerHTML = render(ta.value) || '<p class="md-empty">暂无内容</p>';
    }

    function refreshMedia() {
      var re = /!\[([^\]]*)\]\(([^)\s]+)\)/g, m, list = [];
      while ((m = re.exec(ta.value))) {
        var u = safeUrl(m[2]);
        if (u) list.push({ alt: m[1], url: u });
      }
      if (!list.length) { media.hidden = true; media.innerHTML = ''; return; }
      media.hidden = false;
      media.innerHTML = list.map(function (it, i) {
        return '<figure class="md-thumb" data-url="' + esc(it.url) + '">' +
          '<img src="' + esc(it.url) + '" alt="" loading="lazy">' +
          '<button type="button" class="md-thumb-x" data-url="' + esc(it.url) +
          '" title="移除图片" aria-label="移除图片">✕</button>' +
          '</figure>';
      }).join('');
    }

    media.addEventListener('click', function (e) {
      var x = e.target.closest('.md-thumb-x');
      if (!x) return;
      var url = x.getAttribute('data-url');
      var v = ta.value;
      var re = new RegExp('!\\[[^\\]]*\\]\\(' + url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\)\\n?', 'g');
      ta.value = v.replace(re, '');
      fire();
      refreshMedia();
    });

    var mTimer = null;
    ta.addEventListener('input', function () {
      clearTimeout(mTimer);
      mTimer = setTimeout(refreshMedia, 320);
      if (previewOn) prev.innerHTML = render(ta.value);
    });

    refreshMedia();

    var api = {
      el: wrap,
      refresh: refreshMedia,
      preview: function (on) { if (!!on !== previewOn) togglePreview(); },
      focus: function () { ta.focus(); }
    };
    ta._wxmd = api;
    return api;
  }

  window.WXMD = {
    esc: esc,
    render: render,
    plain: plain,
    safeUrl: safeUrl,
    attach: attach,
    upload: upload,
    shrink: shrink
  };
})();
