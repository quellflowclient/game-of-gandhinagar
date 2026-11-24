import * as THREE from "three";

// Festival previews around the player: kites for Uttarayan, diyas for Diwali,
// garba lights for Navratri, tricolour flags for Republic Day, doves for Gandhi Jayanti.
const LOOKS = {
  uttarayan: { count: 60, colors: [0xe0402f, 0xf2b84b, 0x3a6db5, 0x2fb7a0, 0xd86a9c], shape: "kite", y: [25, 70] },
  diwali: { count: 90, colors: [0xffb347, 0xffd27a], shape: "diya", y: [0.3, 0.3] },
  navratri: { count: 80, colors: [0xff4fa0, 0xffd400, 0x4fd1ff, 0x7cff6b], shape: "light", y: [4, 9] },
  republic: { count: 30, colors: [0xff9933, 0xffffff, 0x138808], shape: "flag", y: [6, 10] },
  gandhi: { count: 25, colors: [0xffffff], shape: "dove", y: [15, 35] },
};

export function createFestival(scene) {
  let group = null, items = [], current = null;

  function geometryFor(shape) {
    if (shape === "kite") { const g = new THREE.PlaneGeometry(1.6, 1.6); g.rotateZ(Math.PI / 4); return g; }
    if (shape === "diya") return new THREE.SphereGeometry(0.18, 8, 6);
    if (shape === "light") return new THREE.SphereGeometry(0.25, 8, 6);
    if (shape === "flag") return new THREE.PlaneGeometry(1.8, 1.2);
    return new THREE.ConeGeometry(0.4, 1, 4);
  }

  function set(id, center) {
    if (group) { scene.remove(group); group = null; items = []; }
    current = id;
    if (!id || !LOOKS[id]) return;
    const look = LOOKS[id];
    group = new THREE.Group();
    const geo = geometryFor(look.shape);
    for (let i = 0; i < look.count; i++) {
      const color = look.colors[i % look.colors.length];
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
      const a = Math.random() * Math.PI * 2, r = look.shape === "diya" ? 6 + Math.random() * 40 : 10 + Math.random() * 120;
      m.position.set(center.x + Math.cos(a) * r, look.y[0] + Math.random() * (look.y[1] - look.y[0]), center.z + Math.sin(a) * r);
      m.userData = { a, r, sp: 0.05 + Math.random() * 0.15, ph: Math.random() * 10, base: m.position.y };
      group.add(m);
      items.push(m);
    }
    scene.add(group);
  }

  function update(dt, t) {
    if (!group) return;
    for (const m of items) {
      const u = m.userData;
      if (current === "uttarayan" || current === "gandhi") {
        m.position.y = u.base + Math.sin(t * 0.8 + u.ph) * 2;
        m.rotation.z = Math.sin(t * 1.3 + u.ph) * 0.4;
        m.rotation.y += dt * u.sp;
      } else if (current === "navratri") {
        m.visible = Math.sin(t * 4 + u.ph) > -0.3;
      } else if (current === "diwali") {
        m.scale.setScalar(0.8 + Math.sin(t * 9 + u.ph) * 0.2);
      } else if (current === "republic") {
        m.rotation.y = Math.sin(t * 2 + u.ph) * 0.3;
      }
    }
  }

  return { set, update, get current() { return current; } };
}
