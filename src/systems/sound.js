// City effects and browser speech: footsteps, horns, impacts and dialogue.
import {CONTENT} from './game-content.js';
import recordings from '../data/dialogue-recordings.json';
import {createDialogueAudio} from './dialogue-audio.js';
const KEY = "gnr-sound-v1";
const isPhone = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);

export function createSound() {
  const saved = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } })();
  const st = { on: saved.on ?? true, city: saved.city ?? 80, voice: saved.voice ?? 80 };
  let ctx = null, master, cityGain, noise;
  let speechTicket=0;
  const duck=on=>window.gogMusic?.duck(on);
  const dialogue=createDialogueAudio({context:()=>({ctx,output:master}),enabled:()=>st.on&&st.voice>0,volume:()=>st.voice/100,duck});
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* ignore */ }
  }

  function start() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.connect(ctx.destination);
    cityGain = ctx.createGain(); cityGain.connect(master);

    // Pink-ish noise buffer shared by traffic, water and footsteps.
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    noise = buf;
    // Continuous noise loops sounded like wind. Keep only discrete footsteps,
    // horns and collision effects.
    apply();
  }

  function apply() {
    if(!st.on||!st.voice){speechTicket++;dialogue.stop();window.speechSynthesis?.cancel();duck(false);}else dialogue.setVolume();
    if (!ctx) return;
    master.gain.value = st.on ? 1 : 0;
    cityGain.gain.value = (st.city / 100) * 0.5;
  }

  // Update discrete city sound effects.
  function update({ near = {}, speed = 0 } = {}) {
    if (!ctx || !st.on) return;
    const t = ctx.currentTime;
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

  function say(text, lang = "gu-IN", options = {}) {
    if (!st.on || !st.voice || !text) return;
    if(options.interrupt===false&&(dialogue.speaking||window.speechSynthesis?.speaking||window.speechSynthesis?.pending))return;
    const ticket=++speechTicket;dialogue.stop();window.speechSynthesis?.cancel();duck(false);
    const profile=options.profile||(options.gender==='female'?'female':'male');
    const key=String(text).trim(),custom=CONTENT.voices[profile]?.recordings;
    const clip=custom&&Object.hasOwn(custom,key)?custom[key]:recordings[profile]?.[key]?.url;
    const fallback=()=>browserSay(key,lang,options,ticket,recordings[profile]?.[key]?.spoken);
    if(clip){if(!ctx)start();if(dialogue.play(clip,fallback))return;}
    fallback();
  }

  function browserSay(text,lang,options,ticket,pronunciation){
    if(ticket!==speechTicket||!st.on||!st.voice||!('speechSynthesis' in window))return;
    const u = new SpeechSynthesisUtterance(pronunciation||text);
    const voices = speechSynthesis.getVoices();
    const female=/female|swara|kalpana|heera|swati|neerja|aditi|dhwani|lekha|sangeeta/i,male=/\bmale\b|hemant|ravi|prabhat|madhur|rishi|kumar/i;
    const score=v=>{const name=v.name+' '+v.voiceURI,gender=female.test(name)?'female':male.test(name)?'male':null;return(v.lang===lang?60:v.lang.startsWith(lang.slice(0,2))?55:v.lang==='hi-IN'?45:v.lang==='en-IN'?20:0)+(options.gender?(gender===options.gender?100:gender?-1000:0):0);};
    u.voice = voices.filter(v=>v.lang===lang||/^(gu|hi|en)[-_]/i.test(v.lang)).sort((a,b)=>score(b)-score(a))[0]||null;
    u.lang = u.voice?.lang || lang;
    u.volume = st.voice / 100;
    u.rate = options.rate??0.95;u.pitch=options.pitch??(options.gender==='female'?1.12:options.gender==='male'?.92:1);
    u.onstart=()=>{if(ticket===speechTicket)duck(true);};u.onend=u.onerror=()=>{if(ticket===speechTicket)duck(false);};
    speechSynthesis.speak(u);
  }

  return {
    honk() { if (ctx && cityGain) { horn(ctx.currentTime); horn(ctx.currentTime + 0.45); } },
    state: st,
    get speaking(){return dialogue.speaking||('speechSynthesis' in window&&(speechSynthesis.speaking||speechSynthesis.pending));},
    isPhone,
    start,
    update,
    say,
    impact(){
      if(!ctx||!st.on)return;
      const src=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain(),t=ctx.currentTime;
      src.buffer=noise;filter.type='lowpass';filter.frequency.value=420;gain.gain.setValueAtTime(.9,t);gain.gain.exponentialRampToValueAtTime(.001,t+.32);
      src.connect(filter);filter.connect(gain);gain.connect(cityGain);src.start(t);src.stop(t+.35);
    },
    set(k, v) { st[k] = v; apply(); persist();if(k==='on')window.gogMusic?.setMaster(v); },
  };
}
