// Serverless endpoint (Vercel style: deploys as /api/ai) that writes replies for
// AI twins and AI residents with Claude. The Anthropic key stays on the server.
//
// Env: ANTHROPIC_API_KEY (required)
//      SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (optional; when set, twin data is loaded
//      from the database instead of trusting the browser, and twin chats are logged).
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const client = new Anthropic();
const MODEL = "claude-opus-5-5";
const CONTACT = /(\+?\d[\d\s-]{7,}\d)|([\w.+-]+@[\w-]+\.[\w.]+)|(https?:\/\/|www\.)/i;
const SEXUAL = /\b(sex|nude|nudes|porn)\b/i;

const db = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

// Very small per-instance rate limit (serverless instances do not share memory; use a
// shared store such as Upstash Redis for a real limit).
const hits = new Map();
function limited(key, max = 20, windowMs = 60_000) {
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(key, list);
  return list.length > max;
}

const TWIN_RULES = `You are an AI twin on People of Gandhinagar, a small 3D city where people meet.
You answer signed-in members on behalf of one member while they are offline.

Rules:
- Answer only from the profile and notes below. If they do not cover the question, say "I'll tell {first} when they are back" and suggest sending a connect request.
- Always be clear you are {first}'s AI twin, never {first} themselves.
- Never share a phone number, email, link, social handle or address.
- Never agree to a meeting, call, price, job, deal or any promise.
- Never make things up about {first}, and never say anything about other people.
- Keep it friendly and short: two or three sentences, plain text, no lists. A little Gujarati warmth ("kem cho", "saras") is welcome.`;

const RESIDENT_RULES = `You are an AI resident of People of Gandhinagar, a small 3D city where people walk around and meet.
You are a friendly, fictional character, and you are labelled as an AI resident.
Stay in character, keep replies to one to three short sentences of plain text, and mix in light Gujarati or Hinglish ("kem cho", "majama", "chalo") naturally.
You can talk about your work, your corner of the city, Gandhinagar life, food and plans.
Never claim to be a real person, never share contact details or links, never agree to real-world meetings, payments or promises, and do not invent facts about real people.`;

function personaPrompt(kind, persona) {
  if (kind === "twin") {
    const first = (persona.name || "this member").split(" ")[0];
    const a = persona.answers || {};
    return TWIN_RULES.replaceAll("{first}", first) + `

Public profile:
- Name: ${persona.name || ""}
- Work: ${persona.role || ""}
- Home district: ${persona.home || ""}
- Status line: ${persona.oneLiner || ""}
- Open to: ${persona.openTo || ""}

What ${first} wrote for the twin:
- What I do and what I am working on: ${a.work || "(not written)"}
- What I am looking for: ${a.looking || "(not written)"}
- Ask me about: ${a.askMe || "(not written)"}
- Best way to work with me: ${a.workWith || "(not written)"}
- One fun Gandhinagar thing about me: ${a.fun || "(not written)"}`;
  }
  return RESIDENT_RULES + `

Your character:
- Name: ${persona.name}
- Work: ${persona.role}
- You hang out at: ${persona.placeName || "Gandhinagar"}
- Your status line: ${persona.oneLiner || ""}`;
}

async function loadTwin(ownerId) {
  const [{ data: twin }, { data: prof }] = await Promise.all([
    db.from("twins").select("*").eq("owner", ownerId).maybeSingle(),
    db.from("profiles").select("name, role, home, one_liner, open_to, last_seen").eq("id", ownerId).maybeSingle(),
  ]);
  if (!twin?.enabled || !twin.adult || !prof) return null;
  const online = prof.last_seen && Date.now() - new Date(prof.last_seen).getTime() < 2 * 60_000;
  if (online) return { online: true };
  return { name: prof.name, role: prof.role, home: prof.home, oneLiner: prof.one_liner, openTo: prof.open_to, answers: twin.answers };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const ip = req.headers["x-forwarded-for"]?.split(",")[0] || "anon";
  if (limited(ip)) return res.status(429).json({ error: "Too many messages, try again in a minute." });

  const { kind, persona = {}, ownerId, message, history = [] } = req.body || {};
  if (!["twin", "resident"].includes(kind) || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Bad request" });
  }

  // For twins in live mode, trust the database, not the browser.
  let who = persona;
  let askerId = null;
  if (kind === "twin" && db) {
    const token = (req.headers.authorization || "").replace(/^Bearer /, "");
    const { data } = token ? await db.auth.getUser(token) : { data: null };
    askerId = data?.user?.id;
    if (!askerId) return res.status(401).json({ error: "Sign in to chat with twins." });
    const loaded = await loadTwin(ownerId);
    if (!loaded) return res.status(404).json({ error: "This twin is switched off." });
    if (loaded.online) return res.json({ reply: "They are online right now, so say hi to them directly!", online: true });
    who = loaded;
  }

  const messages = [
    ...history.slice(-8).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content).slice(0, 600) })),
    { role: "user", content: message.slice(0, 600) },
  ];

  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: personaPrompt(kind, who),
      messages,
    });

    if (response.stop_reason === "refusal") {
      return res.json({ reply: "Hmm, I can't help with that one. Ask me something else?" });
    }
    let reply = response.content.filter((b) => b.type === "text").map((b) => b.text).join(" ").trim();
    // Never pass contact details or sexual content through, even if the model slips.
    if (!reply || CONTACT.test(reply) || SEXUAL.test(reply)) {
      reply = kind === "twin" ? "I'll pass that on. Send them a connect request to talk directly." : "Majama! Ask me about my work or this part of the city.";
    } else if (kind === "twin" && db && askerId) {
      await db.from("twin_chats").insert({ owner: ownerId, asker: askerId, question: message.slice(0, 600), answer: reply });
    }
    return res.json({ reply });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return res.status(429).json({ error: "The city is busy, try again in a moment." });
    if (err instanceof Anthropic.APIError) return res.status(502).json({ error: `AI error ${err.status}` });
    return res.status(500).json({ error: "Something went wrong." });
  }
}
