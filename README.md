# People of Gandhinagar

A little 3D Gandhinagar you can walk through: Infocity, GIFT City, Akshardham, Dandi Kutir,
Sarita Udyan, Indroda Park, Swagat Holiday Mall and more. Find people by what they do, wave,
chat, post plans, do missions, and leave an AI twin to say kem cho while you are away.

The city is built from real OpenStreetMap data (21k buildings, roads, lakes, the Sabarmati),
and each landmark is a hand-built model based on photos of the real place.

## Run it

```powershell
npm install
npm run dev
```

Open the local URL Vite prints. With no `.env`, it runs in **demo mode**: everything is stored in
this browser, sign-in codes are shown on screen, and two browser tabs can be two different
users (good for testing waves and chat).

Useful extras:

- `http://localhost:5173/?tour`: skips the landing page. In the browser console, `__gnr.shot("akshardham")` frames a landmark.
- Keys: `WASD` walk, drag to look, `Shift` run, `C` cycle, `Q` wave, `E` talk or use a stall, `L` map, `M` missions, `Esc` close.
- Mahatma Mandir: `/?tour&place=dandi&view=overview` opens the rebuilt complex. Any key/drag resumes walking. See [reconstruction notes](docs/MAHATMA-MANDIR.md) for references, measured versus estimated details, and collision checks (`npm run test:navigation`).
- New detail views: `&view=boundary`, `&view=road`, and `&view=people`. Both compounds are fenced, the bridge is walkable, detailed male/female models are bundled locally, and road traffic is excluded from both compounds (`npm run test:traffic`).

## Go live

1. **Supabase** (database, sign-in, realtime): create a project, run `supabase/schema.sql` in
   its SQL editor, then put the URL and anon key in `.env` (see `.env.example`).
   - Email codes work out of the box. **WhatsApp codes need a provider (for example Twilio)**
     set up in Supabase Auth.
   - Optional: turn on `pg_cron` and the two retention jobs at the end of the schema.
2. **Claude** (AI residents and AI twins): set `ANTHROPIC_API_KEY` (server only). Without it,
   simple offline replies are used.
3. **Hosting**: Vercel works as is. It serves `dist/` and runs `api/ai.js` as `/api/ai`. Set
   the same env vars in the Vercel project. Build command `npm run build`, output `dist`.
4. Review `public/terms.html` and `public/privacy.html` (both drafts) and add your contact email.

## Rebuild the map

The raw OpenStreetMap download is in `data/` (git-ignored). To refresh it, re-run the Overpass
query in `data/query.ql` and then:

```powershell
npm run map
```

## Layout

| Path | What it is |
|---|---|
| `src/main.js` | Wires everything: landing, game loop, travel, waves, gigs, realtime |
| `src/world/` | 3D: `city.js` (OSM city), `landmarks.js` + `textures.js` (real-looking landmarks), `avatar.js`, `player.js`, `people.js` (AI residents, members, name tags), `scene.js` (sky, day and night) |
| `src/ui/` | Interface: `hud.js`, `minimap.js`, `dom.js`, and the panels in `social.js`, `profile.js`, `city.js`, `game.js` |
| `src/systems/` | `progress.js` (missions, passport, badges, wallet), `sound.js`, `clock.js` (time, weather, AQI), `festival.js`, `ai.js` |
| `src/backend/` | `local.js` (demo), `supabase.js` (live), `index.js` picks one |
| `src/data/` | `places.js` (coordinates), `content.js` (residents, stalls, missions, events) |
| `api/ai.js` | Serverless endpoint that writes AI replies with Claude |
| `supabase/schema.sql` | Tables, row-level security, limits |
| `docs/FEATURES.md` | Feature list taken from the reference site |

## Feature status

Built and tested in the browser (demo mode):

- Landing page with live weather and AQI, a place strip and a cinematic orbit; visitor mode
- One-time-code sign-in (demo shows the code), 18+ and terms check, sign out
- 3D Gandhinagar from OpenStreetMap, plus 16 recognisable landmarks
- Walking, running and cycling; touch joystick; third-person camera; live mini-map; arrival banners
- AI residents at every place, with name tags, chat (Claude or offline replies) and waves
- Profile in 8 steps with voice fill (Chrome and Edge), 12 characters, 5 skin tones
- About you, profile views, resident card in 3 sizes with download and caption
- AI twin: voice interview, settings, rules, test chat, chat log, clear
- Find someone with filters, search, "for you" matches and directions; Online now; Go and talk
- Connect requests (3 messages before a reply), chats, waves (1 per person per day), block, report
- World chat with emoji and a contact-detail filter
- Plans: post, join, leave, categories, "find company" on sample events
- Utsav calendar with festival previews (kites, diyas, garba lights, flags), "I am interested"
- BRTS fast travel with headcounts, 2D city map with filters, zoom, pan and fullscreen
- Missions: a 6-step chapter, 2 story missions, 2 timed gigs, 3 real-people missions, 12 badges
- Passport with streak and rest day, stamps, firsts, day one; stalls with bargaining; scores
- Time of day, 24h timelapse, day and night lighting; sound (music, city, Gujarati voice guide)
- Suggest a feature; advertising lead form

Written but **not yet run against live services**: the Supabase adapter and schema, and the
Claude endpoint with a real key.

Not built yet:

- Live voice ("Go and talk" walks you to the person and opens chat; the open-mic stage has no voice yet)
- Email notifications for waves; real event and cinema listings (samples for now); analytics
- Exact spots for **LDRP** (not on the map yet) and **The Landmark** (placed at Kudasan, approximate)
