/* 沫白 · GitHub Pages 纯静态假后端 (Service Worker)
   把原 server.py 的所有 /api/* 接口翻译到浏览器内，纯静态托管即可运行。*/
'use strict';
var PREFIX = '/mobai';
var TOKEN = 'demo-access-token-mobai';
var FAKE_KEY = 'sk-mobai-DEMO-0000000000000000000000000000';
var HEADER_MODULES = '{"home": true, "console": true, "pricing": {"enabled": true, "requireAuth": false}, "rankings": {"enabled": false, "requireAuth": true}, "docs": true, "about": false}';
var SIDEBAR = '{"chat":{"enabled":true,"playground":true,"chat":false},"console":{"enabled":true,"detail":true,"token":true,"log":true,"midjourney":false,"task":false},"personal":{"enabled":true,"topup":false,"personal":true},"admin":{"enabled":true,"channel":true,"models":true,"deployment":false,"redemption":false,"user":true,"subscription":false,"setting":true}}';

function now() { return Math.floor(Date.now() / 1000); }
function authBundle() {
  var t = now();
  return { access_token: TOKEN, token_type: 'Bearer', access_expires_at: t + 86400,
    user: { id: 1, username: '沫白用户', role: 100, email: 'demo@mobai.local' },
    session: { sid: 'demo-sid-0001', current: true, login_method: 'password', ip: '127.0.0.1',
      user_agent: 'Mozilla/5.0', created_at: t - 3600, last_active_at: t, expires_at: t + 86400 } };
}
function jwt(ok, data, msg) {
  var body = JSON.stringify({ success: ok, data: data, message: msg || '' });
  return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
function statusObj() {
  return { data: { HeaderNavModules: HEADER_MODULES, SidebarModulesAdmin: SIDEBAR,
    announcements: [{ content: '欢迎来到沫白 API —— 这是一个演示空壳。所有数据均为假数据。',
      extra: '演示', publishDate: '2026-11-24T01:00:00+08:00', type: 'success' }],
    version: 'demo', system_name: '沫白 API', logo: PREFIX + '/logo.png',
    demo_site_enabled: true, display_token_stat_enabled: true }, success: true };
}
// 登录分流：登录页 /sign-in 发来的 refresh 返回 401（让原版登录页显示），其余 200。
function isSignInPage(event) {
  var ref = '';
  try { ref = event.request.referrer || ''; } catch (e) {}
  if (!ref && event.clientId) { try { ref = (self.clients && clients.get) ? '' : ''; } catch (e) {} }
  return /\/sign-in|\/sign-up|\/register|\/login/.test(ref);
}
function fakeApi(event, path, method) {
  var refSignIn = isSignInPage(event);

  if (path === '/api/user/auth/refresh') {
    if (refSignIn) return new Response(JSON.stringify({ success: false, message: 'unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } });
    return jwt(true, authBundle());
  }
  if (path === '/api/user/login' || path === '/api/user/register' || path === '/api/user/auth/login')
    return jwt(true, authBundle(), 'ok');
  if (path === '/api/user/send_verification') return jwt(true, true, '演示验证码: 123456');
  if (path === '/api/user/logout') return jwt(true, null);

  if (path === '/api/status') return jwt(true, statusObj().data);
  if (path === '/api/setup') return jwt(true, { status: true, root_init: true, database_type: '' });
  if (path === '/api/notice') return jwt(true, statusObj().data.announcements[0].content);
  if (path === '/api/home_page_content') return jwt(true, self.location.origin + PREFIX + '/media/home.html');
  if (path === '/api/user/self') return jwt(true, { id: 1, email: 'demo@mobai.local', username: '沫白用户', role: 100, status: 1, quota: 500000, used_quota: 12345 });
  if (path === '/api/user/self/groups') return jwt(true, ['默认分组']);
  if (path === '/api/user/token') return jwt(true, { key: FAKE_KEY });

  if (path.indexOf('/api/token/') === 0 || path === '/api/token') {
    var t = now();
    var fakeToken = { id: 1, user: 1, name: '沫白演示 Key', key: FAKE_KEY, status: 1,
      remain_quota: 500000, unlimited_quota: false, used_quota: 12345, group: '默认分组', models: '',
      created_time: t - 86400, expired_time: t + 2592000, accessed_time: t - 3600,
      model_limits_enabled: false, created_at: t - 86400, last_used_time: t - 3600 };
    return jwt(true, { items: [fakeToken], total: 1 });
  }
  // /api/pricing → 读静态快照 pricing.json
  if (path === '/api/pricing') {
    return fetch(PREFIX + '/data/pricing.json').then(function (r) {
      return new Response(r.body, { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
    }).catch(function () { return jwt(true, { data: [], usable_group: {}, group_ratio: {} }); });
  }
  if (path === '/api/user/models') {
    return fetch(PREFIX + '/data/pricing.json').then(function (r) { return r.json(); })
      .then(function (p) { return jwt(true, (p.data || []).map(function (x) { return x.model_name; })); })
      .catch(function () { return jwt(true, []); });
  }
  // 其余 /api/* 一律 200 空成功，杜绝原生 404 刷屏
  return jwt(true, [], 'demo empty');
}
function fakeExt(path) {
  if (path === '/ainzy-ext/rt') return new Response(JSON.stringify({ success: true,
    w60: { requests: 42 }, w300: { requests: 210 },
    top_models_5m: [{ model: 'gpt-4o', requests: 18 }, { model: 'deepseek-chat', requests: 12 }] }),
    { status: 200, headers: { 'Content-Type': 'application/json' } });
  return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method === 'OPTIONS') {
    event.respondWith(new Response('', { status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS', 'Access-Control-Allow-Headers': '*' } }));
    return;
  }
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 外链不管
  var full = url.pathname;
  // 归一：去掉 /mobai 前缀再判断
  var path = full.indexOf(PREFIX + '/') === 0 ? full.slice(PREFIX.length) : full;
  // API 假后端（无论 /api 还是 /mobai/api）
  if (path.indexOf('/api/') === 0 || path === '/api') { event.respondWith(fakeApi(event, path, req.method)); return; }
  if (path.indexOf('/ainzy-ext/') === 0) { event.respondWith(fakeExt(path)); return; }
  // PUT/PATCH/DELETE 兜底
  if (req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE') {
    event.respondWith(jwt(true, null, 'demo ok')); return;
  }
  // 静态资源兜底重写：遗漏的绝对路径（/ainzy-web, /ainzy-assets, /media, /logo, /favicon, /data）
  // 若请求路径没有 /mobai 前缀但是本站静态资源，补前缀再取。
  if (full.indexOf(PREFIX + '/') !== 0 && /^\/(ainzy-web|ainzy-assets|media|data|logo|favicon)/.test(full)) {
    event.respondWith(fetch(PREFIX + full + url.search)); return;
  }
  // 其余交回网络（含 /mobai/xxx 真实静态文件、SPA 深链）
  // 注意：静态资源（wasm/riv/字体）不拦截，交给浏览器原生取，避免 ReadableStream 在 sandbox iframe 下失效
});

self.addEventListener('install', function (e) { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(self.clients.claim());
});
