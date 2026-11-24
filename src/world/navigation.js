// Pedestrian capsule movement, shared by the player, NPCs and presence avatars.
// Swept substeps prevent running/cycling through thin walls and water edges.
export function createNavigation(zones = []) {
  function heights(x, z, radius) {
    const zone = zones.find(zon => zon.contains(x, z));
    return zone ? zone.heights(x, z, radius) : [0];
  }
  function surface(x, z, y, radius = 0.38, step = 0.65) {
    return heights(x, z, radius).filter(h => Math.abs(h - y) <= step)
      .sort(step === Infinity ? (a,b) => Math.abs(a-y)-Math.abs(b-y) : (a,b) => b-a)[0];
  }
  function move(pos, dx, dz, radius = 0.38) {
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.2));
    const sx = dx / n, sz = dz / n;
    for (let i = 0; i < n; i++) {
      let y = surface(pos.x + sx, pos.z + sz, pos.y, radius);
      if (y !== undefined) { pos.x += sx; pos.z += sz; pos.y = y; continue; }
      // Slide along the obstruction, instead of freezing diagonal input.
      const axes = Math.abs(sx) >= Math.abs(sz) ? [[sx, 0], [0, sz]] : [[0, sz], [sx, 0]];
      for (const [ax, az] of axes) {
        y = surface(pos.x + ax, pos.z + az, pos.y, radius);
        if (y !== undefined) { pos.x += ax; pos.z += az; pos.y = y; }
      }
    }
    return pos;
  }
  function safePoint(x, z, y = 0, radius = 0.38, maxStep = Infinity) {
    let h = surface(x, z, y, radius, maxStep);
    if (h !== undefined) return { x, y: h, z };
    // Travel, old saved positions and malicious presence coordinates must never
    // leave an avatar embedded in the cone, a pool or a closed exhibition hall.
    for (let r = 1; r <= 240; r += 1) {
      const n = Math.max(16, Math.ceil(2 * Math.PI * r / 2));
      for (let i = 0; i < n; i++) {
        const a = i * 2 * Math.PI / n, px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r;
        h = surface(px, pz, y, radius, maxStep);
        if (h !== undefined) return { x: px, y: h, z: pz };
      }
    }
    throw new Error('No pedestrian surface near the requested position');
  }
  function canTravel(from, to, radius = 0.38) {
    const p = { ...from };
    move(p, to.x - from.x, to.z - from.z, radius);
    return Math.hypot(p.x - to.x, p.z - to.z) < 0.3;
  }
  return { move, safePoint, surface, canTravel, zones };
}
