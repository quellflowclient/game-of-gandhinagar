import { placedPlaces, placePos } from "../data/places.js";
import { MAHATMA, siteToWorld } from '../world/mahatma-layout.js';

// Round, heading-up mini-map: roads, water, places, people and you.
export function createMinimap(canvas, map) {
  const ctx = canvas.getContext("2d");
  const R = 320; // metres shown from centre to edge
  const withBox = (pts) => {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [x, z] of pts) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
    return { pts, minX, maxX, minZ, maxZ };
  };
  const roads = map.roads.filter((r) => !["footway", "path", "service"].includes(r.kind)).map((r) => ({ ...withBox(r.pts), major: ["motorway", "trunk", "primary", "secondary"].includes(r.kind) }));
  const water = map.water.map((w) => ({ ...withBox(w.pts), closed: w.closed }));
  const parks = map.parks.map((p) => withBox(p.pts));
  const places = placedPlaces().map((p) => ({ p, ...placePos(p) }));
  const campus = places.find(({ p }) => p.id === 'dandi');
  const campusPath = points => points.map(([u,v]) => { const p = siteToWorld(campus,u,v); return [p.x,p.z]; });
  const convention = campusPath(MAHATMA.convention);
  const bridge = campusPath(MAHATMA.bridge.map(([v]) => [0,v]));

  function draw(player, heading, dots = []) {
    const W = canvas.width, H = canvas.height, s = (W / 2) / R;
    const cx = player.x, cz = player.z;
    const cos = Math.cos(heading), sin = Math.sin(heading);
    // World -> screen, rotated so the facing direction points up.
    const P = (x, z) => {
      const dx = x - cx, dz = z - cz;
      const rx = dx * cos - dz * sin, rz = dx * sin + dz * cos;
      return [W / 2 - rx * s, H / 2 - rz * s];
    };
    const near = (o) => o.maxX > cx - R && o.minX < cx + R && o.maxZ > cz - R && o.minZ < cz + R;
    const path = (pts) => { ctx.beginPath(); pts.forEach(([x, z], i) => { const [a, b] = P(x, z); i ? ctx.lineTo(a, b) : ctx.moveTo(a, b); }); };

    ctx.save();
    ctx.clearRect(0, 0, W, H);
    ctx.beginPath(); ctx.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = "#e9e2cf"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#bcd89f";
    for (const p of parks) if (near(p)) { path(p.pts); ctx.fill(); }
    ctx.fillStyle = "#7cc0e0"; ctx.strokeStyle = "#7cc0e0";
    for (const w of water) if (near(w)) { path(w.pts); if (w.closed) ctx.fill(); else { ctx.lineWidth = 110 * s; ctx.stroke(); } }
    ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#ffffff";
    for (const r of roads) if (near(r)) { ctx.lineWidth = r.major ? 7 : 3.5; path(r.pts); ctx.stroke(); }
    if (Math.hypot(campus.x-cx,campus.z-cz) < 900) {
      ctx.fillStyle='#bdc8ad';
      for(const plot of [MAHATMA.museumPlot,MAHATMA.conventionPlot]){path(campusPath(plot));ctx.closePath();ctx.fill();}
      const [mx,mz] = P(campus.x,campus.z);
      const ring = (inner,outer,color) => {
        ctx.fillStyle=color; ctx.beginPath(); ctx.arc(mx,mz,outer*s,0,Math.PI*2);
        if (inner) ctx.arc(mx,mz,inner*s,0,Math.PI*2,true);
        ctx.fill('evenodd');
      };
      ring(0,MAHATMA.promenadeOuter,'#f5f0df');
      ring(MAHATMA.waterInner,MAHATMA.waterOuter,'#7cc0d5');
      ring(MAHATMA.courtOuter,MAHATMA.bermOuter,'#b9aa8b');
      ring(0,MAHATMA.coneRadius,'#d6d5cb');
      ctx.strokeStyle='#faf8ef'; ctx.lineWidth=9*s;
      for(let i=0;i<4;i++) {
        const a=i*Math.PI/2;
        path(campusPath([[Math.sin(a)*47,Math.cos(a)*47],[Math.sin(a)*102,Math.cos(a)*102]])); ctx.stroke();
      }
      path(convention); ctx.closePath(); ctx.fillStyle='#9caf88'; ctx.fill();
      ctx.strokeStyle='#f5f1e5'; ctx.lineWidth=8.2*s; path(bridge); ctx.stroke();
      ctx.strokeStyle='#607060';ctx.lineWidth=1.1;
      for(const plot of [MAHATMA.museumPlot,MAHATMA.conventionPlot]){path(campusPath(plot));ctx.closePath();ctx.stroke();}
    }
    for (const { p, x, z } of places) {
      if (Math.abs(x - cx) > R * 1.4 || Math.abs(z - cz) > R * 1.4) continue;
      const [a, b] = P(x, z);
      ctx.fillStyle = "#" + p.color.toString(16).padStart(6, "0");
      ctx.beginPath(); ctx.arc(a, b, 9, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#0c1f1a"; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = "#0c1f1a"; ctx.font = "700 18px Inter, sans-serif"; ctx.textAlign = "center";
      ctx.fillText(p.name, a, b - 14);
    }
    for (const d of dots) {
      const [a, b] = P(d.x, d.z);
      ctx.fillStyle = d.real ? "#7a5cd8" : "#2f9e74";
      ctx.beginPath(); ctx.arc(a, b, d.real ? 6 : 3.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    // You: an arrow pointing up.
    ctx.fillStyle = "#e8643c"; ctx.strokeStyle = "#fff"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(W / 2, H / 2 - 16); ctx.lineTo(W / 2 + 11, H / 2 + 12); ctx.lineTo(W / 2, H / 2 + 6); ctx.lineTo(W / 2 - 11, H / 2 + 12); ctx.closePath();
    ctx.fill(); ctx.stroke();
  }
  return { draw };
}
