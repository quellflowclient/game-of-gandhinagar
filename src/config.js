// App-wide settings. Values that come from the environment are read through Vite's
// import.meta.env, so they can be set in a .env file (see .env.example).
export const CITY = {
  name: "Gandhinagar",
  nameGu: "ગાંધીનગર",
  short: "GANDHINAGAR",
  people: "Gandhinagaris",
  tagline: "તમારો AI twin, તમારા શહેરમાં.",
  // Map origin used by scripts/build-map.mjs. Keep the two in sync.
  origin: { lat: 23.195, lon: 72.645 },
  // Weather and air quality are looked up for this point.
  weatherPoint: { lat: 23.2156, lon: 72.6369 },
};

export const ENV = {
  supabaseUrl: import.meta.env?.VITE_SUPABASE_URL || "",
  supabaseAnonKey: import.meta.env?.VITE_SUPABASE_ANON_KEY || "",
  // Serverless endpoint for AI twin and AI resident replies. Empty = offline fallback replies.
  aiEndpoint: import.meta.env?.VITE_AI_ENDPOINT || "",
};

export const LIMITS = {
  wavesPerPersonPerDay: 1,
  wavesPerDay: 30,
  requestsPerDay: 20,
  messagesBeforeReply: 3,
  requestExpiryDays: 7,
  planLifetimeDays: 3,
  twinChatRetentionDays: 14,
  maxInterests: 6,
  maxReasons: 3,
  maxSkills: 8,
};

// Blocks phone numbers, emails and links in public text and first messages.
export const CONTACT_PATTERN =
  /(\+?\d[\d\s-]{7,}\d)|([\w.+-]+@[\w-]+\.[\w.]+)|(https?:\/\/|www\.)|(\b[\w-]+\.(com|in|io|net|org|co|me|app|dev)\b)/i;
