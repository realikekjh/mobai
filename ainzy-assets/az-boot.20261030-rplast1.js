/* 10-22 az-group-first：酒馆组（roleplay）排第一个分组。
   后端 Go 输出分组时按代号字母排序，前端（价格页筛选、建 API 密钥的分组下拉、在线对话）照着 JSON 顺序渲染。
   这里拦截 /api/user/self/groups 和 /api/pricing 的响应，把 FIRST 里的分组挪到最前面，其余顺序不变。只改顺序，不改内容。 */
(function () { try {
  var FIRST = ['roleplay'];
  var RE = /\/api\/(user\/self\/groups|pricing)(\?|$)/;
  function reorder(o) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return o;
    /* 10-30 老板：酒馆组放最前容易误会，改为排到最后（FIRST 里的分组挪到末尾） */
    var out = {}, k;
    for (k in o) if (Object.prototype.hasOwnProperty.call(o, k) && FIRST.indexOf(k) < 0) out[k] = o[k];
    for (var i = 0; i < FIRST.length; i++) if (Object.prototype.hasOwnProperty.call(o, FIRST[i])) out[FIRST[i]] = o[FIRST[i]];
    return out;
  }
  function fix(text) {
    try {
      var j = JSON.parse(text);
      if (j && j.data && typeof j.data === 'object' && !Array.isArray(j.data) && j.data[FIRST[0]]) j.data = reorder(j.data);   /* /api/user/self/groups */
      if (j && j.usable_group) j.usable_group = reorder(j.usable_group);                                                          /* /api/pricing */
      if (j && j.group_ratio) j.group_ratio = reorder(j.group_ratio);
      return JSON.stringify(j);
    } catch (e) { return text; }
  }
  var XO = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (m, url) { this.__azGF = RE.test(String(url || '')); return XO.apply(this, arguments); };
  ['responseText', 'response'].forEach(function (prop) {
    var d = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, prop);
    if (!d || !d.get) return;
    Object.defineProperty(XMLHttpRequest.prototype, prop, { configurable: true, get: function () {
      var v = d.get.call(this);
      if (!this.__azGF || this.readyState !== 4) return v;
      if (typeof v === 'string') return fix(v);
      if (v && typeof v === 'object' && prop === 'response') { try { return JSON.parse(fix(JSON.stringify(v))); } catch (e) { return v; } }
      return v;
    } });
  });
  if (window.fetch) {
    var F = window.fetch;
    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var p = F.apply(this, arguments);
      if (!RE.test(url)) return p;
      return p.then(function (res) {
        if (!res || !res.ok) return res;
        return res.clone().text().then(function (t) {
          return new Response(fix(t), { status: res.status, statusText: res.statusText, headers: res.headers });
        }, function () { return res; });
      });
    };
  }
} catch (e) {} })();

/* 2026-10-30: keep owned display content on the visitor's current entrance.
   Only public GET display fields and their display caches are adjusted. */
(function () { try {
  'use strict';
  var OWNED = ['https://ainzy.net', 'https://www.ainzy.net', 'https://hub.ainzy.net'];
  /* 沫白：把当前站点域名纳入自有域名，否则首页 iframe 用接口返回的旧沙箱域名 → 403 白屏 */
  if (OWNED.indexOf(location.origin) === -1) OWNED.push(location.origin);
  var PATHS = {
    home: /^\/media\/home\.html$/,
    logo: /^\/logo\.png$/,
    docs: /^\/docs(?:\/|$)/,
    chat: /^\/(?:docs|ccswitch)(?:\/|$)/
  };
  /* 沫白：从当前地址读 sharecode，拼进 home iframe URL，发布平台靠它放行 */
  function currentShare() {
    try { var m = location.search.match(/[?&]sharecode=([^&]+)/); return m ? '?sharecode=' + encodeURIComponent(m[1]) : ''; }
    catch (e) { return ''; }
  }
  function localUrl(value, kind) {
    if (typeof value !== 'string' || !/^https:\/\//i.test(value)) return value;
    try {
      var u = new URL(value);
      if (OWNED.indexOf(u.origin) === -1 || u.username || u.password || !PATHS[kind].test(u.pathname)) return value;
      /* 沫白：home 强制用当前域名 + 当前 sharecode，彻底丢掉接口里的旧沙箱域名 */
      if (kind === 'home') return location.origin + '/mobai/media/home.html' + currentShare();
      return location.origin + u.pathname + u.search + u.hash;
    } catch (e) { return value; }
  }
  function statusDisplay(s) {
    if (!s || typeof s !== 'object' || Array.isArray(s)) return s;
    if (typeof s.logo === 'string') s.logo = localUrl(s.logo, 'logo');
    if (typeof s.docs_link === 'string') s.docs_link = localUrl(s.docs_link, 'docs');
    if (Array.isArray(s.chats)) s.chats.forEach(function (chat) {
      if (!chat || typeof chat !== 'object' || Array.isArray(chat)) return;
      Object.keys(chat).forEach(function (k) { chat[k] = localUrl(chat[k], 'chat'); });
    });
    return s;
  }
  function publicPath(url, method) {
    if (String(method || 'GET').toUpperCase() !== 'GET') return '';
    try {
      var u = new URL(String(url), location.href);
      return u.origin === location.origin && /^\/api\/(?:status|home_page_content)$/.test(u.pathname) ? u.pathname : '';
    } catch (e) { return ''; }
  }
  function fix(text, path) {
    try {
      var j = JSON.parse(text);
      if (!j || j.success === false || !Object.prototype.hasOwnProperty.call(j, 'data')) return text;
      var before = JSON.stringify(j);
      if (path === '/mobai/api/status') statusDisplay(j.data);
      else j.data = localUrl(j.data, 'home');
      var after = JSON.stringify(j);
      return before === after ? text : after;
    } catch (e) { return text; }
  }
  /* Run before React hydrates its own cached configuration. */
  ['status', 'home_page_content', 'system-config-storage'].forEach(function (key) {
    try {
      var raw = localStorage.getItem(key), next;
      if (!raw) return;
      if (key === 'home_page_content') next = localUrl(raw, 'home');
      else {
        var j = JSON.parse(raw);
        if (key === 'status') statusDisplay(j);
        else if (j && j.state) {
          if (j.state.config && typeof j.state.config.logo === 'string') j.state.config.logo = localUrl(j.state.config.logo, 'logo');
          if (typeof j.state.loadedLogoUrl === 'string') j.state.loadedLogoUrl = localUrl(j.state.loadedLogoUrl, 'logo');
        }
        next = JSON.stringify(j);
      }
      if (next !== raw) localStorage.setItem(key, next);
    } catch (e) {} // Storage may be blocked or contain an old invalid value.
  });
  var open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__azDisplayPath = publicPath(url, method);
    return open.apply(this, arguments);
  };
  ['responseText', 'response'].forEach(function (prop) {
    var d = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, prop);
    if (!d || !d.get) return;
    Object.defineProperty(XMLHttpRequest.prototype, prop, { configurable: true, get: function () {
      var v = d.get.call(this), path = this.__azDisplayPath;
      if (!path || this.readyState !== 4 || this.status < 200 || this.status >= 300) return v;
      if (typeof v === 'string') return fix(v, path);
      if (prop === 'response' && this.responseType === 'json' && v) {
        try { return JSON.parse(fix(JSON.stringify(v), path)); } catch (e) {}
      }
      return v;
    } });
  });
  if (window.fetch) {
    var fetchOriginal = window.fetch;
    window.fetch = function (input, init) {
      var url = input && input.url ? input.url : input;
      var path = publicPath(url, init && init.method || input && input.method);
      var p = fetchOriginal.apply(this, arguments);
      if (!path) return p;
      return p.then(function (res) {
        if (!res || !res.ok || res.status === 204 || res.status === 205) return res;
        return res.clone().text().then(function (text) {
          var body = fix(text, path);
          if (body === text) return res;
          var headers = new Headers(res.headers);
          headers.delete('content-length'); headers.delete('content-encoding');
          var out = new Response(body, { status: res.status, statusText: res.statusText, headers: headers });
          ['url', 'type', 'redirected'].forEach(function (k) {
            Object.defineProperty(out, k, { value: res[k] });
          });
          return out;
        }, function () { return res; });
      });
    };
  }
} catch (e) {} })();


/* Keep owned documentation links in announcements and later-rendered panels
   on the selected entrance. Do not touch API bases, examples or external URLs. */
(function () { try {
  'use strict';
  var owned = ['https://ainzy.net', 'https://www.ainzy.net', 'https://hub.ainzy.net'];
  if (owned.indexOf(location.origin) === -1) return;
  function link(a) {
    var raw = a.getAttribute('href');
    if (!raw || !/^https:\/\//i.test(raw)) return;
    try {
      var u = new URL(raw);
      if (owned.indexOf(u.origin) === -1 || u.username || u.password || !/^\/(?:docs|ccswitch)(?:\/|$)/.test(u.pathname)) return;
      var next = location.origin + u.pathname + u.search + u.hash;
      if (next !== raw) a.setAttribute('href', next);
    } catch (e) {}
  }
  function scan(n) {
    if (!n || n.nodeType !== 1) return;
    if (n.tagName === 'A') link(n);
    n.querySelectorAll('a[href]').forEach(link);
  }
  scan(document.documentElement);
  new MutationObserver(function (records) {
    records.forEach(function (r) {
      if (r.type === 'attributes') { if (r.target.tagName === 'A') link(r.target); }
      else r.addedNodes.forEach(scan);
    });
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
  function click(e) {
    var n = e.target, a = n && n.closest && n.closest('a[href]');
    if (a) link(a);
  }
  document.addEventListener('click', click, true);
  document.addEventListener('auxclick', click, true);
} catch (e) {} })();


/* 10-20 接口预取：React 要先等 /api/status（首页还有 home_page_content、notice）回来才渲染路由，
   国内每个请求 ~1s。开屏脚本一执行就先发出去，这几个接口带 private max-age=60，React 再请求时直接命中缓存。 */
(function () { try {
  if (!window.fetch) return;
  var u = ['/mobai/api/status'];
  if (location.pathname === '/') u.push('/mobai/api/home_page_content', '/mobai/api/notice');
  /* 10-20 价格页：React 和 fix.js 会各请求 /api/pricing 3~4 次（国内每次 1.5~3s）。这里先发一次，
     Apache 给它 private max-age=60 + Vary: Cookie，后面的重复请求直接复用。 */
  if (/^\/pricing/.test(location.pathname)) u.push('/mobai/api/pricing');
  u.forEach(function (x) { fetch(x, { credentials: 'same-origin' }).catch(function () {}); });
} catch (e) {} })();

/* 10-20 首页预取：首页正文是 iframe(/media/home.html)，要等 React 跑完才请求（实测 3.6s 才发出、5.7s 才出内容）。
   开屏只预取正文，地球依赖等正文显示后再加载，避免争抢首屏带宽。只对首页生效。 */
(function () { try {
  if (location.pathname !== '/') return;
  var h = document.head || document.documentElement;
  ['/mobai/media/home.html'].forEach(function (u) {
    var l = document.createElement('link'); l.rel = 'prefetch'; l.href = u; h.appendChild(l);
  });
} catch (e) {} })();

/* ainzy 开屏：logo（莫比乌斯三角环）形状不动，环带自身的光影沿环流动。
   做法：每个 logo 像素算出它在环上的位置 u 和离中线的距离 v；每帧从原图 (u - shift, v) 处取明暗，光影就沿环平移。
   logo 三向对称，走 1/3 圈即回到原样，循环无缝。页面渲染出内容后淡出；最少 300ms 防闪，10s 保底。 */
(function () {
  var t0 = Date.now(), gone = false, anim = null;
  var keep = /azboot/.test(location.hash);           /* 调试：URL 带 #azboot 时开屏不消失 */

  function flow(lg, img) {
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
    var dpr = Math.min(window.devicePixelRatio || 1, 2), S = Math.round((lg.clientWidth || 64) * dpr);
    var cv = document.createElement('canvas'); cv.width = cv.height = S;
    var ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, S, S);
    var src; try { src = ctx.getImageData(0, 0, S, S); } catch (e) { return null; }
    var sd = src.data, x, y, k, t;
    /* 明暗源：原图亮度做一次 3x3 平滑，减少采样噪点 */
    var lum = new Float32Array(S * S), al = new Uint8Array(S * S), sm = new Float32Array(S * S);
    for (k = 0; k < S * S; k++) { lum[k] = (sd[k * 4] + sd[k * 4 + 1] + sd[k * 4 + 2]) / 3; al[k] = sd[k * 4 + 3]; }
    for (y = 0; y < S; y++) for (x = 0; x < S; x++) {
      var acc = 0, w = 0;
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        var xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= S || yy >= S) continue;
        var q = yy * S + xx; if (al[q] < 128) continue;
        var ww = (dx || dy) ? 1 : 2; acc += lum[q] * ww; w += ww;
      }
      sm[y * S + x] = w ? acc / w : -1;
    }
    /* 中线：logo 实测（单位=边长）三角形重心 (0.518, 0.600)，中线外接圆 0.29，圆角 0.07 */
    var cx = 0.518, cy = 0.600, Rc = 0.29, rf = 0.07, dense = [], V = [];
    for (k = 0; k < 3; k++) { var an = -Math.PI / 2 + k * 2 * Math.PI / 3; V.push([cx + Rc * Math.cos(an), cy + Rc * Math.sin(an)]); }
    var dT = rf * Math.sqrt(3);
    for (k = 0; k < 3; k++) {
      var A = V[k], B = V[(k + 1) % 3], C = V[(k + 2) % 3];
      var ab = [B[0] - A[0], B[1] - A[1]], l1 = Math.hypot(ab[0], ab[1]); ab = [ab[0] / l1, ab[1] / l1];
      var bc = [C[0] - B[0], C[1] - B[1]], l2 = Math.hypot(bc[0], bc[1]); bc = [bc[0] / l2, bc[1] / l2];
      var p0 = [A[0] + ab[0] * dT, A[1] + ab[1] * dT], p1 = [B[0] - ab[0] * dT, B[1] - ab[1] * dT], p2 = [B[0] + bc[0] * dT, B[1] + bc[1] * dT];
      for (t = 0; t < 120; t++) dense.push([p0[0] + (p1[0] - p0[0]) * t / 120, p0[1] + (p1[1] - p0[1]) * t / 120]);
      var bis = [bc[0] - ab[0], bc[1] - ab[1]], lb = Math.hypot(bis[0], bis[1]); bis = [bis[0] / lb, bis[1] / lb];
      var oc = [B[0] + bis[0] * 2 * rf, B[1] + bis[1] * 2 * rf];
      var s0 = Math.atan2(p1[1] - oc[1], p1[0] - oc[0]), s1 = Math.atan2(p2[1] - oc[1], p2[0] - oc[0]), dS = s1 - s0;
      while (dS > Math.PI) dS -= 2 * Math.PI;
      while (dS < -Math.PI) dS += 2 * Math.PI;
      for (t = 0; t < 60; t++) { var g = s0 + dS * t / 60; dense.push([oc[0] + rf * Math.cos(g), oc[1] + rf * Math.sin(g)]); }
    }
    var n = dense.length, cum = [0];
    for (k = 1; k <= n; k++) { var u0 = dense[k - 1], u1 = dense[k % n]; cum.push(cum[k - 1] + Math.hypot(u1[0] - u0[0], u1[1] - u0[1])); }
    var total = cum[n];
    /* 每个像素的 (u, v)；半透明的轮廓边缘像素保留原样，不参与流动，避免轮廓闪 */
    var idx = [], U = [], VV = [], base = [];
    for (y = 0; y < S; y++) for (x = 0; x < S; x++) {
      var p = (y * S + x) * 4; if (sd[p + 3] < 8) continue;
      var px = (x + 0.5) / S, py = (y + 0.5) / S, best = 1e9, bi = 0;
      for (k = 0; k < n; k += 3) { var ddx = dense[k][0] - px, ddy = dense[k][1] - py, dd = ddx * ddx + ddy * ddy; if (dd < best) { best = dd; bi = k; } }
      var bu = cum[bi] / total, bv = 0; best = 1e9;
      for (t = bi - 4; t <= bi + 4; t++) {
        var i0 = ((t % n) + n) % n, i1 = (i0 + 1) % n, ax = dense[i0][0], ay = dense[i0][1], vx = dense[i1][0] - ax, vy = dense[i1][1] - ay;
        var wv = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy || 1)));
        var qx = ax + vx * wv - px, qy = ay + vy * wv - py, d2 = qx * qx + qy * qy;
        if (d2 < best) { best = d2; bu = (cum[i0] + (cum[i0 + 1] - cum[i0]) * wv) / total; bv = (vx * (py - ay) - vy * (px - ax)) / (Math.hypot(vx, vy) || 1); }
      }
      idx.push(p); U.push(bu); VV.push(bv); base.push(sd[p], sd[p + 1], sd[p + 2], sd[p + 3]);
    }
    function onLine(u) {
      u -= Math.floor(u);
      var d = u * total, lo = 0, hi = n;
      while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (cum[mid] <= d) lo = mid; else hi = mid; }
      var a2 = dense[lo], b2 = dense[(lo + 1) % n], f = (d - cum[lo]) / ((cum[lo + 1] - cum[lo]) || 1);
      var tx = b2[0] - a2[0], ty = b2[1] - a2[1], tl = Math.hypot(tx, ty) || 1;
      return [a2[0] + tx * f, a2[1] + ty * f, -ty / tl, tx / tl];
    }
    function sample(xf, yf) {
      var X = xf * S - 0.5, Y = yf * S - 0.5;
      var x0 = Math.max(0, Math.min(S - 2, Math.floor(X))), y0 = Math.max(0, Math.min(S - 2, Math.floor(Y)));
      var fx = Math.max(0, Math.min(1, X - x0)), fy = Math.max(0, Math.min(1, Y - y0)), acc2 = 0, w2 = 0;
      var c = [[x0, y0, (1 - fx) * (1 - fy)], [x0 + 1, y0, fx * (1 - fy)], [x0, y0 + 1, (1 - fx) * fy], [x0 + 1, y0 + 1, fx * fy]];
      for (var j = 0; j < 4; j++) { var v = sm[c[j][1] * S + c[j][0]]; if (v >= 0 && c[j][2] > 0) { acc2 += v * c[j][2]; w2 += c[j][2]; } }
      return w2 > 0 ? acc2 / w2 : -1;
    }
    var out = ctx.createImageData(S, S), od = out.data, half = 0.0875, loopSec = 2.6, alive = true, raf = 0, start = performance.now();
    function frame(now) {
      if (!alive) return;
      var tt = (now - start) / 1000, ease = tt < 0.8 ? tt * tt / 1.6 : tt - 0.4;   /* 前 0.8 秒缓起步 */
      var shift = ease / loopSec / 3;
      for (var m = 0; m < idx.length; m++) {
        var r = base[m * 4], gg = base[m * 4 + 1], bb = base[m * 4 + 2], aa = base[m * 4 + 3], p3 = idx[m], mul = 1;
        if (aa > 200) {
          var vv = Math.max(-half, Math.min(half, VV[m])), c3 = onLine(U[m] - shift), l = sample(c3[0] + c3[2] * vv, c3[1] + c3[3] * vv);
          var own = (r + gg + bb) / 3;
          if (l >= 0 && own > 0) mul = Math.max(0.45, Math.min(2.2, l / own));
        }
        od[p3] = Math.min(255, r * mul); od[p3 + 1] = Math.min(255, gg * mul); od[p3 + 2] = Math.min(255, bb * mul); od[p3 + 3] = aa;
      }
      ctx.putImageData(out, 0, 0);
      if (!cv.isConnected) { lg.appendChild(cv); lg.classList.add('flowing'); }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return { stop: function () { alive = false; cancelAnimationFrame(raf); } };
  }

  function boot() {
    var lg = document.querySelector('#az-boot .lg'), img = lg && lg.querySelector('img');
    if (!img) return;
    function go() { setTimeout(function () { if (!gone) { try { anim = flow(lg, img); } catch (e) {} } }, 16); }
    if (img.complete && img.naturalWidth) go(); else img.addEventListener('load', go);
  }
  try { boot(); } catch (e) {}

  function hide() {
    if (gone || keep) return;
    gone = true;
    var b = document.getElementById('az-boot'); if (!b) return;
    setTimeout(function () {
      try { var mb = b.querySelector('.mb'); if (mb) { var ev = new CustomEvent('az-boot-out', { detail: mb }); window.dispatchEvent(ev); } } catch (e) {}
      b.classList.add('out');
      setTimeout(function () { if (anim) anim.stop(); if (b.parentNode) b.parentNode.removeChild(b); }, 450);
    }, Math.max(0, 300 - (Date.now() - t0)));
  }
  function ready() {
    var r = document.getElementById('root');
    return !!(r && r.firstElementChild && (r.textContent || '').replace(/\s+/g, '').length > 20);
  }
  var iv = setInterval(function () { if (ready()) { clearInterval(iv); hide(); } }, 60);
  setTimeout(function () { clearInterval(iv); hide(); }, 10000);
})();

/* 2026-10-15 开屏加小球（沿进度线从左往右蹦）和一行引言 */
(function(){try{var b=document.getElementById('az-boot');if(!b||b.querySelector('.mb'))return;
  var m=document.createElement('div');m.className='mb';
  m.innerHTML='<svg viewBox="0 0 96 96"><circle class="bd" cx="48" cy="48" r="44"/><ellipse class="ey" cx="56" cy="42" rx="7" ry="9"/><ellipse class="ey" cx="76" cy="42" rx="7" ry="9"/></svg>';
  b.appendChild(m);
  var q=document.createElement('div');q.className='q';q.innerHTML='Attention is all you need.<span>VASWANI ET AL. · 2017</span>';b.appendChild(q);}catch(e){}})();

/* 2026-10-16 开屏 v3：小黑球在 A I N Z Y 上逐个字母蹦跳 —— 起跳拉长、落地压扁、踩中的字母下沉回弹、
   脚下影子随高度缩放、眼睛看向下一个字母并偶尔眨眼；到两端原地转一圈回头。退场时这颗球照旧交给 fix.js 接力飞走。 */
(function () {
  try {
    var b = document.getElementById('az-boot'); if (!b) return;
    var tx = b.querySelector('.tx'), mb = b.querySelector('.mb'); if (!tx || !mb) return;
    var word = '沫白';
    tx.innerHTML = word.split('').map(function (c) { return '<span>' + c + '</span>'; }).join('');
    tx.classList.add('v3');
    mb.classList.add('v3');
    mb.innerHTML = '<svg viewBox="0 0 96 96"><circle class="bd" cx="48" cy="48" r="44"/>' +
      '<ellipse cx="33" cy="27" rx="10" ry="5.5" fill="#fff" opacity=".14" transform="rotate(-30 33 27)"/>' +
      '<g class="eyes"><ellipse class="ey" cx="38" cy="44" rx="7" ry="9"/><ellipse class="ey" cx="62" cy="44" rx="7" ry="9"/></g></svg>';
    var sh = document.createElement('i'); sh.className = 'sh'; b.appendChild(sh);
    var eyes = mb.querySelector('.eyes'), letters = tx.children, N = letters.length;
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var S = 30, HOP = 430, H = 46, cur = 0, dir = 1, phase = 'hop', t0 = performance.now(), spin0 = 0;
    function spot(k) {
      var r = letters[k].getBoundingClientRect(), br = b.getBoundingClientRect();
      return { x: r.left + r.width / 2 - br.left, y: r.top - br.top + r.height * 0.18 };   // 落在字母顶部
    }
    function place(x, y, sx, sy, rot) {
      mb.style.transform = 'translate(' + (x - S / 2).toFixed(1) + 'px,' + (y - S).toFixed(1) + 'px) rotate(' + (rot || 0).toFixed(1) + 'deg) scale(' + sx.toFixed(3) + ',' + sy.toFixed(3) + ')';
    }
    function look(dx, dy) { eyes.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; }
    function land(k) {
      var e = letters[k]; e.classList.remove('hit'); void e.offsetWidth; e.classList.add('hit');
    }
    function frame(now) {
      if (!b.isConnected || b.classList.contains('out') && b.querySelector('.mb') !== mb) return;
      if (mb.style.visibility === 'hidden') return;          // 已交给接力飞行
      var from = spot(cur), nxt = cur + dir, to = spot(Math.max(0, Math.min(N - 1, nxt)));
      if (phase === 'hop') {
        var t = Math.min(1, (now - t0) / HOP);
        var x = from.x + (to.x - from.x) * t, y = from.y + (to.y - from.y) * t - H * 4 * t * (1 - t);
        var v = 1 - 2 * t, st = 1 + 0.16 * Math.abs(v) * (t > 0.08 && t < 0.92 ? 1 : 0);   // 空中按速度拉长
        place(x, y, 1 / st, st, 0);
        look(dir * 6, v > 0 ? -4 : 3);
        var hgt = (from.y + (to.y - from.y) * t) - y, k = Math.max(0.35, 1 - hgt / (H * 1.4));
        sh.style.transform = 'translate(' + (x - 14).toFixed(1) + 'px,' + (from.y + 2).toFixed(1) + 'px) scale(' + k.toFixed(2) + ')';
        sh.style.opacity = (0.18 + 0.32 * k).toFixed(2);
        if (t >= 1) {
          cur = nxt; land(cur); phase = 'squash'; t0 = now;
        }
      } else if (phase === 'squash') {                        // 落地压扁 → 回弹
        var u = Math.min(1, (now - t0) / 150), p = spot(cur);
        var sq = u < 0.5 ? 1 - 0.28 * (u / 0.5) : 0.72 + 0.28 * ((u - 0.5) / 0.5);
        place(p.x, p.y, 2 - sq, sq, 0);
        if (u >= 1) {
          if (cur === N - 1 || cur === 0) { phase = 'spin'; t0 = now; }   // 到头：转一圈回头
          else { phase = 'hop'; t0 = now; }
        }
      } else if (phase === 'spin') {
        var w = Math.min(1, (now - t0) / 620), q = spot(cur);
        var e2 = w < 0.5 ? 2 * w * w : 1 - Math.pow(-2 * w + 2, 2) / 2;
        place(q.x, q.y - 10 * Math.sin(Math.PI * w), 1, 1, dir * 360 * e2);
        look(0, -2);
        if (w > 0.45 && w < 0.6) eyes.style.transform = 'translate(0,-2px) scaleY(.15)';   // 转身时眨眼
        if (w >= 1) { dir = -dir; phase = 'hop'; t0 = now; }
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(function (n) { t0 = n; frame(n); });
  } catch (e) {}
})();

/* 10-19：尽早记下控制台自己请求带的 Authorization（fix.js 是 defer，加载时首批请求已经发完了），给 fix.js 的 api()/__azAuth 兜底 */
(function () {
  try {
    var keep = function (v) { if (typeof v === 'string' && /^Bearer /.test(v)) window.__azTok0 = v; };
    var srh = XMLHttpRequest.prototype.setRequestHeader;
    XMLHttpRequest.prototype.setRequestHeader = function (k, v) { try { if (typeof k === 'string' && k.toLowerCase() === 'authorization') keep(v); } catch (e) {} return srh.apply(this, arguments); };
    var f = window.fetch;
    if (f) window.fetch = function (input, init) {
      try {
        var h = (init && init.headers) || (input && typeof input === 'object' && input.headers);
        if (h) keep(h.get ? h.get('Authorization') : (h.Authorization || h.authorization));
      } catch (e) {}
      return f.apply(this, arguments);
    };
  } catch (e) {}
})();

/* ainzy-ts-hook（2026-10-19）：Cloudflare 人机验证固定显示（2026-10-29）。
   必须放在开屏这种同步脚本里：fix.js 是 defer，执行时 Cloudflare 往往已经渲染完了。
   这里只管改渲染参数，并把状态写到容器的 data-az-ts 上、同时发 az-ts 事件；显示文字由 fix.js 负责。 */
(function () {
  try {
    var EN = false; try { EN = /^en/i.test(localStorage.getItem('i18nextLng') || ''); } catch (e) {}
    function emit(el, s, code) {
      try { el.setAttribute('data-az-ts', s); document.dispatchEvent(new CustomEvent('az-ts', { detail: { el: el, s: s, code: code } })); } catch (e) {}
    }
    function wrap() {
      var ts = window.turnstile; if (!ts || ts.__az || typeof ts.render !== 'function') return;
      var orig = ts.render;
      ts.render = function (el, opt) {
        try {
          opt = Object.assign({}, opt || {}, {
            appearance: 'always',
            size: 'flexible',
            theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
            language: EN ? 'en' : 'zh-cn'
          });
          var cb = opt.callback, ex = opt['expired-callback'], er = opt['error-callback'], bi = opt['before-interactive-callback'];
          opt.callback = function () { emit(el, 'ok'); return cb && cb.apply(this, arguments); };
          opt['expired-callback'] = function () { emit(el, 'wait'); return ex && ex.apply(this, arguments); };
          opt['error-callback'] = function (code) { emit(el, 'err', code); return er && er.apply(this, arguments); };
          opt['before-interactive-callback'] = function () { emit(el, 'click'); return bi && bi.apply(this, arguments); };
          emit(el, 'wait');
        } catch (e) {}
        return orig.call(this, el, opt);
      };
      ts.__az = true;
    }
    /* 脚本的 load 事件在 document 捕获阶段先于组件自己的 onload（组件在 onload 里才调 render） */
    document.addEventListener('load', function (e) { if (e.target && e.target.id === 'cf-turnstile') wrap(); }, true);
    window.__azWrapTs = wrap;
  } catch (e) {}
})();

/* 2026-10-29: visible verification, bounded SDK retries, explicit manual reset. */
(function () {
  'use strict';
  if (window.__ainzyTsRecovery) return;
  window.__ainzyTsRecovery = true;
  var sdkUrl = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  var retries = 0, sdkTimer = null, retryTimer = null, widgetTimer = null;
  var sdkNode = null, panel = null, lastManual = 0, loading = false;
  var english = false;
  try { english = /^en/i.test(localStorage.getItem('i18nextLng') || ''); } catch (e) {}
  function form() {
    if (!/^\/(sign-in|login|sign-up|register|forgot-password|reset)/.test(location.pathname)) return null;
    return document.querySelector('form');
  }
  function hide() { if (panel) panel.hidden = true; }
  function message(text) {
    var f = form(); if (!f) return;
    if (!panel || !panel.isConnected || !f.contains(panel)) {
      panel = document.createElement('div'); panel.className = 'az-ts-recovery';
      panel.style.cssText = 'font-size:13px;line-height:1.6;text-align:center;padding:8px 0;color:inherit';
      panel.setAttribute('role', 'status'); panel.setAttribute('aria-live', 'polite');
      var label = document.createElement('span'); label.className = 'az-ts-recovery-text';
      var button = document.createElement('button'); button.type = 'button';
      button.className = 'az-ts-reload';
      button.textContent = english ? 'Reload verification' : '重新加载验证';
      button.style.cssText = 'display:inline-block;margin-left:6px;text-decoration:underline;cursor:pointer;font:inherit;color:inherit';
      button.addEventListener('click', manual);
      panel.appendChild(label); panel.appendChild(button);
      var anchor = f.querySelector('[data-az-ts]') || f.querySelector('button[type="submit"]');
      if (anchor && anchor.parentElement && anchor.parentElement.classList.contains('az-ts-wrap')) anchor = anchor.parentElement;
      if (anchor) anchor.insertAdjacentElement('afterend', panel); else f.appendChild(panel);
    }
    panel.querySelector('.az-ts-recovery-text').textContent = text;
    panel.hidden = false;
  }
  function slowMessage() {
    message(english ? 'Verification is taking longer than expected.' : '验证服务连接较慢，请稍候或重试。');
  }
  function clearSdkTimers() {
    clearTimeout(sdkTimer); clearTimeout(retryTimer); sdkTimer = null; retryTimer = null;
  }
  function armSdk() {
    clearTimeout(sdkTimer);
    sdkTimer = setTimeout(function () { if (!window.turnstile) failSdk(); }, 15000);
  }
  function replaceSdk() {
    var previous = sdkNode;
    if (!previous || !previous.isConnected) return;
    var next = document.createElement('script');
    for (var i = 0; i < previous.attributes.length; i++) {
      var attr = previous.attributes[i];
      if (attr.name !== 'src') next.setAttribute(attr.name, attr.value);
    }
    next.async = previous.async; next.defer = previous.defer;
    if (previous.nonce) next.nonce = previous.nonce;
    next.onload = previous.onload; next.onerror = previous.onerror;
    next.src = sdkUrl;
    observeSdk(next);
    previous.parentNode.replaceChild(next, previous);
  }
  function failSdk() {
    clearTimeout(sdkTimer); loading = false;
    message(english ? 'Could not load verification.' : '验证组件暂未加载成功。');
    if (window.turnstile || retryTimer || retries >= 2 || !sdkNode || !sdkNode.isConnected || !form()) return;
    retries++;
    retryTimer = setTimeout(function () {
      retryTimer = null;
      if (window.turnstile || !sdkNode || !sdkNode.isConnected || !form()) return;
      loading = true; replaceSdk();
    }, retries * 1000);
  }
  function observeSdk(node) {
    if (!node || node.tagName !== 'SCRIPT' || node.id !== 'cf-turnstile' || node.__ainzyTsObserved) return;
    node.__ainzyTsObserved = true; sdkNode = node; loading = true;
    node.addEventListener('error', failSdk);
    node.addEventListener('load', function () {
      if (!window.turnstile) { failSdk(); return; }
      clearSdkTimers(); loading = false; hide();
    });
    if (!window.turnstile) armSdk();
  }
  function manual() {
    var now = Date.now(); if (now - lastManual < 1000) return; lastManual = now;
    clearSdkTimers(); clearTimeout(widgetTimer);
    var ts = window.turnstile;
    if (ts && typeof ts.reset === 'function') {
      var boxes = document.querySelectorAll('[data-az-ts]'), reset = false;
      for (var i = 0; i < boxes.length; i++) {
        if (!boxes[i].closest('form')) continue;
        try { ts.reset(boxes[i]); reset = true; } catch (e) {}
      }
      if (!reset) { try { ts.reset(); reset = true; } catch (e) {} }
      if (reset) {
        message(english ? 'Reloading verification…' : '正在重新加载验证…');
        widgetTimer = setTimeout(slowMessage, 25000); return;
      }
    }
    if (!sdkNode || !sdkNode.isConnected || loading) { slowMessage(); return; }
    retries = 0; loading = true; replaceSdk();
    message(english ? 'Reloading verification…' : '正在重新加载验证…');
  }
  document.addEventListener('az-ts', function (e) {
    var d = e.detail || {}; if (!d.el || !d.el.closest('form')) return;
    clearTimeout(widgetTimer);
    if (d.s === 'ok' || d.s === 'click') { hide(); return; }
    if (d.s === 'err') {
      var code = String(d.code || '');
      if (code === '110200') message(english ? 'This hostname is not enabled for verification. Contact support (110200).' : '当前网址未获验证服务授权，请联系站点客服（110200）。');
      else message(english ? 'Verification could not finish. Please retry.' : '验证暂未完成，请重新加载验证。');
      return;
    }
    widgetTimer = setTimeout(slowMessage, 25000);
  });
  new MutationObserver(function (records) {
    for (var i = 0; i < records.length; i++) {
      for (var j = 0; j < records[i].addedNodes.length; j++) observeSdk(records[i].addedNodes[j]);
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
  observeSdk(document.getElementById('cf-turnstile'));
  window.addEventListener('pagehide', function () { clearSdkTimers(); clearTimeout(widgetTimer); });
})();

/* ===== 沫白兜底：强制把首页 iframe 的旧沙箱域名改回当前域名 + sharecode =====
   发布平台 public 域名的旧 server 会返回写死的 3000-01bebb... 沙箱域名（不带 sharecode），
   导致首访 403 白屏/滑不动。这里定时 + 监听，双保险覆盖 React 异步写入的 localStorage 和 iframe.src。 */
(function () { try {
  'use strict';
  var OLD = /^https:\/\/3000-[\w-]+\.e2b\.[\w.-]*sandbox\.cloudstudio\.club/;
  function share() {
    try { var m = location.search.match(/[?&]sharecode=([^&]+)/); return m ? '?sharecode=' + encodeURIComponent(m[1]) : ''; }
    catch (e) { return ''; }
  }
  function target() { return location.origin + '/mobai/media/home.html' + share(); }
  function patchStorage() {
    try {
      var v = localStorage.getItem('home_page_content');
      if (v && OLD.test(v)) { localStorage.setItem('home_page_content', target()); return true; }
    } catch (e) {}
    return false;
  }
  function patchIframe() {
    try {
      var fs = document.querySelectorAll('iframe');
      for (var i = 0; i < fs.length; i++) {
        if (fs[i].src && OLD.test(fs[i].src)) fs[i].src = target();
      }
    } catch (e) {}
  }
  // 立即 + 高频轮询前 6 秒（覆盖 React 异步渲染），之后低频兜底
  patchStorage(); patchIframe();
  var n = 0, iv = setInterval(function () {
    patchStorage(); patchIframe();
    if (++n > 120) clearInterval(iv);
  }, 50);
  setTimeout(function () { patchStorage(); patchIframe(); }, 3000);
  setTimeout(function () { patchStorage(); patchIframe(); }, 6000);
} catch (e) {} })();
