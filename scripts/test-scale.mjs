// 500-player load model for the multiplayer networking (no real servers touched).
// Simulates every client's timers exactly as src/backend/supabase.js schedules them,
// counts what reaches the database / CDN / Realtime, and compares with the old
// postgres_changes design. Also checks payload size, client CPU and api/positions.js.
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { createPositionsHandler } from "../api/positions.js";

const PLAYERS = +(process.env.PLAYERS || 500), SECONDS = 120, CELL = 160;
const MOVING_SHARE = 0.6, DM_PER_S = 3, WAVES_PER_S = 0.5, WORLD_PER_S = 1, WORLD_PANEL_OPEN = 0.1;

function simulate(scenario) {
  // scenario: "spread" = whole LDRP campus (~900 x 700 m), "crowd" = everyone in one 120 m courtyard
  const span = scenario === "crowd" ? [120, 120] : [900, 700];
  const rnd = mulberry(scenario === "crowd" ? 7 : 3);
  const players = Array.from({ length: PLAYERS }, (_, i) => ({
    x: -800 + rnd() * span[0], z: -5000 + rnd() * span[1], h: 0, moving: rnd() < MOVING_SHARE,
    lastSent: null, rosterAt: Math.floor(rnd() * 20), // clients join at different moments
  }));
  const stats = { dbWrites: 0, dbSnapshot: 0, dbRoster: 0, cdnHits: 0, realtime: 0, worldReads: 0, inboxPolls: 0, peakDbPerSec: 0 };
  for (let s = 0; s < SECONDS; s++) {
    let dbThisSecond = 0;
    const cdnCache = new Set(); // s-maxage=1: one origin request per area URL per second
    for (const p of players) {
      if (p.moving) { p.h += (rnd() - 0.5) * 0.6; p.x += Math.sin(p.h) * 1.4; p.z += Math.cos(p.h) * 1.4; if (rnd() < 0.02) p.moving = false; }
      else if (rnd() < 0.01) p.moving = true;
      // sendPosition(): ≥1 s apart, only if moved >0.4 m / turned, else 12 s heartbeat
      const moved = !p.lastSent || Math.hypot(p.x - p.lastSent.x, p.z - p.lastSent.z) > 0.4 || Math.abs(p.h - p.lastSent.h) > 0.25;
      const gap = PLAYERS > 400 ? 2 : 1; // mirrors the busy-city rule in sendPosition()
      if (p.lastSent && s - p.lastSent.at < gap) { /* too soon */ }
      else if (moved || s - p.lastSent.at >= 12) { p.lastSent = { x: p.x, z: p.z, h: p.h, at: s }; stats.dbWrites++; dbThisSecond++; }
      // pollPositions(): 1/s through the CDN
      const key = `ldrp|${Math.floor(p.x / CELL)}|${Math.floor(p.z / CELL)}`;
      stats.cdnHits++;
      if (!cdnCache.has(key)) { cdnCache.add(key); stats.dbSnapshot++; dbThisSecond++; }
      // roster every 20 s
      if (s >= p.rosterAt && (s - p.rosterAt) % 20 === 0) { stats.dbRoster++; dbThisSecond++; }
    }
    // private events go only to the 2 people involved (DM: both; wave: target)
    stats.realtime += Math.round(DM_PER_S * 2 + WAVES_PER_S);
    // world chat: id rides in the snapshot; only players with the panel open re-read
    const worldReads = Math.round(WORLD_PER_S * PLAYERS * WORLD_PANEL_OPEN);
    stats.worldReads += worldReads; dbThisSecond += worldReads;
    stats.peakDbPerSec = Math.max(stats.peakDbPerSec, dbThisSecond);
  }
  const per = (n) => +(n / SECONDS).toFixed(1);
  return { scenario, dbWritesPerSec: per(stats.dbWrites), snapshotQueriesPerSec: per(stats.dbSnapshot), rosterPerSec: per(stats.dbRoster),
    worldReadsPerSec: per(stats.worldReads), dbRequestsPerSec: per(stats.dbWrites + stats.dbSnapshot + stats.dbRoster + stats.worldReads),
    peakDbPerSec: stats.peakDbPerSec, cdnRequestsPerSec: per(stats.cdnHits), realtimeMsgsPerSec: per(stats.realtime) };
}

function oldDesign() {
  // Old: update every 0.25 s (RTT bound, ~4/s while moving), every write published via
  // postgres_changes to ALL subscribers (each runs RLS), every client then re-ran
  // online_players (80 ms debounce) returning up to 200 rows.
  const writes = PLAYERS * (MOVING_SHARE * 4 + (1 - MOVING_SHARE) * 0.1);
  return { scenario: "old design", dbWritesPerSec: Math.round(writes), realtimeRlsChecksPerSec: Math.round(writes * PLAYERS),
    onlinePlayersRpcPerSec: Math.round(PLAYERS * Math.min(12.5, writes)), dbRequestsPerSec: Math.round(writes + PLAYERS * Math.min(12.5, writes)) };
}

function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---- payload + client CPU ----
const rows = Array.from({ length: 150 }, (_, i) => [1001 + i * 3, +(-700 + Math.random() * 300).toFixed(1), 0, +(-4900 + Math.random() * 300).toFixed(1), +(Math.random() * 6).toFixed(2), ["walk", "cycle", "car"][i % 3]]);
const snapshot = JSON.stringify({ t: Date.now(), w: 123456, p: rows });
const raw = Buffer.byteLength(snapshot), gz = gzipSync(snapshot).length;
const roster = new Map(rows.slice(0, 80).map(([n, x, , z]) => [n, { residentNo: n, userId: `u${n}`, name: `P${n}`, x, z, place: "ldrp" }]));
const t0 = performance.now();
for (let k = 0; k < 2000; k++) {
  for (const [n, x, y, z, h, v] of rows) { const p = roster.get(n); if (p) { p.x = x; p.y = y; p.z = z; p.heading = h; p.vehicle = v; } }
  [...roster.values()].map((m) => ({ ...m, d: Math.hypot(m.x + 600, m.z + 4800) })).sort((a, b) => a.d - b.d).slice(0, 40);
}
const cpuMs = (performance.now() - t0) / 2000;

// ---- api/positions.js ----
const calls = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return new Response(snapshot, { status: 200, headers: { "content-type": "application/json" } }); };
const res = () => { const r = { headers: {}, code: 0, body: null, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } }; return r; };
const handler = createPositionsHandler({});
const good = await handler({ method: "GET", query: { place: "ldrp", cx: "-5", cz: "-31" } }, res());
assert.equal(good.code, 200); assert.match(good.headers["Cache-Control"], /s-maxage=1/); assert.deepEqual(calls[0].body, { pp: "ldrp", cx: -5, cz: -31 });
assert.equal((await handler({ method: "GET", query: { place: "x", cx: "1", cz: "1" } }, res())).code, 400);
assert.equal((await handler({ method: "GET", query: { place: "ldrp", cx: "1.5", cz: "1" } }, res())).code, 400);
assert.equal((await handler({ method: "POST", query: {} }, res())).code, 405);
globalThis.fetch = realFetch;

// ---- report ----
const spread = simulate("spread"), crowd = simulate("crowd"), old = oldDesign();
console.log(`\n${PLAYERS} concurrent players, ${SECONDS} s simulated\n`);
console.table([old, spread, crowd]);
console.log(`Snapshot (150 nearby players): ${raw} B raw, ${gz} B gzip · client merge+nearest-40: ${cpuMs.toFixed(3)} ms per update`);
console.log(`Bandwidth per player ≈ ${(gz / 1024).toFixed(1)} KB/s down; CDN egress at ${PLAYERS} players ≈ ${(gz * PLAYERS / 1048576).toFixed(1)} MB/s`);

// Budgets: a Supabase Small/Medium instance comfortably serves a few hundred tiny RPCs/s.
for (const r of [spread, crowd]) {
  assert.ok(r.dbRequestsPerSec < PLAYERS * 0.5, `${r.scenario}: DB load ${r.dbRequestsPerSec}/s too high`); // ≤0.5 req/s per player, no hard cap
    assert.ok(r.realtimeMsgsPerSec < 50, `${r.scenario}: realtime ${r.realtimeMsgsPerSec}/s too high`);
}
assert.ok(cpuMs < 2, "client merge too slow");
assert.ok(gz < 6000, "snapshot too large");
console.log(`\nOK: new design is ~${Math.round(old.dbRequestsPerSec / spread.dbRequestsPerSec)}x lighter on the database and removes ${old.realtimeRlsChecksPerSec.toLocaleString()} realtime RLS checks/s.`);
