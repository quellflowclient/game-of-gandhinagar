// Tiny DOM helpers: element builder, bottom-sheet panels, toasts.
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "style" && typeof v === "object") {
      for (const [sk, sv] of Object.entries(v)) sk.startsWith("--") ? el.style.setProperty(sk, sv) : (el.style[sk] = sv);
    }
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "html") el.innerHTML = v;
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const initials = (name = "") => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";
export const ago = (t) => {
  const s = Math.max(1, Math.round((Date.now() - t) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
};

// ---------- bottom-sheet panel ----------
let current = null;
const closeFns = [];
export function onPanelClose(fn) { closeFns.push(fn); }

// Shouted ALL-CAPS copy reads as noise; panels use calm sentence case.
const SHOUT=/^[^a-z]*[A-Z]{3,}[^a-z]*$/;
export function calmCase(text){if(typeof text!=='string'||!SHOUT.test(text))return text;const t=text.toLowerCase().replace(/(^|[.!?·]\s*)([a-z])/g,(m,a,b)=>a+b.toUpperCase());return t.replace(/\b(ai|ldrp|kh-5|id|gift|brts|otp|upi|itr|sos)\b/gi,w=>w.toUpperCase()).replace(/\b(gandhinagar|mahatma|mandir|gujarat|india|paaji|kh)\b/gi,w=>w[0].toUpperCase()+w.slice(1));}
function calmHeadings(root){root?.querySelectorAll?.('h2,h3,h4').forEach(el=>{if(el.children.length===0)el.textContent=calmCase(el.textContent);});}
export function openPanel(title, body, { wide = false, onClose } = {}) {
  const previousFocus=document.activeElement;
  closePanel();
  document.body.classList.add("game-panel-open");
  title = calmCase(title);
  const sheet = h("section", { class: "sheet" + (wide ? " wide" : ""), role: "dialog", "aria-modal":"true", tabindex:"-1", "aria-label": title },
    h("div", { class: "grip" }),
    h("header", { class: "sheet-head" },
      h("div",{class:"panel-title"},h("span",{class:"panel-kicker"},"GOG / GAME HUB"),h("h2", {}, title)),
      h("button", { class: "esc", type: "button", onclick: closePanel, "aria-label": "Close (Esc)", title: "Close (Esc)" }, "✕")),
    h("div", { class: "sheet-body" }, body));
  const back = h("div", { class: "sheet-back", onclick: (e) => { if (e.target === back) closePanel(); } }, sheet);
  calmHeadings(sheet);
  document.body.append(back);
  current = { back, onClose, previousFocus };
  sheet.focus({preventScroll:true});
  sheet.addEventListener("keydown",e=>{if(e.key==="Escape"){e.stopPropagation();closePanel();return;}if(e.key!=="Tab")return;const nodes=[...sheet.querySelectorAll("button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex=\"0\"]")].filter(n=>n.getClientRects().length);const first=nodes[0],last=nodes.at(-1);if(!first){e.preventDefault();return;}if(e.shiftKey&&(document.activeElement===first||document.activeElement===sheet)){e.preventDefault();last.focus();}else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===sheet)){e.preventDefault();first.focus();}});
  return sheet.querySelector(".sheet-body");
}

export function closePanel() {
  if (!current) return;
  const old=current;current=null;
  old.back.remove();
  document.body.classList.remove("game-panel-open");
  old.onClose?.();
  if(old.previousFocus?.isConnected)old.previousFocus.focus({preventScroll:true});
  closeFns.forEach((f) => f());
}
export const panelOpen = () => !!current;

// Replace the body of the open panel (used by multi-step panels).
export function setPanelBody(node) {
  if (!current) return;
  const b = current.back.querySelector(".sheet-body");
  b.replaceChildren(node);
  calmHeadings(b);
}

// ---------- toasts ----------
export function toast(msg, kind = "info", ms = 3200, action) {
  let box = document.getElementById("toasts");
  if (!box) { box = h("div", { id: "toasts" }); document.body.append(box); }
  const t = h("div", { class: `toast ${kind}` }, h("span", {}, msg),
    action ? h("button", { type: "button", onclick: () => { action.fn(); t.remove(); } }, action.label) : null);
  box.append(t);
  setTimeout(() => t.classList.add("out"), ms);
  setTimeout(() => t.remove(), ms + 400);
}

export function chips(options, selected, { max = 1, onChange } = {}) {
  // options: [{id,label}] or strings. selected: array of ids.
  const sel = new Set(selected);
  const wrap = h("div", { class: "chips" });
  const render = () => {
    wrap.replaceChildren(...options.map((o) => {
      const id = typeof o === "string" ? o : o.id, label = typeof o === "string" ? o : o.label;
      return h("button", {
        type: "button", class: "chip-btn" + (sel.has(id) ? " on" : ""),
        onclick: () => {
          if (max === 1) { sel.clear(); sel.add(id); }
          else if (sel.has(id)) sel.delete(id);
          else if (sel.size < max) sel.add(id);
          else return toast(`Pick up to ${max}.`);
          render();
          onChange?.([...sel]);
        },
      }, label);
    }));
  };
  render();
  return wrap;
}
