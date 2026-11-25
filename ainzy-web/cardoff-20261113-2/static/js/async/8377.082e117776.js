"use strict";(self.rspackChunknewapi_web=self.rspackChunknewapi_web||[]).push([[8377],{49840(e,t,r){var l=r(47373),n=r(57491),o=r(49049),a=r(69981);let s=`
<style>
  :host {
    display: block;
    width: 100%;
    color: inherit;
    font: inherit;
  }

  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  img,
  video,
  iframe {
    max-width: 100%;
  }

  iframe {
    border: 0;
  }
</style>
`,i={ADD_ATTR:["allowfullscreen","autoplay","class","controls","default","id","kind","label","loading","loop","muted","playsinline","poster","preload","referrerpolicy","rel","srclang","style","target"],ADD_TAGS:["audio","iframe","picture","source","style","track","video"],FORBID_ATTR:["srcdoc"],FORBID_TAGS:["base","embed","link","meta","object","script"],FORCE_BODY:!0};function c(e){let t=document.documentElement.classList.contains("dark");e.classList.toggle("dark",t)}function u(e){let t=(0,o.useRef)(null);return(0,o.useEffect)(()=>{let r=t.current;if(!r)return;let l=r.shadowRoot??r.attachShadow({mode:"open"}),n=[...document.head.querySelectorAll('style, link[rel="stylesheet"]')].map(e=>e.cloneNode(!0)),o=document.createElement("div");c(o),o.innerHTML=e.html;let a=document.createElement("template");a.innerHTML=s,l.replaceChildren(...n,a.content,o);let i=new MutationObserver(()=>c(o));return i.observe(document.documentElement,{attributes:!0,attributeFilter:["class"]}),()=>i.disconnect()},[e.html]),(0,l.jsx)("div",{ref:t,className:(0,a.cn)("block w-full",e.className)})}function d(e){let t=e.variant??"inline",r=(0,o.useMemo)(()=>(function(e,t){if("isolated"===t){var r=n.A.sanitize(e,i);if("u"<typeof document)return r;let t=document.createElement("template");return t.innerHTML=r,t.content.querySelectorAll('a[target="_blank"]').forEach(e=>{let t=new Set(e.getAttribute("rel")?.split(/\s+/).filter(Boolean)??[]);t.add("noopener"),t.add("noreferrer"),e.setAttribute("rel",[...t].join(" "))}),t.content.querySelectorAll("iframe").forEach(e=>{e.removeAttribute("srcdoc"),e.setAttribute("sandbox","allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation"),e.setAttribute("referrerpolicy","no-referrer"),e.hasAttribute("loading")||e.setAttribute("loading","lazy")}),t.innerHTML}return n.A.sanitize(e)})(e.content,t),[e.content,t]);return"isolated"===t?(0,l.jsx)(u,{className:e.className,html:r}):(0,l.jsx)("div",{className:(0,a.cn)("prose prose-neutral dark:prose-invert max-w-none",e.className),dangerouslySetInnerHTML:{__html:r}})}r.d(t,{HtmlContent:()=>d})}}]);