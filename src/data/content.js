// Static content: profile options, characters, residents, stalls, plans, events, missions.

export const OPEN_TO = [
  { id: "walk", label: "Just here to walk around" },
  { id: "hiring", label: "Hiring", chip: "OPEN TO HIRING" },
  { id: "work", label: "Looking for work", chip: "OPEN TO WORK" },
  { id: "cofounder", label: "Finding a co-founder", chip: "OPEN TO CO-FOUNDER" },
  { id: "clients", label: "Finding clients", chip: "OPEN TO CLIENTS" },
  { id: "mentoring", label: "Mentoring", chip: "OPEN TO MENTORING" },
  { id: "friends", label: "Friends and chai", chip: "OPEN TO FRIENDS AND CHAI" },
];

export const INTERESTS = [
  "🚀 Startups", "💻 Coding · AI", "🎨 Design", "💼 Dhandho · business", "📈 Share bazaar",
  "☕ Chai pe charcha", "🍲 Khana-pina", "🪘 Garba", "🏏 Cricket", "🥅 Box cricket",
  "📷 Photography", "🎧 Music", "🎬 Films", "💪 Fitness", "📚 Books", "🧳 Farvanu · travel",
];

export const REASONS = [
  { id: "friends", label: "🤝 New friends" },
  { id: "cofounder", label: "🧩 A co-founder" },
  { id: "hiring", label: "📣 Hiring" },
  { id: "work", label: "💼 Looking for work" },
  { id: "clients", label: "🛍 Clients or customers" },
  { id: "mentors", label: "🧭 Mentors" },
  { id: "explore", label: "🚶 Bas farva · just exploring" },
];

// Which open-to statuses match which reasons (used by "For you" matching).
export const MATCHES = {
  friends: ["friends"], cofounder: ["cofounder"], hiring: ["work"], work: ["hiring"],
  clients: ["clients"], mentors: ["mentoring"], explore: ["friends", "walk"],
};

export const TIMES = ["Morning", "Day", "Evening", "Night"];

// Character looks. Colours: top, bottom, skin, hair, accent.
export const CHARACTERS = {
  male: [
    { id: "hoodie", label: "Hoodie", top: 0x3b4a6b, bottom: 0x2a2a35, hair: 0x1b1410, hood: true },
    { id: "casual", label: "Casual", top: 0x5aa0c8, bottom: 0x3a4f6a, hair: 0x231a14 },
    { id: "business", label: "Business", top: 0xf2f2f2, bottom: 0x2b3245, hair: 0x15110e, tie: 0xb53a3a },
    { id: "punk", label: "Punk", top: 0x1c1c1c, bottom: 0x3d1f4d, hair: 0xd23c8a, spike: true },
    { id: "worker", label: "Worker", top: 0xe08a2e, bottom: 0x3e4b5e, hair: 0x2a1f15, helmet: 0xf2c84b },
    { id: "suit", label: "Suit", top: 0x262c3d, bottom: 0x262c3d, hair: 0x120e0b, tie: 0x3a6db5 },
    { id: "tshirt", label: "T-shirt", top: 0xf2b84b, bottom: 0x2c3e50, hair: 0x1e1712 },
  ],
  female: [
    { id: "adventurer", label: "Adventurer", top: 0x7a9a4a, bottom: 0x5b4a36, hair: 0x2b1a12, long: true },
    { id: "fcasual", label: "Casual", top: 0xe07a9a, bottom: 0x3a4f6a, hair: 0x1b1410, long: true },
    { id: "dress", label: "Dress", top: 0xc94f7c, bottom: 0xc94f7c, hair: 0x231a14, long: true, dress: true },
    { id: "tanktop", label: "Tank top", top: 0x4fb6a8, bottom: 0x2a2a35, hair: 0x3a2618, long: true },
    { id: "jacket", label: "Jacket", top: 0x8a3b3b, bottom: 0x23262f, hair: 0x15110e, long: true },
  ],
};
export const ALL_LOOKS = [...CHARACTERS.male, ...CHARACTERS.female];
// Keep appearance in the existing public look field so every real player,
// roster and saved profile uses the same human model without a schema change.
export const lookById = (value) => {
  const [id,...colors]=String(value||'').slice(0,80).split('~');
  const base=ALL_LOOKS.find(l=>l.id===id)||CHARACTERS.male[1];
  if(colors.length!==4||colors.some(c=>!/^([a-f0-9]{6})$/i.test(c)))return base;
  const [top,bottom,hair,shoes]=colors.map(c=>parseInt(c,16));return {...base,top,bottom,hair,shoes};
};
export const encodeLook = (id,colors={}) => {
  const base=lookById(id),hex=n=>Math.trunc(Math.max(0,Math.min(0xffffff,Number(n)||0))).toString(16).padStart(6,'0');
  return [base.id,...['top','bottom','hair','shoes'].map(k=>hex(colors[k]??base[k]??0x292e30))].join('~');
};

export const SKIN_TONES = [0x8d5a3b, 0xa86b47, 0xc58c63, 0x6f442b, 0xd9a27a];

// ---------- AI residents ----------
const FIRST = ["Aarav", "Vivaan", "Kabir", "Dhruv", "Harsh", "Parth", "Om", "Jay", "Neel", "Yash",
  "Meera", "Riya", "Isha", "Kavya", "Pooja", "Zoya", "Tara", "Diya", "Hetal", "Mansi",
  "Krupa", "Foram", "Janki", "Khushi", "Mihir", "Rushabh", "Smit", "Darshan", "Ketan", "Chirag"];
const LAST = ["P.", "S.", "M.", "D.", "J.", "R.", "T.", "A.", "B.", "K."];

// Roles per place kind; each gets an open-to status and a one-liner.
const ROLES = {
  business: [
    ["Software engineer · product company", "friends", "Building payments APIs, ask me about Go"],
    ["Founder · SaaS startup", "cofounder", "Looking for a tech co-founder"],
    ["Investment analyst · GIFT City", "mentoring", "Happy to talk markets over chai"],
    ["HR lead · IT services", "hiring", "Hiring freshers for QA and support"],
    ["Product designer · fintech", "clients", "Freelance UI work on weekends"],
    ["Data scientist · AI team", "friends", "Weekend box cricket, anyone?"],
  ],
  college: [
    ["Student · computer science", "work", "Looking for a summer internship"],
    ["Student · design", "friends", "Sketching around campus"],
    ["Student · energy engineering", "cofounder", "Solar startup idea, need a partner"],
    ["Professor · AI lab", "mentoring", "Office hours, any time"],
    ["Hostel canteen owner", "clients", "Maggi and cutting chai till 2 am"],
  ],
  office: [
    ["Developer · IT services", "friends", "New in Gandhinagar, show me around"],
    ["Team lead · cloud", "hiring", "Hiring DevOps engineers"],
  ],
  temple: [
    ["Volunteer · temple seva", "friends", "Evening aarti, all welcome"],
    ["Photographer · heritage", "clients", "Golden-hour shoots"],
    ["Flower seller", "clients", "Fresh marigold garlands"],
  ],
  park: [
    ["Yoga instructor", "clients", "Morning yoga by the water"],
    ["Retired government officer", "mentoring", "Forty years in the Sachivalaya"],
    ["Runner · weekend club", "friends", "Sunday 6 am runs"],
    ["Bird watcher", "friends", "Spotted a kingfisher today"],
    ["Bhel lari owner", "clients", "Best bhel by the lake"],
  ],
  museum: [
    ["Museum guide", "mentoring", "Ask me about the Dandi March"],
    ["History student", "friends", "Reading about the freedom movement"],
  ],
  mall: [
    ["Store manager · fashion", "hiring", "Hiring weekend staff"],
    ["Food court owner", "clients", "Try the Gujarati thali"],
    ["Content creator · food reels", "friends", "Reviewing every dabeli in town"],
  ],
  hangout: [
    ["Cafe owner", "clients", "New cold coffee menu"],
    ["Freelance video editor", "clients", "Reels and wedding edits"],
  ],
  hospital: [
    ["Nurse · Civil Hospital", "friends", "Night shift, chai after"],
    ["Doctor · resident", "mentoring", "Medical students, say hi"],
  ],
  bridge: [["Cyclist · weekend rides", "friends", "PDPU bridge loop every Sunday"]],
};

// Deterministic pseudo-random so residents stay the same between visits.
export function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function residentsFor(place, count) {
  const rand = seeded(place.id.split("").reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
  const roles = ROLES[place.kind] || ROLES.business;
  const out = [];
  for (let i = 0; i < count; i++) {
    const [role, openTo, line] = roles[Math.floor(rand() * roles.length)];
    const gender=i%2?'female':'male';
    const names=gender==='female'?FIRST.slice(10,24):[...FIRST.slice(0,10),...FIRST.slice(24)];
    const first = names[Math.floor(rand() * names.length)];
    const pool=CHARACTERS[gender],look = pool[Math.floor(rand() * pool.length)];
    out.push({
      id: `ai-${place.id}-${i}`,
      ai: true,
      name: `${first} ${LAST[Math.floor(rand() * LAST.length)]}`,
      firstName: first,
      role,
      openTo,
      oneLiner: line,
      look: look.id,
      gender,
      skin: SKIN_TONES[Math.floor(rand() * SKIN_TONES.length)],
      place: place.id,
    });
  }
  return out;
}

// ---------- Stalls (bargaining and missions) ----------
export const STALLS = {
  infocity: [{ id: "chai", name: "Chai lari", emoji: "☕", items: [["Cutting chai", 15], ["Masala chai", 20], ["Bun maska", 30]] },
             { id: "dabeli", name: "Dabeli lari", emoji: "🥪", items: [["Dabeli", 30], ["Vada pav", 25]] }],
  daiict: [{ id: "canteen", name: "Hostel canteen", emoji: "🍜", items: [["Maggi", 40], ["Cold coffee", 50]] }],
  gift: [{ id: "coffee", name: "Coffee cart", emoji: "☕", items: [["Cappuccino", 120], ["Cookie", 60]] }],
  pdeu: [{ id: "juice", name: "Juice stall", emoji: "🧃", items: [["Sherdi ras", 30], ["Lemon soda", 25]] }],
  akshardham: [{ id: "flowers", name: "Flower stall", emoji: "🌼", items: [["Marigold garland", 40], ["Rose", 20]] }],
  sarita: [{ id: "makai", name: "Makai lari", emoji: "🌽", items: [["Roasted makai", 30], ["Butter makai", 40]] }],
  indroda: [{ id: "toys", name: "Toys and balloons", emoji: "🎈", items: [["Dino balloon", 50], ["Whistle", 10]] }],
  dandi: [{ id: "khadi", name: "Khadi stall", emoji: "🧵", items: [["Khadi napkin", 80], ["Charkha keychain", 50]] }],
  lakegarden: [{ id: "bhel", name: "Bhel lari", emoji: "🥗", items: [["Bhel", 40], ["Pani puri", 30]] },
               { id: "gola", name: "Baraf gola", emoji: "🍧", items: [["Kala khatta gola", 30]] }],
  swagat: [{ id: "food", name: "Food court", emoji: "🍛", items: [["Gujarati thali", 180], ["Khaman", 40]] },
           { id: "clothes", name: "Bandhani stall", emoji: "👗", items: [["Bandhani dupatta", 450]] }],
};

// ---------- Plans ----------
export const PLAN_CATEGORIES = [
  { id: "all", label: "🌆 All" }, { id: "movie", label: "🎬 Movie or show" },
  { id: "chai", label: "☕ Chai" }, { id: "food", label: "🍛 Food run" },
  { id: "cricket", label: "🏏 Box cricket" }, { id: "garba", label: "💃 Garba" },
  { id: "startup", label: "💼 Startup talk" }, { id: "walk", label: "🚶 Walk" },
  { id: "other", label: "✨ Something else" },
];

// Sample listings. Replace with real events from the database (events table) before launch.
export const SAMPLE_EVENTS = [
  { emoji: "💼", title: "Startup chai meetup", when: "Every Saturday · 6 pm", where: "Infocity", cat: "startup" },
  { emoji: "🏏", title: "Box cricket night", when: "Fridays · 9 pm", where: "Kudasan", cat: "cricket" },
  { emoji: "🚶", title: "Sunday riverfront walk", when: "Sundays · 6:30 am", where: "Sarita Udyan", cat: "walk" },
  { emoji: "🎨", title: "Design jam", when: "Monthly · date TBA", where: "NIFT area", cat: "other" },
  { emoji: "🍛", title: "Thali trail", when: "Weekends · lunch", where: "Swagat Holiday Mall", cat: "food" },
];

// Utsav calendar. `fixed` dates switch on by themselves each year; others move and must be set.
export const FESTIVALS = [
  { id: "uttarayan", title: "Uttarayan", emoji: "🪁", month: 0, from: 14, to: 15, fixed: true,
    where: "Every rooftop", note: "Kites over every sector, undhiyu and chikki." },
  { id: "republic", title: "Republic Day", emoji: "🇮🇳", month: 0, from: 26, to: 26, fixed: true,
    where: "Mahatma Mandir side", note: "Flags across the capital." },
  { id: "navratri", title: "Navratri", emoji: "💃", fixed: false, where: "Party plots", note: "Garba nights. Dates move each year." },
  { id: "diwali", title: "Diwali", emoji: "🪔", fixed: false, where: "All sectors", note: "Diyas and rangoli. Dates move each year." },
  { id: "gandhi", title: "Gandhi Jayanti", emoji: "🕊️", month: 9, from: 2, to: 2, fixed: true,
    where: "Dandi Kutir", note: "A quiet day at the museum." },
];

// ---------- Missions ----------
// Objective types: wave_ai, chat_ai, visit, buy, cycle_m, bargain_win, night_at, checkpoint,
// connect_real, post_plan, message_match.
export const CHAPTER = {
  title: "Chapter 1 · Navo Gandhinagari",
  missions: [
    { id: "m1", emoji: "👋", title: "Pehlo kem cho",
      brief: "Gandhinagar runs on kem cho. Wave at three AI residents, then chat with one and ask what they do.",
      gu: "કેમ છો! ગાંધીનગરમાં નવા છો? ચાલો, ત્રણ જણને હાથ હલાવીને કેમ છો કહો.",
      goals: [{ type: "wave_ai", n: 3, label: "Wave at AI residents" }, { type: "chat_ai", n: 1, label: "Chat with one" }],
      reward: 50, badge: "kemcho" },
    { id: "m2", emoji: "☕", title: "Infocity ni chai",
      brief: "Take the BRTS to Infocity and get a cutting chai at the chai lari.",
      goals: [{ type: "visit", place: "infocity", label: "Reach Infocity" }, { type: "buy", item: "Cutting chai", label: "Buy a cutting chai" }],
      reward: 50, badge: "kitli" },
    { id: "m3", emoji: "🚲", title: "Cycle sawari",
      brief: "Gandhinagar is the greenest city to cycle. Ride a cycle for 500 metres.",
      goals: [{ type: "cycle_m", n: 500, label: "Ride 500 m" }], reward: 75, badge: "cycle" },
    { id: "m4", emoji: "🎓", title: "Knowledge corridor",
      brief: "Visit PDEU, cross the PDPU Bridge over the Sabarmati and reach GIFT City.",
      goals: [{ type: "visit", place: "pdeu", label: "Visit PDEU" }, { type: "visit", place: "pdpu-bridge", label: "Cross PDPU Bridge" },
              { type: "visit", place: "gift", label: "Reach GIFT City" }], reward: 100, badge: "corridor" },
    { id: "m5", emoji: "🤝", title: "Bhaav karo",
      brief: "No price is final. Bargain at any stall and get a discount.",
      goals: [{ type: "bargain_win", n: 1, label: "Win a bargain" }], reward: 75, badge: "bhaav" },
    { id: "m6", emoji: "🪔", title: "Akshardham ni saanj",
      brief: "Be at Akshardham in the evening or at night, and wave at two people there.",
      goals: [{ type: "night_at", place: "akshardham", label: "Reach Akshardham after 6 pm" }, { type: "wave_ai", n: 2, label: "Wave at two people" }],
      reward: 100, badge: "saanj" },
  ],
};

export const STORIES = [
  { id: "s1", emoji: "🕊️", title: "Dandi Kutir ni yatra", place: "dandi", minutes: 5,
    brief: "Walk the three markers around Dandi Kutir.",
    goals: [{ type: "checkpoint", n: 3, label: "Find the three markers" }], reward: 60, badge: "dandi" },
  { id: "s2", emoji: "🏞️", title: "Lake na diva", place: "lakegarden", minutes: 5,
    brief: "Light the four diyas around Suryajyot lake.",
    goals: [{ type: "checkpoint", n: 4, label: "Light four diyas" }], reward: 60, badge: "diva" },
];

export const GIGS = [
  { id: "g1", emoji: "🍱", title: "Tiffin delivery", place: "infocity", unlockAfter: "m3",
    brief: "Pick up the tiffin at the canteen and deliver it before it gets cold.", seconds: 90, reward: 80, badge: "tiffin" },
  { id: "g2", emoji: "🛺", title: "Auto bhadu", place: "swagat", unlockAfter: "m3",
    brief: "Drop the passenger at the right gate. Faster means a bigger tip.", seconds: 75, reward: 90, badge: "auto" },
];

export const REAL_MISSIONS = [
  { id: "r1", emoji: "✅", title: "Pehli olkhan", brief: "Send your first connect request to a real person.", type: "connect_real" },
  { id: "r2", emoji: "🎬", title: "Host bano", brief: "Post a plan of your own on the Plans board.", type: "post_plan" },
  { id: "r3", emoji: "💬", title: "Kaam ni vaat", brief: "Message a real person who is open to what you are looking for.", type: "message_match" },
];

export const BADGES = [
  { id: "kemcho", label: "Kem cho certified" }, { id: "kitli", label: "Kitli regular" },
  { id: "cycle", label: "Cycle sawar" }, { id: "corridor", label: "Corridor explorer" },
  { id: "bhaav", label: "Bhaav karo champion" }, { id: "saanj", label: "Saanj no saathi" },
  { id: "dandi", label: "Dandi yatri" }, { id: "diva", label: "Diva no saathi" },
  { id: "tiffin", label: "Tiffin hero" }, { id: "auto", label: "Meter master" },
  { id: "paisa", label: "Paisa vasool" }, { id: "pakko", label: "Pakko Gandhinagari" },
];

export const FIRSTS = [
  { id: "cycle", label: "🚲 Rode a cycle" }, { id: "bridge", label: "🌉 Crossed PDPU Bridge" },
  { id: "bargain", label: "🤝 Bargained like a Gandhinagari" }, { id: "wave5", label: "👋 Waved at five people" },
  { id: "plan", label: "🎬 Joined a plan" }, { id: "night", label: "🌙 Out after dark" },
  { id: "morning", label: "🌅 Up for the morning" }, { id: "temple", label: "🛕 Reached Akshardham" },
];

export const DAY_ONE = [
  { id: "visit2", label: "Visit two places", hint: "take the BRTS", n: 2 },
  { id: "wave3", label: "Wave at three people", hint: "press Q or 👋", n: 3 },
  { id: "plan1", label: "Join or post a plan", hint: "open 🎬 Plans", n: 1 },
];
