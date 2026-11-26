import {textLabel} from '../systems/game-content.js';
import * as THREE from "three";

// Procedural facade textures drawn on canvas, so landmarks look like the real buildings
// without downloading photos. Each returns a THREE.CanvasTexture.
const cache = new Map();

function make(key, w, h, draw, repeat = [1, 1]) {
  const k = key + repeat.join("x");
  if (cache.has(k)) return cache.get(k);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 4;
  cache.set(k, t);
  return t;
}

const rand = (s => () => ((s = (s * 16807) % 2147483647) / 2147483647))(7);

// GIFT One / Two: blue glass with an irregular pattern of white vertical fins.
export const giftGlass = (rx = 3, ry = 10) => make("gift", 256, 256, (c, w, h) => {
  const g = c.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#2f6fae"); g.addColorStop(1, "#4b8fc9");
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  const cols = 16, rows = 8;
  for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) {
    if (rand() < 0.42) { c.fillStyle = rand() < 0.5 ? "#e8eef4" : "#b9c8d6"; c.fillRect(x * (w / cols) + 2, y * (h / rows), w / cols - 6, h / rows); }
  }
  c.fillStyle = "rgba(255,255,255,0.18)";
  for (let y = 0; y < rows; y++) c.fillRect(0, y * (h / rows), w, 2);
}, [rx, ry]);

// Office blocks: silver cladding with horizontal blue glass bands (Infocity).
export const officeBands = (rx = 2, ry = 5, glass = "#3b78b5", clad = "#c9ced6") => make("office" + glass + clad, 256, 128, (c, w, h) => {
  c.fillStyle = clad; c.fillRect(0, 0, w, h);
  c.fillStyle = glass; c.fillRect(0, h * 0.3, w, h * 0.45);
  c.fillStyle = "rgba(255,255,255,0.25)";
  for (let x = 0; x < w; x += 32) c.fillRect(x, h * 0.3, 2, h * 0.45);
}, [rx, ry]);

// Plain punched windows on a coloured wall (DAIICT, PDEU, hospital).
export const punched = (wall, win = "#2b3550", rx = 4, ry = 4) => make("punch" + wall + win, 128, 128, (c, w, h) => {
  c.fillStyle = wall; c.fillRect(0, 0, w, h);
  c.fillStyle = "rgba(0,0,0,0.08)"; c.fillRect(0, h - 6, w, 6);
  c.fillStyle = win; c.fillRect(w * 0.2, h * 0.25, w * 0.6, h * 0.45);
  c.fillStyle = "rgba(255,255,255,0.15)"; c.fillRect(w * 0.2, h * 0.25, w * 0.6, 4);
}, [rx, ry]);

// TCS Garima Park drum: horizontal terracotta louvre bands.
export const terracotta = (rx = 12, ry = 8) => make("terra", 64, 64, (c, w, h) => {
  c.fillStyle = "#3a2a24"; c.fillRect(0, 0, w, h);
  c.fillStyle = "#b85a3c"; c.fillRect(0, 4, w, h * 0.55);
  c.fillStyle = "#cf7250"; c.fillRect(0, 4, w, 6);
}, [rx, ry]);

// NIFT: grey exposed stone blocks.
export const stone = (rx = 6, ry = 4, base = "#a9a49b") => make("stone" + base, 128, 64, (c, w, h) => {
  c.fillStyle = base; c.fillRect(0, 0, w, h);
  c.strokeStyle = "rgba(0,0,0,0.15)"; c.lineWidth = 2;
  for (let y = 0; y <= h; y += 16) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
  for (let y = 0; y < h; y += 16) for (let x = (y / 16) % 2 ? 0 : 32; x < w; x += 64) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 16); c.stroke(); }
}, [rx, ry]);

// Akshardham: carved pink sandstone with arches.
export const sandstone = (rx = 8, ry = 2) => make("sand", 128, 128, (c, w, h) => {
  c.fillStyle = "#e7b48c"; c.fillRect(0, 0, w, h);
  c.fillStyle = "#d39a72";
  c.beginPath(); c.moveTo(w * 0.25, h); c.lineTo(w * 0.25, h * 0.45); c.quadraticCurveTo(w * 0.5, h * 0.12, w * 0.75, h * 0.45); c.lineTo(w * 0.75, h); c.fill();
  c.fillStyle = "#f2c9a6"; c.fillRect(0, 0, w, 10); c.fillRect(0, h * 0.3, w, 4);
  c.fillStyle = "rgba(120,60,30,0.25)";
  for (let x = 6; x < w; x += 14) c.fillRect(x, 12, 3, h * 0.15);
}, [rx, ry]);

// Swagat Holiday Mall: rainbow hexagon LED facade.
export const hexLed = (rx = 4, ry = 1) => make("hex", 512, 256, (c, w, h) => {
  c.fillStyle = "#1b1530"; c.fillRect(0, 0, w, h);
  const r = 18, dx = r * 1.75, dy = r * 1.5;
  const hues = [280, 300, 320, 200, 160, 120, 50];
  for (let row = 0, y = r; y < h + r; row++, y += dy) {
    for (let x = row % 2 ? dx / 2 : 0; x < w + r; x += dx) {
      c.beginPath();
      for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + (i * Math.PI) / 3; c.lineTo(x + Math.cos(a) * (r - 2), y + Math.sin(a) * (r - 2)); }
      c.closePath();
      const hue = hues[Math.floor(((x / w) * hues.length + row * 0.3)) % hues.length];
      c.fillStyle = `hsl(${hue} 85% ${55 + rand() * 15}%)`;
      c.fill();
    }
  }
}, [rx, ry]);

// Mall shopfronts with coloured signboards.
export const shopfronts = (rx = 3, ry = 1) => make("shops", 512, 128, (c, w, h) => {
  const colors = ["#c94f4f", "#2f7fbf", "#e0a030", "#3faf7f", "#8f4fbf", "#e05a8a"];
  for (let i = 0; i < 8; i++) {
    const x = i * (w / 8);
    c.fillStyle = colors[i % colors.length]; c.fillRect(x + 2, 4, w / 8 - 4, h * 0.28);
    c.fillStyle = "#8fc1e0"; c.fillRect(x + 4, h * 0.38, w / 8 - 8, h * 0.58);
    c.fillStyle = "rgba(255,255,255,0.7)"; c.fillRect(x + 10, 12, w / 8 - 24, 6);
  }
}, [rx, ry]);

// Dandi Kutir cone: faint horizontal rings of the salt mound.
export const saltRings = () => make("salt", 256, 512, (c, w, h) => {
  c.fillStyle = "#e9e7df"; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 16000; i++) {
    c.fillStyle = `rgba(113,108,94,${rand()*0.055})`;
    c.fillRect(rand()*w, rand()*h, 1, 1);
  }
  // Fine concrete panel joints, without the old dark zebra-like bands.
  c.fillStyle = "rgba(95,90,80,0.065)";
  for (let y = 0; y < h; y += 48) c.fillRect(0, y, w, 1);
  c.fillRect(0, 0, 1, h);
}, [18, 1]);

// Red walking track and brick paths.
export const brick = (rx = 10, ry = 1) => make("brick", 64, 32, (c, w, h) => {
  c.fillStyle = "#b5543f"; c.fillRect(0, 0, w, h);
  c.fillStyle = "rgba(0,0,0,0.12)";
  for (let x = 0; x < w; x += 16) c.fillRect(x, 0, 1, h);
  c.fillRect(0, h / 2, w, 1);
}, [rx, ry]);

// ---------- realistic ground, road and facade textures ----------

// Multi-octave value noise painted onto a canvas (cheap, no libraries).
function noise(c, w, h, colors, octaves = [[8, 0.5], [32, 0.3], [128, 0.2]], seed = 1) {
  let s = seed * 9301 + 49297;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  c.fillStyle = colors[0]; c.fillRect(0, 0, w, h);
  for (const [n, a] of octaves) {
    const small = document.createElement("canvas");
    small.width = n; small.height = n;
    const sc = small.getContext("2d");
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      sc.fillStyle = colors[Math.floor(r() * colors.length)];
      sc.fillRect(x, y, 1, 1);
    }
    c.globalAlpha = a; c.imageSmoothingEnabled = true;
    // Draw 3x3 so the tiles wrap without seams.
    for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) c.drawImage(small, dx, dy, w, h);
    c.globalAlpha = 1;
  }
}

export const grass = () => make("grass", 512, 512, (c, w, h) => {
  noise(c, w, h, ["#6f8f3e", "#7d9a45", "#5f7d35", "#8a9a50", "#6a8740", "#8f8a55"], [[6, 0.6], [24, 0.35], [96, 0.25], [256, 0.18]], 3);
  // Dry patches typical of Gujarat.
  c.globalAlpha = 0.18; c.fillStyle = "#b5a46a";
  for (let i = 0; i < 40; i++) { c.beginPath(); c.ellipse(Math.random() * w, Math.random() * h, 10 + Math.random() * 40, 6 + Math.random() * 20, Math.random() * 3, 0, Math.PI * 2); c.fill(); }
  c.globalAlpha = 1;
}, [1, 1]);

export const groundDirt = () => make("dirt", 256, 256, (c, w, h) => noise(c, w, h, ["#a89878", "#9c8c6c", "#b3a383", "#8f8063"], undefined, 5));

// Asphalt with lane markings. u runs across the road (0..1), v along it (one tile = 8 m).
export const asphalt = (lanes) => make("asphalt" + lanes, 256, 512, (c, w, h) => {
  noise(c, w, h, ["#4a4b4e", "#545558", "#404144", "#5a5b5e", "#47484b"], [[16, 0.5], [64, 0.35], [256, 0.3]], 7);
  c.fillStyle = "rgba(240,240,235,0.9)";
  if (lanes >= 2) {
    c.fillRect(w * 0.035, 0, 5, h);       // edge lines
    c.fillRect(w * 0.965 - 5, 0, 5, h);
    if (lanes >= 4) { c.fillStyle = "#e8c440"; c.fillRect(w * 0.5 - 5, 0, 4, h); c.fillRect(w * 0.5 + 1, 0, 4, h); } // divider
    else c.fillRect(w * 0.5 - 3, 0, 6, h * 0.45);                                                                 // dashed centre
    c.fillStyle = "rgba(240,240,235,0.85)";
    if (lanes >= 4) for (const u of [0.27, 0.73]) c.fillRect(w * u - 2, 0, 4, h * 0.4);
  }
  c.fillStyle = "rgba(0,0,0,0.12)";
  for (let i = 0; i < 6; i++) c.fillRect(w * (0.2 + Math.random() * 0.6), Math.random() * h, 20 + Math.random() * 30, 3);
}, [1, 1]);

export const pavers = () => make("pavers", 256, 256, (c, w, h) => {
  noise(c, w, h, ["#b8ad9c", "#c4b9a8", "#ab9f8d"], [[8, 0.4], [64, 0.3]], 11);
  c.strokeStyle = "rgba(70,60,50,0.35)"; c.lineWidth = 2;
  for (let y = 0; y < h; y += 32) for (let x = (y / 32) % 2 ? 16 : 0; x < w; x += 32) c.strokeRect(x, y, 32, 32);
}, [1, 1]);

export const boundaryStone = () => make('boundary-stone',512,512,(c,w,h)=>{
  noise(c,w,h,['#c1c2b6','#adafa2','#d1cfc2','#999e93'],[[8,0.45],[48,0.3],[180,0.25]],31);
  let seed=194;const r=()=>((seed=seed*16807%2147483647)/2147483647);
  for(let i=0;i<160;i++) {
    c.fillStyle=`rgba(54,64,51,${0.015+r()*0.07})`;
    c.beginPath();c.ellipse(r()*w,h*(0.55+r()*0.5),2+r()*8,12+r()*65,r()*0.2,0,Math.PI*2);c.fill();
  }
  c.fillStyle='rgba(51,64,45,0.14)';c.fillRect(0,h-18,w,18);
},[1,1]);

export const foliage = () => make('leaf-canopy',512,512,(c,w,h)=>{
  c.clearRect(0,0,w,h);let seed=613;
  const r=()=>((seed=seed*16807%2147483647)/2147483647);
  for(let i=0;i<1800;i++) {
    const a=r()*Math.PI*2,rad=Math.sqrt(r())*0.48,x=w/2+Math.cos(a)*rad*w,y=h/2+Math.sin(a)*rad*h;
    if(r()<Math.max(0,(rad-0.35)*2))continue;
    c.fillStyle=`hsl(${78+r()*31} ${18+r()*22}% ${15+r()*26}%)`;
    c.beginPath();c.ellipse(x,y,2+r()*4,4+r()*7,r()*Math.PI,0,Math.PI*2);c.fill();
  }
},[1,1]);

export const roofConcrete = () => make("roof", 256, 256, (c, w, h) => {
  noise(c, w, h, ["#9c9890", "#a8a49b", "#8e8a82", "#b2aea4", "#7f7b74"], [[8, 0.5], [32, 0.35], [128, 0.25]], 13);
  c.fillStyle = "rgba(60,60,60,0.25)";
  for (let i = 0; i < 4; i++) c.fillRect(Math.random() * w, Math.random() * h, 30, 20); // water tanks, AC units
}, [1, 1]);

// Facade atlas: 8 bays x 8 floors. One bay = 4 m wide, one floor = 3.2 m. Returns
// { map, emissive } where emissive lights a random set of windows for the night.
const FACADES = {
  plaster: { wall: ["#e6dcc8", "#ddd2bd", "#efe6d4"], win: "#3a4a5c", frame: "#ffffff", balcony: true },
  peach: { wall: ["#e8c9a8", "#e2bf9b", "#efd3b6"], win: "#33414f", frame: "#f6efe2", balcony: true },
  brick: { wall: ["#b5674a", "#a95e43", "#bf7254"], win: "#2f3a46", frame: "#e9e1d2", balcony: false },
  govt: { wall: ["#d9cdb0", "#cfc2a3", "#e2d7bc"], win: "#3b4652", frame: "#9b8f74", balcony: false, sunshade: true },
  glass: { wall: ["#7f9bb5", "#7591ac", "#8aa6bf"], win: "#3c6d99", frame: "#c9d4de", glass: true },
  white: { wall: ["#f2f0ea", "#ebe8e0", "#f7f5ef"], win: "#405366", frame: "#d0cbc0", balcony: true },
};
export function facade(style) {
  const key = "fac-" + style;
  if (cache.has(key)) return cache.get(key);
  const f = FACADES[style];
  const W = 512, H = 512, bw = W / 8, fh = H / 8;
  const base = document.createElement("canvas"); base.width = W; base.height = H;
  const em = document.createElement("canvas"); em.width = W; em.height = H;
  const c = base.getContext("2d"), e = em.getContext("2d");
  noise(c, W, H, f.wall, [[8, 0.5], [64, 0.25], [256, 0.15]], style.length * 17);
  e.fillStyle = "#000"; e.fillRect(0, 0, W, H);
  let s = style.length * 101;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let fy = 0; fy < 8; fy++) for (let bx = 0; bx < 8; bx++) {
    const x = bx * bw, y = fy * fh;
    if (f.glass) {
      c.fillStyle = f.win; c.fillRect(x + 2, y + 6, bw - 4, fh - 12);
      c.fillStyle = "rgba(255,255,255,0.18)"; c.fillRect(x + 2, y + 6, bw - 4, 6);
      c.fillStyle = f.frame; c.fillRect(x, y, bw, 5);
    } else {
      // Window with frame, sill, optional chhajja (sun shade) and balcony rail.
      const wx = x + bw * 0.22, wy = y + fh * 0.28, ww = bw * 0.56, wh = fh * 0.48;
      c.fillStyle = f.frame; c.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
      const g = c.createLinearGradient(0, wy, 0, wy + wh);
      g.addColorStop(0, "#6f8aa3"); g.addColorStop(1, f.win);
      c.fillStyle = g; c.fillRect(wx, wy, ww, wh);
      c.fillStyle = f.frame; c.fillRect(wx + ww / 2 - 1, wy, 2, wh);
      if (f.sunshade) { c.fillStyle = "rgba(0,0,0,0.25)"; c.fillRect(wx - 6, wy - 9, ww + 12, 5); }
      if (f.balcony && bx % 3 === 1) {
        c.fillStyle = "rgba(0,0,0,0.18)"; c.fillRect(x + 4, y + fh * 0.78, bw - 8, 3);
        c.fillStyle = "rgba(60,60,60,0.55)";
        for (let k = x + 6; k < x + bw - 6; k += 5) c.fillRect(k, y + fh * 0.62, 1.5, fh * 0.16);
      }
      c.fillStyle = "rgba(0,0,0,0.08)"; c.fillRect(x, y + fh - 3, bw, 3); // floor line
    }
    if (r() < 0.38) {
      e.fillStyle = r() < 0.7 ? "#ffd9a0" : "#cfe6ff";
      if (f.glass) e.fillRect(x + 2, y + 6, bw - 4, fh - 12);
      else e.fillRect(x + bw * 0.22, y + fh * 0.28, bw * 0.56, fh * 0.48);
    }
  }
  const tex = (cv) => {
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    return t;
  };
  const out = { map: tex(base), emissive: tex(em) };
  cache.set(key, out);
  return out;
}

// Tileable water ripple normal map.
export const waterNormals = () => {
  if (cache.has("waterN")) return cache.get("waterN");
  const N = 256, cv = document.createElement("canvas"); cv.width = cv.height = N;
  const c = cv.getContext("2d"), img = c.createImageData(N, N);
  const hgt = new Float32Array(N * N);
  for (let k = 0; k < 24; k++) {
    const fx = 1 + Math.floor(Math.random() * 6), fy = 1 + Math.floor(Math.random() * 6), ph = Math.random() * 6.28, a = 1 / (fx + fy);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) hgt[y * N + x] += a * Math.sin(((x * fx + y * fy) / N) * Math.PI * 2 + ph);
  }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = hgt[y * N + ((x + 1) % N)] - hgt[y * N + ((x - 1 + N) % N)];
    const dy = hgt[((y + 1) % N) * N + x] - hgt[((y - 1 + N) % N) * N + x];
    const v = new THREE.Vector3(-dx * 2, -dy * 2, 1).normalize();
    const i = (y * N + x) * 4;
    img.data[i] = (v.x * 0.5 + 0.5) * 255; img.data[i + 1] = (v.y * 0.5 + 0.5) * 255; img.data[i + 2] = (v.z * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  cache.set("waterN", t);
  return t;
};

// Text sign on a coloured board.
export function textTexture(lines, { bg = "#1d4e89", fg = "#ffffff", w = 1024, h = 256, font = "800 96px 'Baloo Bhai 2', Inter, sans-serif" } = {}) {
  lines=(Array.isArray(lines)?lines:[lines]).map(textLabel);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const x = c.getContext("2d");
  x.fillStyle = bg; x.fillRect(0, 0, w, h);
  x.fillStyle = fg; x.textAlign = "center"; x.textBaseline = "middle";
  const arr = Array.isArray(lines) ? lines : [lines];
  arr.forEach((line, i) => {
    x.font = i === 0 ? font : font.replace(/\d+px/, (m) => Math.round(parseInt(m) * 0.55) + "px");
    x.fillText(line, w / 2, (h / (arr.length + 1)) * (i + 1), w - 40);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
