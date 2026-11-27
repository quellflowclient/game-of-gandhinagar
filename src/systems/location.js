import { h } from "../ui/dom.js";

// Consented real-world (GPS) location sharing.
// - Asked once at game start; "Not now" is allowed and the question comes back
//   after REASK_MS in the same visit (at most twice per visit) and again on the next
//   visit.
// - Once the person allows it (or the browser already has permission) we never ask
//   again; we just keep sharing while they play.
// - If the browser blocks it, we stop asking (browsers do not let pages re-prompt).
// - Only signed-in players are uploaded, at most every 15 s (or after 20 m moved),
//   and only admins can read it (supabase/scale-500.sql: admin_locations).
const KEY = "gog.location.v1", REASK_MS = 5 * 60 * 1000, FIRST_ASK_MS = 1500, MAX_ASKS_PER_VISIT = 2;
const SEND_MS = 15000, HEARTBEAT_MS = 60000, MOVE_M = 20;

const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const save = (v) => { try { localStorage.setItem(KEY, JSON.stringify({ ...load(), ...v })); } catch {} };
const metres = (a, b) => {
  const R = 6371000, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

export function createLocationSharing({ backend, isSignedIn, toast }) {
  const supported = typeof navigator !== "undefined" && "geolocation" in navigator && window.isSecureContext !== false;
  let watchId = null, latest = null, lastSent = null, asks = 0, reaskTimer = null, dialog = null, sending = false, begun = false;

  async function browserState() {
    try { return (await navigator.permissions?.query({ name: "geolocation" }))?.state || "prompt"; } catch { return "prompt"; }
  }
  async function upload(force = false) {
    if (!latest || sending || !isSignedIn() || !backend.updateLocation) return;
    const now = Date.now();
    if (!force && lastSent && now - lastSent.at < SEND_MS) return;
    if (!force && lastSent && metres(lastSent, latest) < MOVE_M && now - lastSent.at < HEARTBEAT_MS) return;
    sending = true;
    try { await backend.updateLocation(latest.lat, latest.lng, latest.accuracy); lastSent = { ...latest, at: now }; }
    catch (e) { console.warn("Location:", e.message); }
    finally { sending = false; }
  }
  function start() {
    if (!supported || watchId != null) return;
    watchId = navigator.geolocation.watchPosition(
      (pos) => { latest = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy || 0) }; save({ state: "granted" }); upload(); },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) { save({ state: "denied" }); stop(); }
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 });
  }
  function stop() { if (watchId != null) navigator.geolocation.clearWatch(watchId); watchId = null; }

  function close() { dialog?.remove(); dialog = null; }
  function ask() {
    if (dialog || watchId != null || asks >= MAX_ASKS_PER_VISIT) return;
    // Give missions, forms and metro transfers their own turn on a small screen.
    // Waiting for a free screen does not use up either permission question.
    if(document.hidden||document.querySelector('.sheet-back,dialog[open]')||['on-landing','game-menu-open','metro-in-transit'].some(c=>document.body.classList.contains(c))){
      clearTimeout(reaskTimer);reaskTimer=setTimeout(maybeAsk,1000);return;
    }
    asks++;
    const allow = h("button", { class: "loc-btn primary", type: "button", onclick: () => { close(); save({ state: "asked" }); start(); } }, "Allow location");
    const later = h("button", { class: "loc-btn", type: "button", onclick: () => {
      close(); save({ state: "skipped", skippedAt: Date.now() });
      clearTimeout(reaskTimer); reaskTimer = setTimeout(() => maybeAsk(), REASK_MS);
    } }, "Not now");
    dialog = h("div", { class: "loc-ask", role: "dialog", "aria-modal": "false", "aria-labelledby": "loc-ask-title" },
      h("div", { class: "loc-card" },
        h("div", { class: "loc-icon", "aria-hidden": "true" }, "📍"),
        h("h2", { id: "loc-ask-title" }, "Share your location?"),
        h("p", {}, "The game admins will be able to see your exact live location while you play. This helps keep the campus safe. You can skip this now."),
        h("div", { class: "loc-actions" }, later, allow)));
    document.body.append(dialog);
    later.focus({ preventScroll: true });
  }
  async function maybeAsk() {
    if (!supported) return;
    const state = await browserState();
    if (state === "granted") return start();      // already allowed: never ask again
    if (state === "denied") return;               // blocked in the browser: don't nag
    ask();
  }

  injectStyle();
  return {
    // Call once when the player enters the game.
    begin() { if(begun)return;begun=true;reaskTimer=setTimeout(maybeAsk, FIRST_ASK_MS); },
    // Call after sign-in so a location captured as a visitor is shared right away.
    signedIn() { upload(true); },
    signedOut() { lastSent = null; },
    active: () => watchId != null,
  };
}

function injectStyle() {
  if (document.getElementById("loc-ask-style")) return;
  const s = document.createElement("style");
  s.id = "loc-ask-style";
  s.textContent = `.loc-ask{position:fixed;inset:auto 0 0 0;display:flex;justify-content:center;padding:16px;z-index:9000;pointer-events:none}
.loc-card{pointer-events:auto;width:min(420px,100%);background:#0f2a22;color:#f3efe2;border:1px solid rgba(214,180,92,.45);border-radius:16px;padding:18px 18px 14px;box-shadow:0 18px 40px rgba(0,0,0,.45);font:14px/1.45 Inter,system-ui,sans-serif;animation:loc-in .25s ease-out}
.loc-card h2{margin:4px 0 6px;font-size:18px;color:#f6d98a}.loc-card p{margin:0 0 14px;color:#d9d4c3}.loc-icon{font-size:24px}
.game-panel-open .loc-ask,.game-menu-open .loc-ask,.metro-in-transit .loc-ask{visibility:hidden}
.loc-actions{display:flex;gap:10px;justify-content:flex-end}.loc-btn{min-height:44px;padding:0 18px;border-radius:10px;border:1px solid rgba(243,239,226,.35);background:transparent;color:#f3efe2;font:600 14px Inter,system-ui,sans-serif;cursor:pointer}
.loc-btn.primary{background:#d6b45c;border-color:#d6b45c;color:#13231d}.loc-btn:focus-visible{outline:2px solid #f6d98a;outline-offset:2px}
@keyframes loc-in{from{transform:translateY(16px);opacity:0}to{transform:none;opacity:1}}
@media (prefers-reduced-motion:reduce){.loc-card{animation:none}}`;
  document.head.append(s);
}
