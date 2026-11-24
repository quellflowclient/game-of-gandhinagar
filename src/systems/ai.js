import { ENV } from "../config.js";
import { placeById } from "../data/places.js";

// Client side of AI twins and AI residents. Calls the /api/ai endpoint (Claude) and
// falls back to simple offline replies when the endpoint is not available.
const ENDPOINT = ENV.aiEndpoint || "/api/ai";
let endpointDown = false;

async function call(body, token) {
  if (endpointDown) return null;
  try {
    const r = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    if (r.status === 503 || r.status === 404) { endpointDown = r.status === 503; return null; }
    const j = await r.json();
    return j.reply || null;
  } catch {
    endpointDown = true;
    return null;
  }
}

export async function askResident(person, message, history) {
  const persona = { ...person.data, placeName: placeById(person.data.place)?.name };
  const reply = await call({ kind: "resident", persona, message, history });
  return reply || offlineResident(persona, message);
}

export async function askTwin(owner, twin, message, history, token) {
  const persona = { ...owner, answers: twin?.answers || {} };
  const reply = await call({ kind: "twin", persona, ownerId: owner.id, message, history }, token);
  return reply || offlineTwin(persona, message);
}

export const aiStatus = () => (endpointDown ? "offline replies" : "Claude");

// ---------- offline fallbacks ----------
const has = (m, ...w) => w.some((x) => m.includes(x));

function offlineResident(p, raw) {
  const m = raw.toLowerCase();
  const first = p.name.split(" ")[0];
  if (has(m, "kem cho", "hello", "hi", "hey", "namaste")) return `Majama! Hu ${first}. ${p.oneLiner}.`;
  if (has(m, "what do you do", "work", "job", "kaam", "shu karo")) return `I'm a ${p.role.toLowerCase()}. ${p.oneLiner}.`;
  if (has(m, "where", "kya", "place", "area")) return `You'll usually find me around ${p.placeName}. Nice spot, no?`;
  if (has(m, "food", "khana", "chai", "eat")) return "Cutting chai at Infocity, then bhel by the lake. That's the plan, always.";
  if (has(m, "bye", "aavjo", "see you")) return "Aavjo! See you around the sectors.";
  return `Saras question! I'm just a ${p.role.split("·")[0].trim().toLowerCase()} here, ask me about my work or ${p.placeName}.`;
}

function offlineTwin(p, raw) {
  const m = raw.toLowerCase();
  const first = (p.name || "they").split(" ")[0];
  const a = p.answers || {};
  if (has(m, "kem cho", "hello", "hi", "hey")) return `Kem cho! I'm ${first}'s AI twin. ${a.work ? "Ask me about what " + first + " is working on." : ""}`.trim();
  if (has(m, "work", "do", "building", "job") && a.work) return `${first}'s AI twin here: ${a.work}`;
  if (has(m, "looking", "need", "want", "hiring") && a.looking) return `${first} is looking for: ${a.looking}`;
  if (has(m, "ask", "know", "expert", "help") && a.askMe) return `You can ask ${first} about ${a.askMe}.`;
  if (has(m, "work with", "collab", "together") && a.workWith) return a.workWith;
  if (has(m, "fun", "gandhinagar", "favourite", "favorite") && a.fun) return a.fun;
  return `I'm ${first}'s AI twin and I don't know that one. I'll tell ${first}, or send them a connect request.`;
}
