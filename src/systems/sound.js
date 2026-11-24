// Sound: procedural music (a different scale and tempo per part of the city), city
// ambience (traffic hum, water, distant horns), footsteps, and a voice guide that says a
// Gujarati hello and place names with the browser's speech engine. Nothing is downloaded.
const KEY = "gnr-sound-v1";
const isPhone = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);

const MOODS = {
  default: { root: 220, scale: [0, 2, 4, 7, 9], tempo: 0.55 },
  temple: { root: 196, scale: [0, 1, 4, 5, 7, 8, 11], tempo: 0.8 },   // bhairav-like
  park: { root: 262, scale: [0, 2, 4, 7, 9], tempo: 0.7 },
  business: { root: 247, scale: [0, 3, 5, 7, 10], tempo: 0.42 },
  college: { root: 233, scale: [0, 2, 5, 7, 9], tempo: 0.45 },
  mall: { root: 277, scale: [0, 2, 4, 5, 7, 9, 11], tempo: 0.4 },
};

export function createSound() {
  const saved = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } })();
  const st = { on: saved.on ?? true, music: saved.music ?? 80, city: saved.city ?? 80, voice: saved.voice ?? 80,
    musicForced: false };
  let ctx = null, master, musicGain, cityGain, noise, waterGain, trafficGain;
  let mood = MOODS.default, nextNote = 0, step = 0;

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify({ on: st.on, music: st.music, city: st.city, voice: st.voice })); } catch { /* ignore */ }
  }

  function start() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.connect(master);
    cityGain = ctx.createGain(); cityGain.connect(master);

    // Pink-ish noise buffer shared by traffic, water and footsteps.
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    noise = buf;
    const loop = (freq, q) => {
      const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(f); f.connect(g); g.connect(cityGain); src.start();
      return g;
    };
    trafficGain = loop(180, 0.7);
    waterGain = loop(900, 0.4);
    apply();
  }

  function apply() {
    if (!ctx) return;
    master.gain.value = st.on ? 1 : 0;
    const musicOn = !isPhone || st.musicForced;
    musicGain.gain.value = musicOn ? (st.music / 100) * 0.18 : 0;
    cityGain.gain.value = (st.city / 100) * 0.5;
  }

  function note(freq, when, dur, vol = 0.5) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "triangle"; o.frequency.value = freq;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(vol, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    o.connect(g); g.connect(musicGain);
    o.start(when); o.stop(when + dur + 0.05);
  }

  // Called every frame: schedules music notes and sets ambience levels.
  function update({ near = {}, speed = 0 } = {}) {
    if (!ctx || !st.on) return;
    const t = ctx.currentTime;
    if (nextNote < t) nextNote = t;
    while (nextNote < t + 0.3) {
      const deg = mood.scale[(step * 3 + (step >> 2)) % mood.scale.length];
      const oct = step % 8 === 0 ? 0.5 : step % 5 === 0 ? 2 : 1;
      if (step % 2 === 0 || Math.random() < 0.4) note(mood.root * Math.pow(2, deg / 12) * oct, nextNote, mood.tempo * 1.6, 0.35);
      nextNote += mood.tempo; step++;
    }
    trafficGain.gain.setTargetAtTime(near.road ? 0.35 : 0.12, t, 0.5);
    waterGain.gain.setTargetAtTime(near.water ? 0.25 : 0, t, 0.8);
    if (Math.random() < 0.0015 && near.road) horn(t);
    stepSound(speed);
  }

  function horn(t) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "square"; o.frequency.value = 410 + Math.random() * 60;
    g.gain.setValueAtTime(0.0, t); g.gain.linearRampToValueAtTime(0.03, t + 0.02); g.gain.linearRampToValueAtTime(0, t + 0.35);
    o.connect(g); g.connect(cityGain); o.start(t); o.stop(t + 0.4);
  }

  let stepAcc = 0;
  function stepSound(speed) {
    if (speed < 0.5 || speed > 10) { stepAcc = 0; return; }
    stepAcc += speed / 60;
    if (stepAcc < 0.75) return;
    stepAcc = 0;
    const src = ctx.createBufferSource(); src.buffer = noise;
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 600;
    const g = ctx.createGain(); const t = ctx.currentTime;
    g.gain.setValueAtTime(0.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    src.connect(f); f.connect(g); g.connect(cityGain); src.start(t, Math.random()); src.stop(t + 0.1);
  }

  function say(text, lang = "gu-IN") {
    if (!st.on || !st.voice || !("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    const voices = speechSynthesis.getVoices();
    u.voice = voices.find((v) => v.lang === lang) || voices.find((v) => v.lang === "hi-IN") || voices.find((v) => v.lang.startsWith("en-IN")) || null;
    u.lang = u.voice?.lang || lang;
    u.volume = st.voice / 100;
    u.rate = 0.95;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }

  return {
    state: st,
    isPhone,
    start,
    update,
    say,
    setMood(kind) { mood = MOODS[kind] || MOODS.default; },
    set(k, v) { st[k] = v; apply(); persist(); },
    forceMusic() { st.musicForced = true; apply(); },
  };
}
