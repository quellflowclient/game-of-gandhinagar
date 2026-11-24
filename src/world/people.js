import * as THREE from "three";
import { createAvatar } from "./avatar.js";
import { placedPlaces, placePos } from "../data/places.js";
import { residentsFor, OPEN_TO } from "../data/content.js";

// AI residents (spawned only around the place you are near, to keep the frame rate up),
// other members' avatars from presence, and HTML name tags above everyone nearby.
const SPAWN_R = 380, DESPAWN_R = 520, PER_PLACE = 9, LABEL_R = 40, MAX_LABELS = 8;

export function createPeople({ scene, camera, labelsEl, onTap, spawns = {}, navigation,lowEnd=false }) {
  const active = new Map(); // id -> person
  const loadedPlaces = new Set();

  function addPerson(data, x, z, home) {
    const safe = navigation ? navigation.safePoint(x, z, data.y || 0) : { x, y: 0, z };
    x = safe.x; z = safe.z;
    const avatar = createAvatar(data.look, data.skin);
    avatar.root.position.set(x, safe.y, z);
    scene.add(avatar.root);
    const el = document.createElement("button");
    el.className = "tag" + (data.ai ? " ai" : " real");
    el.type = "button";
    el.addEventListener("click", (e) => { e.stopPropagation(); onTap?.(person); });
    labelsEl.appendChild(el);
    const person = {
      id: data.id, data, avatar, el, home,
      x, y: safe.y, z, tx: x, tz: z, wait: Math.random() * 3, speed: 0, routeIndex:home?.routeIndex||0,
      bubble: null, bubbleT: 0,
    };
    renderTag(person);
    active.set(data.id, person);
    return person;
  }

  function removePerson(id) {
    const p = active.get(id);
    if (!p) return;
    scene.remove(p.avatar.root);
    p.avatar.dispose?.();
    p.el.remove();
    active.delete(id);
  }

  function renderTag(p) {
    const chip = OPEN_TO.find((o) => o.id === p.data.openTo)?.chip;
    p.el.innerHTML =
      (p.bubble ? `<span class="bubble">${esc(p.bubble)}</span>` : "") +
      (chip ? `<span class="chip">${chip}</span>` : "") +
      `<span class="nm">${p.data.ai ? '<i class="ai-badge">AI</i>' : ""}${esc(p.data.name)}</span>` +
      `<span class="role">${esc(p.data.role || "")}</span>`;
  }

  function say(p, text, seconds = 4) {
    p.bubble = text; p.bubbleT = seconds; renderTag(p);
  }

  // Spawn residents for places near the player, despawn far ones.
  function manage(playerPos) {
    for (const place of placedPlaces()) {
      const { x, z } = placePos(place);
      const d = Math.hypot(playerPos.x - x, playerPos.z - z);
      if (d < SPAWN_R && !loadedPlaces.has(place.id)) {
        loadedPlaces.add(place.id);
        const n = lowEnd?4:place.hub ? PER_PLACE : 4;
        const home = spawns[place.id] || { x, z: z + 40 };
        residentsFor(place, n).forEach((r, i) => {
          const a = (i / n) * Math.PI * 2;
          const anchor = home.residents?.[i];
          if (anchor) addPerson({ ...r, y: anchor.y }, anchor.x, anchor.z, anchor);
          else addPerson(r, home.x + Math.cos(a) * 16, home.z - 6 + Math.sin(a) * 12, { x: home.x, z: home.z - 6, r: 24 });
        });
      } else if (d > DESPAWN_R && loadedPlaces.has(place.id)) {
        loadedPlaces.delete(place.id);
        for (const [id, p] of active) if (p.data.ai && p.data.place === place.id) removePerson(id);
      }
    }
  }

  // Other members, from presence. `members` = [{id, name, role, openTo, look, x, z, ...}]
  function syncMembers(members, selfId) {
    const seen = new Set();
    for (const m of members) {
      if (m.id === selfId || m.x == null) continue;
      seen.add(m.id);
      const p = active.get(m.id);
      if (!p) addPerson({ ...m, ai: false }, m.x, m.z, null);
      else {
        p.data = { ...p.data, ...m, ai: false };
        const safe = navigation ? navigation.safePoint(m.x, m.z, m.y || 0) : m;
        p.tx = safe.x; p.tz = safe.z;
        // Presence is a network position, not an AI route. Honour the sender's
        // deck level even when the interpolation crosses a disconnected area.
        if (navigation && (Math.hypot(p.tx-p.x,p.tz-p.z) > 30 || Math.abs((safe.y || 0)-p.y) > 1)) {
          p.x = safe.x; p.z = safe.z; p.y = safe.y;
        }
        renderTag(p);
      }
    }
    for (const [id, p] of active) if (!p.data.ai && !seen.has(id)) removePerson(id);
  }

  const v = new THREE.Vector3();
  function update(dt, playerPos) {
    for (const p of active.values()) {
      if (p.data.ai && p.home) {
        // Wander: pick a point near home, walk there, wait a bit.
        if (p.wait > 0) p.wait -= dt;
        else if (Math.hypot(p.tx - p.x, p.tz - p.z) < 0.5) {
          if(p.home.route) {
            p.routeIndex=(p.routeIndex+1)%p.home.route.length;
            const next=p.home.route[p.routeIndex];p.tx=next.x;p.tz=next.z;p.wait=0.4;
          } else {
          p.wait = 2 + Math.random() * 5;
          // Reject routes that would cross water, roofs or the cone. Projecting
          // just the destination isn't sufficient: the straight line matters.
          for (let attempt = 0; attempt < 12; attempt++) {
            const a = Math.random() * Math.PI * 2, r = Math.random() * p.home.r;
            const target = { x: p.home.x + Math.cos(a)*r, z: p.home.z + Math.sin(a)*r };
            if (!navigation || navigation.canTravel(p, target)) { p.tx = target.x; p.tz = target.z; break; }
          }
          }
        }
      }
      const dx = p.tx - p.x, dz = p.tz - p.z, d = Math.hypot(dx, dz);
      const near = Math.hypot(playerPos.x - p.x, playerPos.z - p.z);
      // AI residents stop and face you when you come close.
      const stop = p.data.ai && near < 3.5;
      if (d > 0.05 && !stop && (p.wait <= 0 || !p.data.ai)) {
        const sp = p.data.ai ? 1.4 : Math.min(9, d * 3);
        const step = Math.min(d, sp * dt);
        const ox = p.x, oz = p.z;
        if (navigation) navigation.move(p, (dx / d) * step, (dz / d) * step);
        else { p.x += (dx / d) * step; p.z += (dz / d) * step; }
        p.avatar.root.rotation.y = Math.atan2(dx, dz);
        p.speed = dt > 0 ? Math.hypot(p.x-ox,p.z-oz)/dt : 0;
        if (p.data.ai && p.speed < 0.05) { p.tx = p.x; p.tz = p.z; p.wait = 0.5; }
      } else {
        p.speed = 0;
        if (stop) p.avatar.root.rotation.y = Math.atan2(playerPos.x - p.x, playerPos.z - p.z);
      }
      if(navigation){const h=navigation.surface(p.x,p.z,p.y||0);if(h!==undefined)p.y=h;}
      p.avatar.root.position.set(p.x, p.y || 0, p.z);
      // Far people: no shadows, and skip the walk animation unless they are fairly close.
      p.avatar.setShadow?.(near < 22);
      p.avatar.root.visible = near < 160;
      if (near < 70) p.avatar.update(dt, p.speed);
      if (p.bubbleT > 0) { p.bubbleT -= dt; if (p.bubbleT <= 0) { p.bubble = null; renderTag(p); } }
    }
    placeLabels(playerPos);
  }

  // Nearest people get full tags (status, role); the rest get a compact name pill.
  // Tags that would overlap a nearer one are hidden so the screen stays readable.
  function placeLabels(playerPos) {
    const w = window.innerWidth, h = window.innerHeight;
    const list = [...active.values()]
      .map((p) => ({ p, d: Math.hypot(playerPos.x - p.x, playerPos.z - p.z) }))
      .sort((a, b) => a.d - b.d);
    const placed = [];
    let shown = 0;
    for (const { p, d } of list) {
      const hide = () => { p.el.style.display = "none"; };
      if (d > LABEL_R || shown >= MAX_LABELS) { hide(); continue; }
      v.set(p.x, (p.y || 0) + 2.35, p.z).project(camera);
      if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) { hide(); continue; }
      const sx = (v.x * 0.5 + 0.5) * w, sy = (-v.y * 0.5 + 0.5) * h;
      const full = shown < 3 && d < 16;
      const bw = full ? 170 : 110, bh = full ? 62 : 26;
      if (placed.some((r) => Math.abs(r.x - sx) < (r.w + bw) / 2 && Math.abs(r.y - sy) < (r.h + bh) / 2)) { hide(); continue; }
      placed.push({ x: sx, y: sy - bh / 2, w: bw, h: bh });
      p.el.classList.toggle("full", full);
      p.el.style.display = "flex";
      p.el.style.left = `${sx}px`;
      p.el.style.top = `${sy}px`;
      p.el.style.opacity = String(Math.max(0.5, 1 - d / LABEL_R));
      p.el.style.zIndex = String(100 - shown);
      shown++;
    }
  }

  function nearest(playerPos, maxD = 12) {
    let best = null, bd = maxD;
    for (const p of active.values()) {
      const d = Math.hypot(playerPos.x - p.x, playerPos.z - p.z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  function all() { return [...active.values()]; }

  return { manage, syncMembers, update, nearest, all, say, get: (id) => active.get(id) };
}

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
