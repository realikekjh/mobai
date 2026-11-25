/* ainzy-avatar：换头像（2026-11-19 [n-24] 草稿一，2026-11-20 老板「满意，并入正式」后对所有用户生效）
 * 接口 /ainzy-ext/avatar（ainzy-ext/avatar_ext.py）。
 * 显示：右上角头像、下拉菜单、手机抽屉、个人资料页的首字母头像换成自己的头像；使用日志等表格里的头像不动。
 * 换头像：右上角下拉菜单「更换头像」，或点个人资料页的大头像。
 * 选图后在浏览器里裁成正方形、缩到 256x256，再压成 WebP（不支持就 JPEG），≤200KB 才上传。HEIC 按需加载 heic2any 转码。
 */
(function () {
  if (/^\/media\//.test(location.pathname)) return;
  if (window.__azAvatar) return;
  window.__azAvatar = 1;

  var API = "/ainzy-ext/avatar";
  var KEY = "az-av";
  var HEIC = "/ainzy-assets/heic2any.0.0.4.min.js";
  var cur = null; // {uid, v, data}

  function auth() { return (window.__azAuth && window.__azAuth()) || ""; }
  function tagOf(a) { return a ? String(a.length) + a.slice(-8) : ""; }
  // 缓存的头像只给同一个登录凭证用；换了账号先不显示，等服务器核对
  function shown() { var a = auth(); return cur && cur.data && (!a || !cur.tag || cur.tag === tagOf(a)) ? cur : null; }
  function zh() {
    var l = "";
    try { l = localStorage.getItem("i18nextLng") || ""; } catch (e) {}
    return !/^en/i.test(l || navigator.language || ""); // html lang 固定是 en，不能用
  }
  function T(a, b) { return zh() ? a : b; }

  try { cur = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { cur = null; }

  var css = [
    '[data-slot="avatar"].az-av-on [data-slot="avatar-fallback"]{visibility:hidden}',
    '[data-slot="avatar"] img.az-av-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:inherit;z-index:1;pointer-events:none}',
    '.az-av-click{cursor:pointer}',
    '.az-av-click:hover::before{content:"";position:absolute;inset:0;border-radius:inherit;background:rgba(0,0,0,.25);z-index:2}',
    '#az-av-dlg{position:fixed;inset:0;z-index:2147483600;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45)}',
    '#az-av-dlg .bx{background:var(--background,#fff);color:var(--foreground,#111);border-radius:16px;padding:20px;width:min(320px,calc(100vw - 32px));box-shadow:0 10px 40px rgba(0,0,0,.25);text-align:center;font-size:14px}',
    '#az-av-dlg .pv{width:112px;height:112px;border-radius:50%;margin:4px auto 14px;background:#ddd center/cover no-repeat;display:flex;align-items:center;justify-content:center;font-size:36px;font-weight:600;color:#fff}',
    '#az-av-dlg .tt{font-size:16px;font-weight:600;margin-bottom:12px}',
    '#az-av-dlg .ms{min-height:20px;margin:6px 0 10px;color:#888;font-size:12.5px}',
    '#az-av-dlg .ms.err{color:#e5484d}',
    '#az-av-dlg button{display:block;width:100%;height:38px;border-radius:10px;border:1px solid var(--border,#ddd);background:transparent;color:inherit;font-size:14px;margin-top:8px;cursor:pointer}',
    '#az-av-dlg button.pri{background:var(--primary,#111);color:var(--primary-foreground,#fff);border-color:transparent}',
    '#az-av-dlg button:disabled{opacity:.5;cursor:default}',
    '#az-av-file{position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0}'
  ].join("\n");
  var st = document.createElement("style");
  st.id = "az-av-css";
  st.textContent = css;
  (document.head || document.documentElement).appendChild(st);

  // ---------- 哪些头像算「自己的」 ----------
  function meText() {
    var t = document.querySelector('header [data-slot="avatar"] [data-slot="avatar-fallback"]') ||
      document.querySelector('[data-slot="dropdown-menu-trigger"] [data-slot="avatar-fallback"]');
    return t ? (t.textContent || "").trim() : "";
  }
  function mine(av) {
    // 顶栏、用户下拉菜单、手机抽屉：一定是自己
    if (av.closest('header,[data-slot="dropdown-menu-trigger"],[data-slot="dropdown-menu-content"],[data-slot="sheet-content"]')) return true;
    // 其余只认个人资料页 main 里的大头像；表格、日志卡片、聊天消息里的都不动
    var m = av.closest("main");
    if (!m || !/^\/profile/.test(location.pathname)) return false;
    var x = av.parentElement;
    while (x && x !== m) {
      if (x.matches('table,[role="table"],[data-slot="table"]') || /message|log/i.test(x.className || "")) return false;
      x = x.parentElement;
    }
    return true;
  }

  function paint() {
    var avs = document.querySelectorAll('[data-slot="avatar"]');
    for (var i = 0; i < avs.length; i++) {
      var av = avs[i];
      if (!mine(av)) continue;
      var img = av.querySelector("img.az-av-img");
      var sh = shown();
      if (sh) {
        if (!img) {
          img = document.createElement("img");
          img.className = "az-av-img";
          img.alt = "";
          av.appendChild(img);
        }
        if (img.getAttribute("src") !== sh.data) img.setAttribute("src", sh.data);
        av.classList.add("az-av-on");
      } else {
        if (img) img.parentNode.removeChild(img);
        av.classList.remove("az-av-on");
      }
      // 个人资料页大头像：点击就能换
      if (/^\/profile/.test(location.pathname) && av.closest("main") && !av.getAttribute("data-az-av-click")) {
        av.setAttribute("data-az-av-click", "1");
        av.classList.add("az-av-click");
        av.title = T("更换头像", "Change avatar");
        av.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); openDlg(); }, true);
      }
    }
    menuItem();
  }

  // 右上角下拉菜单加「更换头像」
  function menuItem() {
    var mc = document.querySelector('[data-slot="dropdown-menu-content"]');
    if (!mc || mc.querySelector(".az-av-mi")) return;
    if (!mc.querySelector('[data-slot="avatar"]')) return; // 只加在用户菜单里
    var tpl = mc.querySelector('[data-slot="dropdown-menu-item"]');
    if (!tpl) return;
    var it = document.createElement("div");
    it.className = (tpl.className || "") + " az-av-mi";
    it.setAttribute("role", "menuitem");
    it.setAttribute("tabindex", "-1");
    it.setAttribute("data-slot", "dropdown-menu-item");
    it.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg><span>' + T("更换头像", "Change avatar") + "</span>";
    it.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      try { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); } catch (x) {}
      setTimeout(openDlg, 50);
    }, true);
    tpl.parentNode.insertBefore(it, tpl);
  }

  var q = null;
  function schedule() { if (!q) q = setTimeout(function () { q = null; try { paint(); } catch (e) {} }, 80); }
  function start() {
    paint();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    refresh();
  }

  // ---------- 接口 ----------
  function save(j) {
    cur = j && j.has ? { uid: j.uid, v: j.v, data: j.data, tag: tagOf(auth()) } : null;
    try { if (cur) localStorage.setItem(KEY, JSON.stringify(cur)); else localStorage.removeItem(KEY); } catch (e) {}
    paint();
  }
  var tries = 0;
  function refresh() {
    var a = auth();
    if (!a) { if (tries++ < 20) setTimeout(refresh, 1000); return; }
    // 每个标签页 10 分钟内最多核对一次（每次核对 ainzy-ext 都要去 new-api 验一次登录）
    // 换了账号（登录凭证变了）就立刻重新核对，免得显示上一个账号的头像
    try {
      var tag = tagOf(a);
      var ck = (sessionStorage.getItem("az-av-chk") || "").split("|");
      if (ck[0] === tag && Date.now() - (+ck[1] || 0) < 6e5) return;
      sessionStorage.setItem("az-av-chk", tag + "|" + Date.now());
    } catch (e) {}
    fetch(API + "/me", { headers: { Authorization: a, Accept: "application/json" }, credentials: "same-origin" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j || !j.success) return;
        if (!j.has) { save(null); return; }
        if (!cur || cur.uid !== j.uid || cur.v !== j.v || cur.tag !== tagOf(a)) save(j);
      })
      .catch(function () {});
  }

  // ---------- 对话框 ----------
  var dlg = null, fileIn = null, pending = null;
  function msg(t, err) {
    var m = dlg && dlg.querySelector(".ms");
    if (m) { m.textContent = t || ""; m.className = "ms" + (err ? " err" : ""); }
  }
  function setPv(data) {
    var pv = dlg.querySelector(".pv");
    if (data) { pv.style.backgroundImage = "url(" + data + ")"; pv.style.backgroundColor = ""; pv.textContent = ""; }
    else { pv.style.backgroundImage = ""; pv.style.backgroundColor = "#9ca3af"; pv.textContent = meText() || "?"; }
  }
  function closeDlg() { if (dlg) { dlg.remove(); dlg = null; } pending = null; }
  function openDlg() {
    if (!auth()) return;
    closeDlg();
    dlg = document.createElement("div");
    dlg.id = "az-av-dlg";
    dlg.innerHTML = '<div class="bx"><div class="tt">' + T("更换头像", "Change avatar") + '</div><div class="pv"></div>' +
      '<div class="ms"></div>' +
      '<button class="pri" data-a="pick">' + T("选择图片", "Choose image") + "</button>" +
      '<button class="pri" data-a="save" style="display:none">' + T("保存", "Save") + "</button>" +
      '<button data-a="reset">' + T("恢复默认", "Reset to default") + "</button>" +
      '<button data-a="close">' + T("取消", "Cancel") + "</button></div>";
    document.body.appendChild(dlg);
    var sh0 = shown(); setPv(sh0 && sh0.data);
    dlg.querySelector('[data-a="reset"]').disabled = !shown();
    msg(T("支持 JPG、PNG、WebP、HEIC，会自动裁成正方形", "JPG, PNG, WebP or HEIC; cropped to a square"));
    dlg.addEventListener("click", function (e) {
      if (e.target === dlg) { closeDlg(); return; }
      var b = e.target.closest("button");
      if (!b || b.disabled) return;
      var a = b.getAttribute("data-a");
      if (a === "close") closeDlg();
      else if (a === "pick") pick();
      else if (a === "save") upload();
      else if (a === "reset") reset();
    });
  }
  function busy(on) {
    if (!dlg) return;
    var bs = dlg.querySelectorAll("button");
    for (var i = 0; i < bs.length; i++) if (bs[i].getAttribute("data-a") !== "close") bs[i].disabled = !!on;
    if (!on) dlg.querySelector('[data-a="reset"]').disabled = !shown() && !pending;
  }
  function pick() {
    // 文件框挂在 body 上、不限 type（安卓相册有时 type 为空，会被 accept 过滤掉）
    if (!fileIn) {
      fileIn = document.createElement("input");
      fileIn.type = "file";
      fileIn.id = "az-av-file";
      fileIn.accept = "image/*,.heic,.heif";
      document.body.appendChild(fileIn);
      fileIn.addEventListener("change", function () {
        var f = fileIn.files && fileIn.files[0];
        fileIn.value = "";
        if (f) handle(f);
      });
    }
    fileIn.click();
  }

  // ---------- 图片处理 ----------
  function readBuf(f) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(r.result); };
      r.onerror = function () { rej(new Error("read")); };
      r.readAsArrayBuffer(f);
    });
  }
  function sniff(buf) {
    var b = new Uint8Array(buf.slice(0, 16));
    var s = String.fromCharCode.apply(null, b);
    if (b[0] === 0xff && b[1] === 0xd8) return "image/jpeg";
    if (s.slice(1, 4) === "PNG") return "image/png";
    if (s.slice(0, 4) === "RIFF" && s.slice(8, 12) === "WEBP") return "image/webp";
    if (s.slice(0, 3) === "GIF") return "image/gif";
    if (s.slice(0, 2) === "BM") return "image/bmp";
    if (s.slice(4, 8) === "ftyp") {
      var br = s.slice(8, 12);
      if (/hei|hev|mif|msf|avi/.test(br)) return /avi/.test(br) ? "image/avif" : "image/heic";
    }
    return "";
  }
  function loadHeic() {
    if (window.heic2any) return Promise.resolve();
    return new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = HEIC;
      s.onload = function () { res(); };
      s.onerror = function () { rej(new Error("heic-lib")); };
      document.head.appendChild(s);
    });
  }
  function decode(blob) {
    if (window.createImageBitmap) {
      return createImageBitmap(blob).catch(function () { return decodeImg(blob); });
    }
    return decodeImg(blob);
  }
  function decodeImg(blob) {
    return new Promise(function (res, rej) {
      var u = URL.createObjectURL(blob), im = new Image();
      im.onload = function () { res(im); };
      im.onerror = function () { URL.revokeObjectURL(u); rej(new Error("decode")); };
      im.src = u;
    });
  }
  function toBlob(cv, type, q) {
    return new Promise(function (res) { cv.toBlob(function (b) { res(b); }, type, q); });
  }
  function shrink(im) {
    var w = im.width || im.naturalWidth, h = im.height || im.naturalHeight, s = Math.min(w, h);
    var cv = document.createElement("canvas");
    cv.width = cv.height = 256;
    var cx = cv.getContext("2d");
    cx.imageSmoothingQuality = "high";
    cx.fillStyle = "#fff"; // 透明 PNG 转 JPEG 时别变黑
    cx.fillRect(0, 0, 256, 256);
    cx.drawImage(im, (w - s) / 2, (h - s) / 2, s, s, 0, 0, 256, 256);
    var tries = [["image/webp", 0.86], ["image/webp", 0.7], ["image/jpeg", 0.85], ["image/jpeg", 0.65]];
    var i = 0;
    function next() {
      if (i >= tries.length) return Promise.reject(new Error("big"));
      var t = tries[i++];
      return toBlob(cv, t[0], t[1]).then(function (b) {
        if (b && b.type === t[0] && b.size <= 200 * 1024) return b;
        return next();
      });
    }
    return next();
  }
  function handle(f) {
    if (!dlg) openDlg();
    busy(true);
    msg(T("正在处理图片…", "Processing…"));
    readBuf(f).then(function (buf) {
      var k = sniff(buf);
      var blob = new Blob([buf], { type: k || f.type || "application/octet-stream" });
      if (k === "image/heic") {
        msg(T("正在转换 HEIC 照片…", "Converting HEIC…"));
        return loadHeic().then(function () {
          return window.heic2any({ blob: blob, toType: "image/jpeg", quality: 0.9 });
        }).then(function (r) { return Array.isArray(r) ? r[0] : r; });
      }
      return blob;
    }).then(decode).then(shrink).then(function (b) {
      pending = b;
      var fr = new FileReader();
      fr.onload = function () {
        if (!dlg) return;
        setPv(fr.result);
        dlg.querySelector('[data-a="save"]').style.display = "";
        dlg.querySelector('[data-a="pick"]').style.display = "none";
        busy(false);
        msg(T("看看效果，满意就点「保存」", "Looks good? Tap Save"));
      };
      fr.readAsDataURL(b);
    }).catch(function (e) {
      busy(false);
      var m = e && e.message;
      msg(m === "big" ? T("图片压不到 200KB 以下，换一张试试", "Image too large, try another") :
        m === "heic-lib" ? T("HEIC 转换组件加载失败，请换成 JPG 再试", "HEIC converter failed to load; try a JPG") :
          T("这张图片读不出来，换一张试试（可以先截图再选截图）", "Can't read this image; try another"), true);
    });
  }
  function upload() {
    if (!pending) return;
    busy(true);
    msg(T("正在保存…", "Saving…"));
    fetch(API, { method: "POST", headers: { Authorization: auth(), "Content-Type": pending.type }, body: pending, credentials: "same-origin" })
      .then(function (r) { return r.json().then(function (j) { return [r.status, j]; }); })
      .then(function (x) {
        var j = x[1];
        if (!j || !j.success) throw new Error((j && j.message) || ("HTTP " + x[0]));
        var fr = new FileReader();
        fr.onload = function () {
          save({ has: true, uid: j.uid, v: j.v, data: fr.result });
          closeDlg();
        };
        fr.readAsDataURL(pending);
      })
      .catch(function (e) { busy(false); msg(T("保存失败：", "Save failed: ") + (e && e.message || ""), true); });
  }
  function reset() {
    if (pending && !shown()) { pending = null; openDlg(); return; }
    busy(true);
    msg(T("正在恢复默认…", "Resetting…"));
    fetch(API, { method: "DELETE", headers: { Authorization: auth() }, credentials: "same-origin" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j || !j.success) throw new Error((j && j.message) || "");
        save(null);
        closeDlg();
      })
      .catch(function (e) { busy(false); msg(T("操作失败：", "Failed: ") + (e && e.message || ""), true); });
  }

  // 测试入口：不弹系统选文件框，直接把 File/Blob 交给处理流程
  window.__azAvTest = { open: openDlg, handle: handle, save: upload, reset: reset, state: function () { return { cur: cur && { uid: cur.uid, v: cur.v, len: cur.data.length }, pending: pending && pending.size }; } };

  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start);
})();
