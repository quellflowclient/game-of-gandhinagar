## Mobile review / release preparation — 2026-11-27
- Production browser checks at 320×568, 360×800, 390×844 and 844×390: startup Yes/No paths, normal welcome entry, GIFT recording, car controls, vehicle exit, metro transfers to GIFT/Swagat/LDRP/civic area, and visitor form sizing. No horizontal page overflow or console/media errors observed in the completed checks. Narrow portrait ride-toolbar spacing increased. Browser viewport emulation is Chromium desktop, not physical iOS/Android certification.
- New startup wrapper checks required browser features before model preloads and shows a Retry screen for rejected imports/resources or unsupported graphics, rather than leaving the loading screen stuck. Build targets Chrome/Edge 98, Firefox 94 and Safari 15.4 syntax. WebGL 2 and the checked native APIs remain necessary; outdated or unsupported devices cannot be guaranteed to run this 3D game. References: https://threejs.org/docs/pages/WebGLRenderer and https://developer.apple.com/documentation/safari-release-notes/safari-15_4-release-notes.
- Asset/map waits are bounded; AbortSignal.timeout has a fallback for mobile browser versions lacking it. Map preload/fetch share a new revision query to avoid using an old cached street map. Guest seat IDs also work without secure-context-only crypto.randomUUID.
- Sustained expensive frames lower only the 3D pixel buffer; recovery is gradual. Text, buildings, road geometry and collision rules remain intact. Hidden pages and menus reset the sample history; a single shader compile cannot reduce resolution. This is a fallback, not measured physical-device FPS certification.
- Location question and intro mission now wait for an idle screen: missions/forms, menus, the other prompt and metro do not compete for focus. The location question is hidden behind subsequently opened panels, and does not spend its two-question allowance while deferred. Default focus is Not now. No real GPS permission was granted, no test form submitted, and no real messages sent during QA.
- All 25 automated suites (including mobile, touch, location prompt, voice, music, clock, metro, live geometry and existing gameplay checks) passed across the review; production build passed. Fixed the existing voice test's incomplete media mock and asynchronous settling.
- Push includes the pending destination/geography/metro/audio and multiplayer/admin source changes. Raw recordings, temporary downloads and local output/screenshots are excluded. Database migrations are still NOT executed; pushing the SQL file does not apply it. Existing scale-500 setup limits remain as documented below.

## Supplied GIFT City entry recording — included in release source
- Converted the user's 20261126-1123-03.3683544.mp4 into public/audio/gift-city-entry.mp3 (about 187 seconds, 2.17 MB, 44.1 kHz stereo); the original video is untouched. Full MP3 decode succeeded.
- The existing consented single music stream plays this recording once on each GIFT City visit, at welcome volume, without looping or overlapping the background soundtrack. Background resumes its saved position at completion or on departure. Mute/master sound, hidden-page pause, dialogue ducking, and autoplay retry still apply. Vehicle/menu changes do not restart the clip.
- main.js sends the bounded exploration area to the music player, clears it during metro travel, and omits the generic spoken GIFT arrival name. Music must be enabled for the supplied audio to play.
- test:music, test:metro, and production build passed. Local browser verified native MP3 playback on initial GIFT entry, mute/resume without restart, departure restoring the general track, and return by metro restarting at 0 seconds; no console/media errors. No deploy/push.

## 500+ concurrent players / consented GPS for admin — local only, SQL NOT run
- Old multiplayer could not scale: player_presence + chat tables were on Realtime postgres_changes, ~4 writes/s/player woke every client, each re-ran online_players. Model: ~7,500 DB req/s + 610k RLS checks/s at 500 players.
- New (src/backend/supabase.js): position write ≤1/s when moved (2 s when >400 online, 12 s idle heartbeat, server throttle 0.8 s); positions read from CDN-cached /api/positions (s-maxage=1, 160 m cells, max 150 rows, no names) with direct RPC fallback; roster online_players_near = nearest 80 every 20 s + per-place counts; DMs/waves/calls/voice signals via DB triggers -> private Realtime topic user:<id>; my_inbox_version poll fallback if Realtime socket unavailable; world chat id rides in snapshot. Legacy fallback if SQL not applied. NO player/account cap anywhere.
- main.js renders nearest 40 remote avatars only, arrival toast max 1/20 s, online count from server counts.
- npm run test:scale (model, not real servers): 500 -> ~240 DB req/s, 1000 -> ~440, 2000 -> ~850, realtime ~7 msg/s, snapshot 1.8 KB gzip.
- GPS: src/systems/location.js prompt 1.5 s after entering; Not now -> re-ask after 5 min (max 2/visit) and next visit; granted -> never asks; browser-denied -> never nags. Uploads signed-in players only, 15 s / 20 m, 60 s heartbeat. Admin /admin/locations: Leaflet (unpkg 1.9.4 + SRI) OSM map + table + Google Maps link; refresh 3 s. Verified in browser pane with mock admin and stubbed permission.
- MUST run supabase/scale-500.sql (owner approval) for new path + locations. Needs Supabase Pro (Free = 200 realtime conns) and bigger compute for >1000. Voice test failure (audio.pause) pre-existing. Not committed/pushed.

## Song audibility / playback recovery fix — local only
- Live media actually loaded/advanced without error, but original Gandhinagar recording measured mean -29.8 dB (integrated -27.78 LUFS), versus campus mean -16.2 dB. Two-pass normalized general song to -14 LUFS / -1.5 dBTP target; source file updated, /audio URLs cache-busted with volume2 revision.
- General outside-walk volume default raised from 18% to 25%; welcome/loading/vehicle/campus remain 100%, with temporary 20% relative ducking during spoken dialogue.
- Android/desktop now use native HTML media volume, avoiding an unnecessary potentially suspended second audio graph. iOS retains gain-node volume support, with persistent source node, interrupted/suspended-context recovery and visible Resume action. Hidden-page pending-play cancellation and focus resume hardened. DOM music diagnostics record context/track/target volume.
- Local desktop browser verified Yes → playback readyState4/currentTime advancing at 100%; mute pauses, resume works, entry reduces target to 25%, car returns target to 100% after dialogue ducking, no console/media errors. Physical iOS/Android and actual sound perception not verified.
- Includes previous unpushed 22% sign-text crash fix. Production build passed; no push. Live remains old until deployed.

## Live QA / startup blocker fix — local only
- Live URL game-of-gandhinagar.vercel.app reproduced 22% world-build crash after both Yes and No music choices: TypeError i.map is not a function (main-CcKzJikD.js). Source cause: textTexture applies lines.map before its existing scalar/string normalization; landmarks passes a single string for stripe texture. Both sign helpers now normalize string-or-array before label mapping.
- Live checks: English music dialog appears; Yes advances audio currentTime with readyState 4 and no media error; both choices still crash in deployed build. /admin/content redirects to email sign-in and email field is editable; no OTP sent or privileged actions performed.
- Local candidate http://127.0.0.1:5182 confirmed startup reaches welcome, visitor enters portrait gameplay (390x844), college enrollment 4-digit suffix rejects, branch mismatch rejects, matching college ID passes guard check; visitor 9-digit number invalid, 10-digit synthetic number saves, saved pass reused. Guard preview button exercised without console errors (perceived audio quality not assessed). Car/auto selection and pedal controls present in portrait/landscape (844x390). Travel list has only two destinations and Mahatma travel completes without console errors.
- Not signed off: full acceleration/braking/steering, collision scenes, all map geometry, multiplayer/voice across devices, authenticated admin publish, device heat/FPS/real mobile hardware. Viewport override reset. No real signup, message or database write. All form test data stayed on isolated localhost browser storage.
- Build passed after fix. No push; live site remains affected until deployment. Local Vite candidate started with escalated terminal session 12019 for desktop browser access; sandbox-only dev attempts sessions 71177 and 40345 are redundant.

## Neural recorded dialogue pack — local only
- Generated 33 real MP3 clips using edge-tts / Microsoft neural speech: Hindi Madhur (guard/male), Hindi Swara (female), Gujarati Niranjan (guide), English Prabhat (interview). Hindi Roman dialogue was explicitly written in Devanagari for synthesis; Gujarati retains native script. Synthetic voices, not human actor recordings.
- 33 files in public/audio/dialogues total 594,300 bytes after FFmpeg normalization to -16 LUFS / -1.5 dBTP target, 24 kHz mono, 48 kbps. src/data/dialogue-recordings.json maps exact dialogue + role to clip and pronunciation. scripts/generate-dialogue-audio.py regenerates assets (edge-tts in temporary Python target folder; no runtime neural service/key dependency).
- One Web Audio speech player, only loads clips when needed, 8 decoded clips maximum, one active utterance, bounded 2 MB / 45 s assets, fetch cancellation and brief failed-URL cooldown. Master/voice volume applies. Browser speech remains fallback for new/failed clips, with known native-script pronunciation and gentler fallback pitch.
- Background soundtrack ducks to 20% of its current context volume while speech is playing, then restores. Guard and selected male/female players use their distinct recorded clips. Preview buttons play real clip lines; output/dialogues/voice-preview.html now uses three actual MP3 sample players.
- Admin Voices supports per-role recording URL mappings and add/replace by exact dialogue text; validation accepts local audio paths / HTTPS media with CORS. Renamed dialogue needs its own matching clip. Voice pitch/rate settings affect fallback only, not recorded audio.
- Production build passed, static default content validation passed. No gameplay/browser/device tests or push. Prior production content SQL still NOT executed: automatic-review approval from previous turn remains pending; do not bypass.

## Admin game-content editor — local only / database action blocked
- Added /admin/content with nine sections: names/signs, eight stable stalls (names/call text/staff/menu/prices/hours/enable/coordinates), character dialogue templates, voice settings, ID course/branch and validation settings/staff names, gameplay/roads/limits/day-night, music URLs/volumes/popup, advanced authored geometry, and exact UI/3D-sign text overrides. Full JSON import/export, per-section reset, unsaved-change notice, save draft/publish, revision restore, optimistic revision conflicts.
- Central defaults in src/data/game-defaults.json; public game reads only published settings once at initialization, validates and applies before world construction. Missing/invalid/unavailable data retains defaults; no per-frame network fetch. Some handcrafted props, new model assets, animation code and backend/security configuration remain code/service-managed, not a full visual model editor. Changes apply next game reload.
- Wired live content into guard/Paaji/stall/order/table/crash/interview dialogue, names/sign textures, stall operation/menu, enrollment validation, motor/cycle limits, road width/area, light schedule, soundtrack and geometry collision shapes. General DOM overrides avoid form inputs and use plain text.
- supabase/game-content.sql creates published/draft and append-only history tables; public can read published content, writes only through existing-admin checked RPCs; no browser secret/service-role keys. /admin/content remains export/edit-only with clear setup message until migration is applied.
- Owner Supabase SQL tab 3 (project wcnbaqxqmtbnmbmjyzfx) was available. Exact migration pasted into query 258d8f47-98b5-42b8-b2aa-35271c9f9f8e. Automatic approval review rejected clicking Run because production schema/RLS/grant/security-definer changes require specific user approval. SQL NOT executed. Do not bypass via CLI/another API. Tab marked handoff. Ask user approval after presenting reviewable work.
- Production build passed and central default configuration static validation returned no errors. No gameplay/browser/device tests or push. Earlier local music/pass changes remain unpushed.

## Validated campus forms / guard and player voices — local only
- Replaced generated default SIM IDs with college-member / outside-visitor forms in English. College: full name, enrollment, address, degree, branch, admission/graduation years, semester. Enrollment is two year digits + supported course + branch + exactly five digits; all parsed fields must match the form, course duration and semester range checked. Alumni accepted with completed graduation year.
- Visitor: name, exactly 10 digits mobile, purpose, meeting person/department, origin. Saved per browser/account; repeated visits reuse completed pass. Login remains email only. This checks input format, not an official college roster.
- Gate completion revalidates passes; legacy auto IDs fail validation. Paaji visitor/home-pass shortcuts also require the appropriate completed form. Pending check resets on identity switch. Preserved saved parking and pass metadata. Cached validation avoids per-frame regex work for saved records.
- Guard proximity lines every ~18 s without interrupting existing speech; gate-dwell warning, requested male voice with deep pitch / slower pace. Player stall calls use exact supplied names and character gender. Browser voices vary and offer no guaranteed natural or gender-labelled voice.
- Updated JSON dialogue catalogue. Production build passed; no gameplay/browser/device tests or push.

## Consented welcome / vehicle / campus soundtrack restored — local only
- Restored the two original MP3 assets from HEAD. English Yes/No music dialog appears before game initialization; main awaits either choice. Yes starts audio directly in the trusted button gesture; No starts game loading without music. Each page visit asks again.
- Single audio element / optional Web Audio gain: loading and welcome 100%, outside walking 18%, every vehicle 100%. Inside the exact LDRP campus polygon, LDRP track always overrides the general track at 100%, including on foot and all rides. Leaving switches back. Volume changes and track handoffs fade; track position retained during switches.
- On/off music button, explicit playback retry, hidden-page pause, and master Sound toggle integration. No music download before consent. No extra player iframe or per-vehicle track. Original ambient effects and dialogues remain.
- Production build passed; no browser/gameplay/device tests or push. Supersedes prior song-removal note below.

## Songs removed / dialogue inventory — local only
- Removed both deployed MP3s (~5.8 MB), standalone theme player, music consent/mute/retry UI, ride-radio integration, music settings and unused procedural music code. City effects, browser TTS dialogue and multiplayer voice remain. Original converted output/audio files untouched.
- Added output/dialogues/dialogue-catalog.json: 24 audible fixed lines (including dynamic caller/place expansions), plus text-only Paaji, stall, seating, bargaining and accident captions. AI chat replies have no fixed exhaustive list.
- Production build passed; no gameplay/browser/device tests or push.

## Explicit startup music choice — local only
- Each page load opens a native accessible Music chalana hai? dialog with Yes / No. No automatic playback or audio preload before consent; loading can continue behind the dialog.
- Yes starts/resumes music in the button gesture, preserving welcome/campus/ride volume routing. No or Escape keeps music off; persistent mute button can enable it later. Master mute/zero volume are corrected on explicit enable.
- Autoplay attribute removed. A tap-to-resume action is available if browser playback still rejects. Production build passed; no gameplay/browser/device tests or push.

## Music unlock / garden fronts / outside footpaths — local only
- Web Audio creation now requires actual browser user activation; programmatic ride selection retains native playback. Pointer-up, touch-end and click retry playback/resume. Music toggle reflects master mute and explicitly re-enables sound when requested. Audible autoplay still depends on browser permission/gesture.
- Front garden tree strips now have outer stone borders with rounded gate-side tips, enclosed planting and no duplicate inner lawn curb beside those beds.
- Road 5 carriageways now 12 m each; shared outward expansion shifts campus/stalls while retaining median edge. Parking footpaths sample the actual asphalt clearance and full path footprint inside lots, excluding gate apron/campus boundary. Flush parking openings retained.
- Generic sidewalks also check their own road at bends, preventing a return curve from putting paving over asphalt. Gate apron included in city-walk replacement clearing.
- Production build passed; no browser/gameplay/device testing or push.

## Simple metro loader and lighter runtime — local only
- Replaced world-assembly loader with Gandhinagar loading text, small CSS metro animation and real progress. Reduced-motion supported. Welcome artwork retained.
- Added lossless gzip human GLBs: 10,697,724 to 9,404,905 bytes combined (~1.29 MB saved), streamed browser decompression with original GLB fallback. Preloads match supported format.
- Removed duplicate traffic matrix rendering, precomputed traffic mesh list, cached static parking world matrices, and avoided unchanged wet-material updates. Startup yields between heavy phases so loader can paint. Render resolution and model appearance retained.
- Production build passed. No gameplay/browser/device testing; phone performance and heat not measured. Not pushed.

## Visible sun/moon and readable lighting — local only
- Added procedural sun disc / soft halo and cratered moon sprites anchored in sky direction; no external image downloads or postprocessing.
- Sun visibility follows existing 07:00–19:00 custom schedule; moon at night follows a visual arc (not real astronomical phase/position).
- Warm stronger daylight and shadow fill. Night directional moonlight is softened, ambient/hemi visibility retained, blue night sky/stars; streetlight schedule remains 18:00–06:30.
- Added three small sky draw calls; existing low-power phone/shadow settings remain.
- Production build passed; shader insertion checked against installed Sky.js source. No browser/gameplay/device visual testing or push.

## Welcome background and world assembly loader — local only
- Added lightweight original SVG evening-city artwork at public/art/gog-city.svg (about 11 KB), with campus facade, salt-mound silhouette, avenue and planting. Illustrated, not a surveyed image.
- New welcome.css adds dark emerald/gold welcome treatment, clearer actions, two location cards, responsive portrait/landscape and scrollable short-height layout.
- Loading illustration builds up four structures using actual setLoading progress; terrain/streets/people milestones follow real loading stages, with no artificial delay. Reduced-motion support included.
- Opaque static welcome artwork no longer runs hidden world simulation or renders the 3D orbit; music still updates before the welcome frame early return.
- Production build passed. No browser/device/visual testing or push. Earlier pending changes remain local.

## Portrait gameplay / mute / jump / premium car — local only
- Removed portrait gameplay blocking and automatic fullscreen/orientation locking. Both orientations follow the phone; fullscreen is explicit only.
- Portrait HUD positions for ride choices, jump, joystick, steering/pedals, speed and interactions. Jump is walk-only, Space supported, ballistic height approx .9 m, no double-jump, blends a knee/arm pose and follows camera/presence height. Ground navigation still constrains horizontal movement.
- Removed continuous generated traffic/water noise loops (wind-like hiss); discrete effects remain.
- Soundtrack attempts autoplay from parsing/loading and retries on first user gesture without asking. Persistent screen mute/unmute syncs to Sound settings. Browser audible-autoplay restrictions cannot be bypassed; actual media errors retain Retry.
- Added custom premium fastback player/owned car geometry with metallic body, sloped cabin, LED-style lamps, grille and alloys; same car collision/speed dimensions. No external model download or new rendering effects.
- Production build passed, no gameplay/browser/device tests or push. Earlier accident/road/gate changes also remain local.

## Wider college frontage road — local only
- Road 5 carriageways widened from 4.8 m to 10.2 m each. Centre lines shift outward by 2.7 m, preserving the median-side edge and fixed metro geometry.
- Shared width is used by road mesh, road clearance, driving footprints, sidewalk placement and traffic. Two same-direction car lane positions plus an outer two-wheeler position; dashed same-direction road markings.
- Campus frontage/parking frame and stall/shoulder/backdrop rows set back by the 5.4 m outer expansion to retain their existing road clearance and pedestrian space. Campus building layout within the frame is unchanged.
- Production build passed; no browser/gameplay/device tests or push.

## Accident continuity / campus edges / sliding exit — local only
- Fixed traffic disappearance: contact pauses and cinematic recovery retain the vehicle/route, animate impact deflection and straighten/pull away. Damage stays on the visible vehicle. Damaged route-end vehicles stay parked nearby rather than respawn in view.
- Impact recoil/yaw constrained to road-valid candidate poses; player wreck receives a matching short impact tween. Recovering traffic suppresses repeat accident effects.
- Outer roadside parking footpath now has a raised extruded top at .48 m (old .18 m was below public road surface), edge curbs, matching navigation height, flush driveway gaps retained.
- Replaced exit barrier pipe with a steel sliding gate, ground rail/wheels, horizontal opening and moving collision footprint; gate animation uses elapsed time.
- Garden outer borders strengthened; promenade border splits only at path openings (previous whole-run filtering omitted it); grass/trees kept inside border.
- Left/right controls use matching pedal faces, grip ribs and held state for all motor rides.
- Production build only. No browser/gameplay/device test or push.

## LDRP campus soundtrack — local only
- New user recording 20261126-0544-56.2721238.mp4 extracted to public/audio/ldrp-campus.mp3 (3:53, ~3.8 MB).
- Two-pass FFmpeg loudnorm, target -14 LUFS / -1.5 dBTP, from measured -28.97 LUFS recording; 48kHz MP3.
- Actual LDRP campus polygon selects campus track regardless of walking/cycle/vehicle. Campus volume full selected level; mute and voice duck remain respected.
- Leaving campus restores main theme, with short fade and independent saved playback positions. One audio element/decoder, campus file loaded only when needed.
- Production build only, no device/gameplay tests; not pushed.

## Unified user-provided music — local only
- User recording extracted as MP3, bundled at public/audio/gog-theme.mp3 (~2 MB).
- Removed old YouTube ride tracks/player and device override picker/manifest; one continuous loop now covers all vehicles and welcome/walking.
- Tiny classic theme-player.js starts before the large game module so loading screen music/unlock works independently of map/model readiness.
- Default selected music volume 100%; welcome/loading 100%, walking fades to 18%, any vehicle 100%; voice conversations duck to 6%. Existing master mute remains respected; Sound page has unified music controls. Legacy music preferences migrated on first save.
- Native autoplay attempted, gesture retry and visible enable button when blocked; media-element WebAudio gain handles volume fades on mobile without changing device volume. Hidden tab pauses.
- Production build only, no browser/device audio test or push.

## Driving controls and ride access — local only
- Direct Car / Rickshaw / Rides / Exit toolbar; shared selection guard for meals and moving vehicles.
- Removed D/R toggle. Accelerator drives forward; Brake/Reverse first stops forward motion and then reverses while held. Opposing pedals or Space brake without reverse. Keyboard W/S matches pedals.
- Signed steering smoothed; reverse turns follow signed movement. Camera starts behind vehicle and recentres after manual looking stops.
- Pointer-capture cleanup handles simultaneous steering/pedals and multiple fingers on one button; accident/page/rotation locks clear held inputs.
- Road spawn searches valid lane offsets near the player instead of only road centre, preserving full footprint / campus restrictions.
- Speed HUD labels STOP / D / R. No render-quality reduction.
- Production build only, no gameplay/device tests, no push. TURN and email-template changes from earlier requests remain uncommitted too.

## Parking / roadside footpath correction — local only
- Parking bay placement validates the full footprint, excluding gate apron, public roadway, footpath and six-metre parking access openings.
- Raised 18 cm roadside paver footpaths along the two outside parking lots; driveway breaks remain flush. Navigation heights and vehicle exclusion use the footpath geometry.
- Saved personal parked vehicles revalidated against free current bays, so old apron positions cannot reappear.
- Production build only; no browser/gameplay testing or push.

## Phone load optimisation — local only
- Preserved render resolution, textures, frame-rate targets and scene detail.
- Menu/account overlays now suspend hidden 3D simulation; voice and presence stay serviced.
- Stall business hours recalculated on minute/day changes; resident spawn/despawn checks twice per simulation second.
- Static merged site geometry now indexed with UV/normal-aware vertex welding, temporary geometry buffers disposed, bounds cached, local mesh matrices frozen. City static meshes also skip local matrix recomputation.
- Production build passed. No browser/device/thermal tests, no push. Actual heat/load improvement is unmeasured; no zero-heat guarantee.

## Canteen / Mechanical separation correction · 2026-11-25 (local only)
- User clarified the two strips are separate: black is the long narrow ground-floor canteen behind Mechanical, blue is Mechanical ground + 3 upper floors.
- Canteen footprint [28,180,39,239], 3.4 m / 1 storey. Mechanical footprint [44,180,67,239], 13.6 m / 4 storeys. The 5-reference-pixel gap between the footprints is retained.
- Facade floor spacing now respects explicit per-block floor counts. Both buildings have independent meshes, labels and collision footprints. Earlier replacement of Mechanical by canteen is superseded.
- Updated 2D map: 1* = canteen, M = Mechanical. Build only; no gameplay tests or push.

## Garden borders / housing labels / fixed light schedule · 2026-11-25 (local only)
- Latest annotation overrides the prior Mechanical request at mark 1: long canteen on west edge. Hostel labels A (SE), B (SW of A), C (former engineering-east courtyard), D (right section of long south block), E (new upper east strip). The left part beside D has three small single-storey sloped-roof homes.
- Mark 2: three-floor premium guest house directly below C, with stone/bronze/glazed facade detailing. Mark 4: separate faculty residences below E, not labelled as a hostel. East bus-depot models and scripted depot-bus trip removed to avoid overlapping these footprints; west bus park retained. Latest map used an older screenshot: earlier relocated parking/curved links retained unless explicitly superseded.
- Narrow planted strips now have a full outer stone border, soil surface, tree row and inner hedge inside it, with closed ends. Plant beds remain off paths, buildings and paved hostel yards; front lawns remain walkable/sittable.
- Shared lightingSchedule: lamp/headlight/floodlight ON at 18:00, OFF at 06:30 IST; visual darkness begins 19:00, sunrise transition 06:30–07:00, sun clearly visible from 07:00. Bright night visibility preserved. This user-defined visual schedule overrides weather API solar hours for rendering only.
- Updated source-derived 2D map under output/maps. Production compilation only; no agents, gameplay tests or push.

## Annotated campus corrections · 2026-11-25 (local only)
- User's latest black 1 is Mechanical Engineering building: photo rect [39,180,67,239], west/south corner above Hostel D. Black 2 is inside two-wheeler parking: [413,128]–[487,140], directly below academic block 16.
- Removed old canteen block (map key 10) and moved old MIPLVP-side parking (key 11); old saved inside-parking vehicles migrate to a free bay in the new lot.
- Three curved infill buildings connect adjacent radial academic wings. Shared ACADEMIC_LINKS geometry drives meshes and collision footprints; endpoints match wing sides.
- Campus drives use one black-marked route: straight front drive, smooth west/rear loop, academic side access and one branch between hostel blocks. Removed the duplicate west boundary loop and duplicate parallel hostel road. Removed broad west-passage slab that looked like another road. Public Road 5 carriageways unchanged.
- Hostel precinct is paved; courtyard floors remain concrete/pavers and vegetation generators exclude HOSTEL_YARD. Front four gardens retained.
- Updated source-derived 2D map under output/maps: M = user's Mechanical mark 1; P = user's new parking mark 2. Old 10/11 labels removed from map. Approximate reference geometry, not a survey.
- Production compilation only; no agents, gameplay tests or push.

## Voice / portrait pages / walkable gardens / phone performance · 2026-11-25 (local only)
- Normal 1:1 calls no longer get muted by distance/presence lookup. Added incoming-call DB polling fallback, serialized signalling, connection initialization guard, streamless audio-track support, autoplay Enable-audio UI, microphone cancellation and call/room mutual exclusion. Table voice buffers early ICE and preserves it through incoming offers.
- Shared voice-ice client defaults to /api/turn. Authenticated Vercel/dev endpoint mints Cloudflare short-lived credentials using server-only TURN_KEY_ID + TURN_KEY_API_TOKEN. These credentials were not supplied/configured, so restrictive mobile-network voice is still externally dependent. No real two-device voice check was run.
- Landscape guard now applies only to active gameplay. Landing, admin, open Hub, panels and voice UI work in portrait; a portrait gate button opens the Hub without enabling portrait gameplay. Panel mode unlocks orientation; resuming gameplay requires landscape. Phone rendering pauses behind pages/Hub and portrait gate.
- Four front gardens use clipped lawn edges with 3.6 m constant radial walkways and a widened gate-side opening. Removed all benches in these gardens; vegetation kept away from paths. Garden sitting uses the player's current lawn position (with collision/NPC clearance), not preassigned seats. Gate actions cannot override ground-sit/stand in lawns.
- Phone profile: low-power WebGL preference, no MSAA or dynamic shadows/PMREM, bounded 1.2 MP buffer and max 1.25 pixel ratio, ~24 FPS gameplay / 12 FPS landing. Pages update at 5 Hz without scene rendering; hidden tabs skip simulation/render. Desktop capped at 30 FPS. Reduced traffic and nearby NPCs; backend, humans, vehicles and map downloads overlap.
- Three.js still uses GPU; zero heating or a measured temperature improvement cannot be promised. Large model files remain, with existing model HTTP caching.
- Build compilation only; no agents, gameplay/device tests or push. Other campus layout work intentionally left for later reference images.

## Accident / landscape / hours / night visibility · 2026-11-25 (local only)
- Collisions: pedestrian impact threshold 4.2 m/s, motor/motor 6.5 m/s; contact still stops vehicles. Moving apart from an existing overlap is allowed; stopped traffic contact no longer restarts its pause forever. Earlier traffic braking, wider lookahead and no random distracted-driver event.
- Cinematic shortened to 4.2 s (minor) or 7 s (medical), always skippable. Serious player impacts / pedestrian or two-wheeler injuries show a 108 van and medic using nearby valid road poses where available. Traffic brakes for the response van. This is a game animation, no actual emergency call.
- Recovery clears wreck/fallen ride state, returns to walking at a nearby road-free navigation surface if found and provides 12 s accident-effect immunity (physical contact still blocks). Incident traffic is respawned at least 65 m away. If no safe road-free point is found, navigation fallback is used.
- Landscape welcome screen now uses header/main/footer document flow, two columns in short landscape and scrolling when needed; no absolute-centred hero overlapping header/footer.
- Night: brighter hemisphere, moon/key, environment and ambient fill, increased exposure and lighter distant fog. Day/night still follows existing live IST + Gujarat sunrise/sunset calculation; night sky stays distinct.
- Stall schedule is shared by world covers/staff/steam and service/order guards, based on IST weekday. Babu 8–16, Sunday closed; Anjali Pav-Bhaji 8–16 (stable internal id chintu; Chintu remains staff). Tea: Natu/Ajit 6–23, Patel 6–22, Lalbhai 6–21, Masi/Sarpanch 6–20. Paid/cooking meals can finish after closing; new calls and unordered requests close.
- Garden-seat sync no longer stands a garden sitter up when street-table state refreshes.
- Production build only. No agents, gameplay/device tests or push in this pass; animation/layout appearance remains unverified in browser.

## Local ride-audio support · 2026-11-25 (local only)
- Added `local-ride-audio.js`: per-ride audio-file chooser and browser IndexedDB persistence, automatic looping playback on selecting/mounting a ride, per-ride switching, stop on walking/crash, pause on tab hidden/rotation/master mute/voice calls, shared independent ride volume. A small start button appears only if autoplay is blocked.
- Local audio takes priority over the previous visible YouTube fallback and plays without a video panel. No copyrighted recordings were ripped/downloaded. The requested commercial audio files remain missing.
- Authorised files can be selected from Hub > Sound > Local ride songs (device only), or bundled under public/audio/rides with manifest.json entries for car/bike/auto/scooter/cycle. The manifest currently contains null values, not fake audio paths.
- Production compilation only; no browser/audio tests or pushes.

## Rickshaw song replacement · 2026-11-25 (local only)
- User requested a funnier replacement for Hun Amdavadno Rickshawalo. Auto now streams Umesh Barot / Raghav Digital's Baby Mood Ma Nathi (official video title Baby Ne Bournvita Pivdavu): https://www.youtube.com/watch?v=wKrR-9WOxlw . Sound-page label updated. No push or tests.

## Ride radio · 2026-11-25 (LOCAL ONLY — user said do not push)
- New `src/data/ride-tracks.js` maps car, bike, auto, scooter and cycle to verified searchable official YouTube releases. No MP3s were downloaded or rehosted.
- Car: Char Bangadi Wari Gaadi (Kathiawadi King / Red Ribbon); bike: Dhoom Machale (YRF, original is Hindi); auto: Hun Amdavadno Rickshawalo (Kishore Kumar / Universal Music); scooter: Prem Nu Activa (Vishal Hapor / Amara Muzik); cycle: Cycle Cycle Mari Sonani (Bhoomi Trivedi / Ramzat 3).
- `src/ui/ride-radio.js`: visible 200x200 official player, lazy IFrame API, autoplay attempt with native Play fallback, manual pause preserved, loop, source link, error/retry, no retry storm. Dismount/crash stops; panels/Hub/portrait/hidden tab/voice calls pause. Background-only YouTube playback is not used.
- Sound settings: persistent ride toggle + independent volume (default 65); master mute honoured; procedural background music ducks while the song plays. Ride streams can contain platform ads or be region/embed restricted; offline and automatic playback are not guaranteed.
- Production build passed. No agents or gameplay/audio tests run; songs' actual embedded playback remains unverified. No commit or push for this work.

## Landscape-only / single Hub correction · 2026-11-25
- Supersedes the earlier portrait-form exception: shared `src/ui/landscape.js` + CSS run from both game and admin HTML before their main apps. Portrait touch devices cannot use landing, login, sheets or gameplay; background is inert until landscape. Physical orientation avoids keyboard-resize false positives.
- First landing interaction and the rotate gate button request fullscreen, then best-effort landscape lock. Browser restrictions can require manual physical rotation; no fake CSS rotation or bypass is provided.
- Removed the three-button bottom dock from HUD markup. One upper-right Hub launcher opens Map, Travel, Ride, Profile, Campus ID, Camera, Controls, Sound, Time and Fullscreen. Non-movement quick buttons/minimap hidden; movement, run and driving controls remain at thumb positions.
- Panels and Hub have short-landscape sizing, safe areas and internal scrolling. Production build passed. No agents, browser/device tests, deployment or building changes in this correction.

## UI pass · 2026-11-25 (local)
- User scope: admin, menu/profile/ID styling, landscape phone play and riding controls only; no building edits in this pass. No agents or tests.
- Separate admin entry `admin/index.html`, routes `/admin`, `/admin/live`, `/admin/users`, `/admin/connections`, `/admin/settings`; middleware now covers Vite preview as well as dev. Existing Vercel rewrites preserved.
- Admin email/OTP are native labelled forms, immediately rendered before session restoration; validation, error recovery, manual verification and input-safe CSS. Authorised `public.admins` account and installed admin RPCs still required; no privileges bypassed.
- `src/game-shell.css` is the final UI layer: dark HUD/Game hub, light responsive sheets, profile/card/ride layouts and safe areas. Dock: Explore / Travel / Game hub. Help under Controls.
- `game-controls.js`: independent multi-pointer steering, accelerator, separate stopping brake, D/R switch only when stopped, fullscreen and portrait gameplay rotate gate. Forms/admin remain usable in portrait. Orientation locking is best-effort browser support.
- `player.js`: touch drive input, Space brake, independent motor axes, adaptive joystick radius, reset on blur/panels/visibility. Shared panels manage focus and Tab/Esc.
- Production compilation passed during this pass. No browser or device gameplay checks run, per user instruction. No new deployment made during this pass.

# Handoff · People of Gandhinagar (last updated 2026-11-25, session 2)

## Session 2026-11-25 part 5 (shops, trains, premium UI, OTP, admin)
- Campus: CAMPUS_SHOPS (stationery/xerox at local (-31,1.4), bike garage (-44.5,1.6),
  paved yard), WEST_JUNCTION paved, strip along drive 1 (westPassage +-11 m) paved and
  kept free of plants. Wall pulled ~2.5 m back from the roundabout/road edges.
- `world/metro-trains.js`: 3-car white/blue/orange sets on both tracks (left-hand),
  accel 1 m/s2, 70 km/h, 20 s station dwell, 210 s headway; drawn only within 1.4 km.
  `metro.trains.update(t,center)` + setNight. Metro deck mitred (no gaps).
- Loading: `public/data/gandhinagar-live.json` (141 KB, `npm run map:live`) replaces the
  4.7 MB map download (createLiveMap is idempotent via `smoothed` flag); index.html
  preloads live map + both GLBs; branded loader with % (setLoading(text,pct)).
- UI: `src/premium.css` design layer (Inter, graphite ink, green brand). New landing
  (Enter the city / Sign in with email / start-at cards). Menu grouped You/People/City/
  Settings (removed Day one, Passport, Scores, Utsav, Advertise, Suggest, dup Map/Card).
  Sign-in: email step + 6-digit OTP screen (auto-submit, resend 30 s, change email,
  friendly errors). `openAccount` profile page. dom.js `calmCase` turns ALL-CAPS panel
  titles/headings into sentence case. Campus/street chips hidden on landing.
- OTP email: `supabase/templates/otp.html` (uses {{ .Token }}); also referenced in
  config.toml. MUST be pasted in Dashboard -> Authentication -> Emails -> Templates for
  "Confirm signup" and "Magic Link" (subject: Your Gandhinagar sign-in code: {{ .Token }}).
- Admin: `admin.html` + `src/admin/` (separate Vite input). Needs `supabase/admin.sql`
  run in the SQL editor + one `insert into public.admins` for the owner's email.
  Views: Overview, Live map (3 s), Users (search, drawer with connections + movement
  history), Connections (graph + table). Dev QA: /admin.html?mock. presence_log is
  append-only (20 s sampling); delete triggers on profiles, threads, messages,
  world_messages, waves, presence_log, plans, reports, voice_calls.

## Session 2026-11-25 part 4 (gate rework, Paaji, bus depot)
- "Left/right" = as seen from Road 5 facing the campus: left opening = local +u.
- Left opening: pedestrian ENTRY only (yellow barricade lane at u 3.2-6.8, sign);
  vehicles always forbidden there; walking out blocked once `entry.side==='inside'`.
  Right opening: buses in/out, everyone exits; two-wheelers may only come OUT
  (forbidden entering while `entry.side==='outside'`). Left boom removed.
  NOTE: this means bikes/Activa currently have no way IN — confirm with user.
- Security cabin, 2 umbrellas, bench moved OUTSIDE centre (cabin at 0,-5.4).
  Market shoulder #4 (sand patch at gate) no longer drawn; still walkable.
- `GATE_FORECOURT`, `BUS_DEPOT`, `FLAG_POINT` in ldrp-reference.js. Curbs are
  cut wherever they would lie on another drive/path/forecourt/depot (`curbRuns`).
  Flag moved off the central path to lawn (204,66 photo).
- Bus depot (east strip beside departments block): 2 parked buses + scripted
  trip bus out/in via right opening (waits 40 s, then 90/150 s), stops for player.
- Paaji (campus.js `updatePaji`): heavy build (`avatar.setBuild`), turban+beard
  meshes on head socket, desk with register + passes at local (15.2,-4.3),
  Bajaj at (19.2,-4.9); rides a round on Road 5 edge every 6-10 min; jokes in
  Punjabi-Hinglish bubbles; "Paaji · Register / Pass" panel gives visitor pass
  (sets entry.allowed) or hostel going-home pass.

- Part 4b: OUTSIDE_APRON concrete (u -10.6..19.5, v -13.6..0.15, y .29) replaces
  asphalt stub/sand at the gate; outside furniture lives in `front` group (y .29);
  outsideZone heights use APRON_Y there. Signs removed (rules only). Lane narrowed
  to u 4.25-5.75. `D.patioUmbrella` (8 panels, ribs, base). Paaji desk at (13.9,-3.35)
  next to left column, setBuild 1.55 + root scale 1.08. GATE_GARDEN half circle
  (centre 0,.75 r 3.5) inside between openings: curb, soil, 3 small trees, bushes,
  150 instanced flowers (added AFTER mergeStatic - mergeStatic drops instanced meshes),
  solid poly so nobody walks in. GATE_FORECOURT widened to photo x 190-240.

- Part 4c: security cabin moved INSIDE onto the gate island (cab 0,2.3, windows to
  both openings + campus); GATE_GARDEN r 4.4 wraps its front (trees, bushes,
  topiary, 190 flowers). Outside: one umbrella (1.05,-5.3), table (0,-5.6) and the
  seated guard (campus.guard 0,-4.85, faces road / player, stands only to check
  IDs). Lane moved to u 5.6-7.1; trip-bus gate waypoint x 203. FLAG_POINT (200,74)
  is 2.6 m clear of every garden path.

- Part 4d: all internal drives 5.5 m (gate throat 20 m). Front drive 0 is one
  straight line (121,46)->(300,46) then gentle bend east; gate drive straight
  (215,-1)->(215,44); GATE_FORECOURT is a clean rectangle x 191-239, y -1..44.
  Cabin on concrete at (0,2.25) with its own solid; GATE_GARDEN (c 0,3.6 r 3.2)
  only in FRONT of the cabin. FLAG_POINT photo (220,79): lawn below the two
  bushes between the centre path and the right diagonal path (user's circle).

- Part 4e: CAMPUS_BOUNDARY west corner now runs along the metro viaduct's outer
  edge ((31,88),(45,56),(83,24),(124,3),(128,21)); WEST_BUS_PARK concrete (.149)
  between it and the west drive, 4 parked buses on the campus side of the pillars
  (slots need whole bus on slab + 2 m from every pier). WEST_METRO_PIERS (photo
  (131,9),(89,31),(53,61)) get keep-clear hatch boxes + bollards + 1.6 m solid.
  Hedges (2.4 m rects) and bush/topiary crowns are now zone solids via
  `shrubs.solids()` — cycles (and walkers) cannot pass through them.

- Part 4f: `drivingSpeed` is signed (reverse: car 14, auto 10, bike/scooter 6 km/h;
  brake before reverse; coast when throttle released). Player motor steering is a
  bicycle model (yaw = v/L*tan(steer), steer shrinks with speed, inverts in reverse).
  Cycle rolls along heading and turns in an arc (no sideways slide). test:reverse.
  Metro deck uses shared mitred offsets (offsetPath) - no wedge gaps on curves.
  Gate: through the left opening only walkers inside the barricade lane (cycles
  detected by nav radius > .45). Gardens (FOUR_GARDENS): walk only - cycles get no
  heights, bike/scooter forbidden. Garden hedge replaced by `createGrassBorders`
  (60 cm instanced grass, solid) with 3 openings: middle of both radial edges + arc.

- Part 4g: whole west triangle inside: boundary follows Road 5 / roundabout /
  south-road edges (measured with roadClearance): (25.5,92),(25.5,36),(31,25),
  (44,16.5),(60,9.5),(78,6.5),(128,6.5),(128,21). WEST_BUS_PARK covers it all and
  meets drive 1; up to 9 buses in 3 rows (-3.9/+6.2/+10.4 m from pier line), each
  >2 m from piers and >1.2 m off drive 1. Drive 1 rerouted (121,46)->(104,42)->
  (84,49)->(60,72)->(47,83)->(36,93)->(33,112)->(40,145): it previously ran through
  the front ring's west end and the 7pi/8 wing (blocked). 54/54 samples now open.

## Session 2026-11-25 part 3 (Street View look pass)
- Reference: user's Street View walk-through of LDRP (frames in scratchpad only).
- New `sites/ldrp-dressing.js`: concrete drive texture (joints, tyre polish),
  red/cream wave-paver walkway texture, chunky stone curb ribbons, instanced
  hedge clumps (no shadow) + topiary/bush crowns (shadow), hedge ribbons merged,
  pink planter posts. `ldrp-campus.js` drives now concrete (not red brick), hedge
  rows + topiary + shade trees line every internal drive, gardens get 1.05 m
  hedges and topiary ring. `kit.ksvFacade` redrawn: 12 m two-bay tile with blue
  reflective glass band + punched window/AC grille, roughness map (glossy glass).
- Sky: turbidity 3.2, rayleigh 2.3, shader saturation/blue-with-elevation patch,
  day fog near 650, exposure .84.
- Perf at gate view: 1.74M tris / 773 calls (was 4.1M/1276 with first shrub try;
  ~2.5M before this pass). Shadow pass ~570k tris / 345 calls is next target.
- SMTP: user set Gmail SMTP; POST /auth/v1/otp returned 200 (one code email sent
  to the sender address as a test).

## Session 2026-11-25 (traffic realism, tapri circles, group voice) — read first
- Traffic (`traffic-routes.js`): drivers brake for anything in their lane corridor
  (player, residents, campus students, other vehicles incl. junctions; lower id has
  priority so no deadlock), stop ~2.5 m short and move on when clear. Waiting >3 s
  near the player = honk (`sound.honk`). `trafficDensity(hour)`: full 08:30-10:00
  and 14:00-16:00 IST, ~0.4 midday/evening, ~0.1 night. Rare "distracted driver"
  every 25-45 min is the only NPC-caused accident. Crash scene needs >4 m/s impact;
  collision hit effects need >2.8 m/s (slow bumps just stop).
- Vehicles (`vehicle-models.js`): seated driver in every car (right-hand drive) +
  front passenger, auto driver + 2 rear passengers, bus driver + 6 passengers, new
  procedural `bike`/`scooter` traffic with helmeted riders. Glass now transparent.
  Autos green with yellow canopy, buses yellow.
- Tea tapris: 5 circles (4,4,4,5,5 low seats) around a round chai table instead of
  the 5x5 grid; seats carry `circle`. Seat stools are 46 cm.
- Group voice (`systems/voice-room.js`): sitting at a circle shows "🎙 Table voice
  join karo"; WebRTC mesh (max 6) with signalling over Supabase Realtime
  broadcast/presence (`backend.voiceRoom`), demo backend uses BroadcastChannel.
  Standing up leaves the room. 1:1 call: chip "🎙 Call / 💬 Chat" when another real
  player is within 7 m; call polling fallback 3-4 s instead of 12 s.
- Loader shows character download %; `vercel.json` caches /models and /data.
- LDRP_PLAY_AREA minU -375 -> -432 so the east hostels of the new campus are reachable.
- New tests: `test:yield`, `test:voice-room`; site/street/driving tests updated to
  new layout. All 17 suites + build pass. In-game check: sedan 12 m/s stopped 2.7 m
  before the player, then drove on.
- EMAIL ROOT CAUSE: no custom SMTP; Supabase built-in mailer only delivers to the
  project's team addresses (~2/hour). Owner must add SMTP (Gmail app password or
  Brevo) in Supabase → Authentication → Emails → SMTP. Until then sign-in, chat,
  multiplayer and voice cannot be used by the public. TURN server still not set
  (needed for calls on many mobile networks).
- NOT done: deploy (nothing committed/pushed), two-device voice test, accident
  animation polish, campus visual matching items from the earlier list.

## Earlier notes

## Latest release work — read before historical notes

Follow-up: procedural airborne fall/grounded pose and user-triggered Get up
replace automatic respawn. Nearby motor/motor incidents use a brief slow-motion
camera, deformed standalone damage meshes, two drivers exiting/arguing, a
mediator, driver return and staggered departure. Fallen cycles remain beside the
rider. LDRP now has a 1.85 m wall, detailed open gate and one 25 m garden flag;
roof/hub flags removed, textured campus roads and open-ground cycling allowed.
The user explicitly requested no agents and no tests for this follow-up.
Only the production build was run; new animations are not visually verified.

Only LDRP / KH-5 and Mahatma Mandir are exposed. Full other-location source is
retained. Supabase project `wcnbaqxqmtbnmbmjyzfx` is installed and connected;
browser-safe publishable configuration is in `src/backend/project.js` with
environment overrides. `.env.local` is ignored. Email-only sign-in is enforced
in both backends; hosted Email is enabled, Phone disabled, confirmation required.
Production site URL and localhost 5175/5177 redirect URLs are saved in Supabase.
Custom SMTP is NOT configured yet. Do not claim public email delivery works.

Installed SQL: schema, multiplayer, voice, seats, seats-seed, grants. A real SQL
transaction tested verified-player presence, exclusive table ownership, recipient
chat access, and private voice signals; all account fixtures were rolled back.
No passwords or email sends were involved. Anonymous API checks also passed.
No two-device authenticated browser or actual microphone/audio test yet.

Road 5 retains original straight surveyed points. Shared mitred ribbons and
160-sample roundabout remove disconnected segment edges. Sidewalks clip before
crossing asphalt. Median mesh is generated only between paired carriageways;
the duplicate guessed market median was removed. KH-5 has the photographed
gear/figure sculpture, signals and slim lamps. Trees, columns and lamps are
checked against asphalt; stall lamps moved outside counters. Reconstruction
remains approximate, not a survey-grade one-to-one digital twin.

Actual shoe-sole grounding: 1,620 pose checks. Cycling: 5,760 contacts. Collision
uses swept oriented footprints with stop, dust/sound/flash, body stagger, damaged
paint and a safe recovery action. This is arcade accident feedback, not rigid
body crash simulation. Table recovery releases carried tables.

166 sitting tables now use two GPU instance batches rather than 332 individual
meshes. CPU site check is ~330 meshes. Phone viewport 390×844 was inspected:
1080×2337 drawing buffer, ~452 calls / 648k triangles in circle view. These are
render statistics, not a physical-phone FPS measurement. Joystick, ride/camera,
compact dock and contextual order sheet were visually checked.

Shared tables use authenticated database leases (30 s, renewed every 4 s),
atomic ownership and one table per player. Visitors retain isolated local demo
claims. Optional 1:1 WebRTC voice has accept/decline, mute, hangup, timeout and
track cleanup; no auto microphone. TURN setup is optional but needed for
reliable restrictive-network calling. Quick join asks name + male/female;
the detailed profile remains optional.

Latest checks: navigation, traffic, cycling, activities, driving, clock, live,
street, grounding, sidewalks, collision, voice consent/resources, Road 5 and
site geometry. Rebuild after any remaining edits and verify public deployment.

Historical notes below can describe superseded demo-only behavior.

Read this first in a new session instead of re-exploring. See README.md for setup and full feature status.

Latest LDRP street-life pass: read `docs/STREET-LIFE.md`. Eight PDF-positioned
shops now have reference-photo geometry, named rigged staff, approach/order/
deliver/eat/pay-afterwards interactions, group permissions and exclusive movable
small sitting tables. Phone joystick/run/context actions and road/paving height
alignment (including planted feet and tyres) are included. New files:
`ldrp-market*.js`, `ldrp-stall-models.js`, `activity-pose.js`, `street-service.js`,
`ui/street.js`; tests `test:street`, `test:activities`. Local demo seat claims use
Web Locks/storage, not a deployed cross-device furniture server. No publishing.

## What it is
Gandhinagar version of peopleofahmedabad.com (feature list in docs/FEATURES.md), built with
Vite + Three.js 0.169 (vanilla JS). Demo backend = localStorage + BroadcastChannel; Supabase
adapter + supabase/schema.sql written but NOT run live; Claude endpoint api/ai.js (claude-opus-5-5,
low effort, server-side fallbacks) NOT tested with a real key.

## Session 2026-11-24 (real-life priority sites) — read first
- New `src/world/sites/`: `kit.js` (frame u/v transforms, PBR double-sided mats, OSM footprint extrusion with facades, curbs/hedges/palms/trees/lamps/benches/compound walls with gates/flags/bikes/cars, `mergeStatic`, `createSiteZone` with solids/walls/vehicleFree/`walkable`), `ldrp.js`, `gift.js`, `swagat.js`, `indroda.js`. Registered in `landmarks.js` via `SITES` (site replaces old builder, sign and clearing; returns zone/spawn/update). Night glow for kit mats in `setLandmarksNight`.
- Coordinates fixed in `places.js`: LDRP 23.2389922,72.6390652 (hub, KSV campus Sector 15); Swagat Holiday Mall 23.1891285,72.6097853 (old spot ~3 km off); Indroda origin = Dinosaur & Fossil Park 23.192299,72.646802 (gate 23.1956089,72.6437688 = local (-310,-368)).
- Map: `scripts/build-map.mjs` now merges `data/extra.json` (OSM strip 23.2395–23.25) and `data/rail.json` (metro + stations); outputs building `id`/`name`, `metro`, `stations`. `src/world/metro.js` draws the elevated viaduct, piers and stations (called in main.js).
- Sources used: Google Maps satellite + Street View (GIFT Road 1C, Grand Mercure), Indroda photo sphere, Bing photos (KSV/LDRP blue ribbon windows, Swagat hex LED, Indroda dino arch). Google 3D tilt and Street View render black when the pane is hidden; Google Images CAPTCHAs — use Bing.
- Verified in browser (tour, day): LDRP arc + garden + gate + metro over Road 5; GIFT One/Two/Pragya/Brigade + Savvy Marina/Grand Mercure/GIFT City Club; Swagat facade + forecourt; Indroda gate, road, dense forest, dino park. Movement checks passed: LDRP gates open / wall + buildings blocked; Indroda road + dino loop walkable, forest + statues blocked; Swagat mall + parked cars blocked; GIFT tower blocked; cars forbidden in LDRP campus and mall. `npm run build` passes.
- NOT done yet: run `npm run test:navigation`, `test:traffic`, `test:cycling` after these changes; perf check with all sites (forest at Indroda adds many merged trees); night screenshots of new sites; GIFT ground slab/cranes added but not re-screenshotted; Indroda dino-arch necks read as an "X" — tweak; city-wide flyovers (OSM `bridge`) are still drawn flat (Swagat flyover); docs page like MAHATMA-MANDIR.md for the four sites; other places (Akshardham, Infocity, DAIICT, etc.) still use older landmarks.js models.
- QA tip: `?tour`, hide HUD with a style tag, `__gnr.app.player.teleport(x,z,yaw)` + `setView(dist,pitch)`, `__gnr.world.navigation.canTravel(a,b)`.

## State at stop
- Screenshot fixes: turf cut out below the entire outer promenade (no z-fighting), radial crossing tops lifted 15 mm, world-aligned paving UVs fix stretched tiles. `cycling-pose.js` aligns the pelvis to the saddle, uses anatomical left=+X, hands on separate grips and ankles matched to animated pedals/cranks. Head correction must not rotate Neck because shoulders are its children. `npm run test:cycling` checks the actual shipped male/female rigs (5,760 contacts, two revolutions, four headings). All navigation/traffic/cycling tests and production build pass. Browser QA views: `cycle-front`, `cycle-side` + optional `gender=female`, and `paving`.
- Latest follow-up: two separately fenced polygon compounds (museum / convention + Gandhi Garden) replace the old grass/paving baseboards. `mahatma-grounds.js` builds weathered pillars/pickets/gates, outside paths and the curved KH Road. Perimeter/gate collision uses the same `CAMPUS_FENCES` segments. Cars are forbidden anywhere in either compound, even at open gates.
- `avatar.js` now uses local MIT Rocketbox/Avatar Studio male/female GLBs with captured idle/walk/wave, blink, independent skeletons, appearance variations and cycling IK. `public/models/humans` includes full license notices. Sources are ignored in `data/avatar-sources`; `scripts/prepare-humans.mjs` is the asset-only repacker. No downloaded JS is executed.
- `traffic-routes.js` owns validated road-lane poses, one-way direction, full vehicle-footprint checks, safe respawns and basic headways. `vehicle-models.js` supplies detailed instanced sedan/SUV/hatch/auto/bus geometry. `npm run test:traffic` covers 40,500 poses near the real campus. `scripts/build-map.mjs` now retains OSM way ID, one-way flag and bridge flag; the public map was rebuilt.
- Mahatma Mandir/Dandi Kutir rebuilt from satellite imagery, four separate 360° viewpoints, aerial photos and OSM footprints. `mahatma.js` renders the mound/gallery/moat, both waterside paths, bridge/pylons/turbines and convention centre. Shared geometry/collision dimensions are in `mahatma-layout.js`; see `docs/MAHATMA-MANDIR.md` for sources and estimated details.
- `navigation.js` now constrains player/cyclist/NPC/presence movement at this campus. Cone, water, sloped roof, beds, closed halls, furniture and tree trunks are blocked; raised bridge and underpass are separate surfaces. Camera collision, safe travel/checkpoints, correct height for residents, and campus mini-map are included. Other districts still use their prior flat-ground movement.
- `npm run test:navigation` covers full path loops, crossings, bridge, underpass, guardrails, mounting a bike at a railing, safe spawns and 18,000 seeded moves. `npm run build` passes. Local browser QA checks the inner path, pool boundary, bridge deck and day/night overview. No deployment performed.
- Quick review: `/?tour&place=dandi&view=overview`; also `waterside`, `courtyard`, `bridge`, `aerial`, `entrance`, plus `&night=1`. Any key/drag resumes normal third-person play.
- Builds clean (`npx vite build`). Dev preview: `.claude/launch.json` "gandhinagar-dev" (port 5174 in the pane).
- Latest work = realism pass + light "real app" UI:
  - scene.js: Sky.js physical sky, sun path over Gujarat (+z south), PMREM env, PCF shadows following player, ACES, stars, moonlight.
  - city.js: 500 m chunks; facade atlas (6 styles, custom shader with aTile + textureGrad); asphalt with lane markings; footpaths; reflective water (animated normal map); instanced low-poly trees (kept off roads via 5 m road-cell grid, off lakes/landmarks); street lights + additive light pools at night; night window glow.
  - traffic.js: cars/autos/buses on major roads, left-hand lane, headlights at night.
  - avatar.js: local textured male/female skeletal humans; setShadow(on) by distance (people.js).
  - landmarks.js: photo-based models (Akshardham, GIFT One/Two, Dandi Kutir cone, TCS drum, Swagat hex LED, Indroda dino gate, Sarita A-frame gate, lake ghats from OSM outline, PDPU bridge arches from OSM road). setLandmarksNight().
  - style.css: light frosted-white UI (replaced dark green design). Toasts at top centre.
  - main.js: adaptive pixel ratio (adaptQuality), `?tour` mode + `__gnr.shot(placeId, back, dist, pitch)` for screenshots, `window.__gnr` debug (app, camera, renderer, counts).
- Perf measured in pane: ~33 fps, ~470 draw calls, ~420k tris (was 17 fps). Avatars are the main draw-call cost.

## Just changed, not yet verified
- Akshardham clearing radius 95 -> 135 (removes an OSM building in its front garden). Take a daytime screenshot to confirm.

## Next steps (suggested)
1. Verify Akshardham in daylight; spot-check other landmarks with the new lighting.
2. Further perf: merge avatar body parts or LOD for far people; fewer street lights on low-end.
3. Supabase setup when the user has a project (keys in .env, run schema.sql), then test sign-in/realtime live.
4. Open items from user: LDRP location (needs Google Maps pin), The Landmark exact spot, live voice (not built).

## Notes
- Shared browser storage keys: gnr-db-v1 (demo DB), gnr-progress-v1 (missions/passport), gnr-session (sessionStorage). Clear progress after automated tours so the user's game is not polluted.
- Browser pane is often hidden -> rAF paused; screenshots force frames. Don't mistake a frozen camera for a bug.
- Google Images shows CAPTCHA; use Bing image search for reference photos.
# Latest local changes: KH-5 / rides / tapris

See STREET-LIFE.md for the complete implementation and limits. Added an explicit
KH-5 reference view, rebuilt roundabout, single central circular metro supports,
no grass gap at stalls, 25 sitting tables per tea/snack tapri, Walk/Cycle/Auto/Car
selector (35/80 km/h caps), LDRP exploration bounds, live IST/seasonal lighting,
night lamps and locally bundled textured parking GLBs with CC0 credits.
New checks: test:driving, test:clock, test:site, test:live.
Latest release limits visible destinations to LDRP + Mahatma Mandir, preserves
the full source catalogue, clips runtime geometry, fixes HD buffer resolution,
simplifies the HUD and removes the extra college-side iron railing. Metro mesh
is restricted to the road median and supports never occupy asphalt. See
STREET-LIFE.md for the map/photo audit and release verification details.

## New destination release — 26 November 2026

Five live destinations: LDRP, Mahatma Mandir, Swarnim Park, Swagat Holiday Mall and GIFT City. Each has a separate bounded exploration area. The runtime map retains local OSM roads without adding any road or railway corridor between areas. Walking, cycling, vehicle placement, recovery and destination arrival use bounded navigation. Arrival markers on the map use the playable entrance rather than a distant source pin.

Swarnim models one mapped Central Vista garden section, with a connected promenade, open lawns, benches, conical shades and warm night lighting. Swagat retains its hexagonal facade, with a clear central approach and separated parking. GIFT uses the actual OSM footprints of GIFT One, GIFT Two, Hiranandani Signature, Brigade IFC and Pragya; the speculative club and off-site construction models were removed. GIFT One/Two use the published 122 m height; other heights retain mapped estimates.

References checked:
- Swagat developer gallery and address: https://www.swagatgroup.in/swagat-holiday-mall/
- Swarnim lighting designer / HCPDM collaboration: https://www.atelierdada.com/en/work/swarnim-park-gandhinagar-dada-2013
- GIFT Two developer specifications: https://www.ilfsurbaninfra.in/g2intro.html
- Footprints and local street geometry: retained public/data/gandhinagar-map.json OSM extract.

These are reference-informed game recreations, not surveyed digital twins. Landscape spacing, facade textures and small furnishings are interpreted; no unverified indoor floor plans or branded tenants are presented as factual. Metro is explicitly a game transfer, with no claim that every destination is a real metro station. The 3-car cinematic has closing/opening doors, acceleration/braking, passing scenery, responsive framing, reduced motion and a skip control. Transfers cannot overlap; failed arrivals release input locks.

Checks: test:destinations (actual scene geometry, collision flood fill, swept routes to resident homes, boundaries, tower interiors), test:metro (timing, doors, skip, re-entry, reduced motion, failure cleanup), test:site, test:live, navigation, sidewalks, grounding and production build. `?tour&place=swarnim|swagat|gift&day=1` provides overview QA views; append `&view=walk` for normal walking, or use `&night=1`. QA tours skip GPS prompts.

Final browser QA: desktop (1280×720) and phone (390×844), daytime tower/mall/park views and night park walking. Verified automatic GIFT → Swarnim and Swarnim → Swagat metro arrivals, skip arrival, correct place labels, locked local areas and walking telemetry. No console errors in the verified final scenes. Road clipping now unions overlapping bounds before emitting segments, eliminating 15 duplicate source segments; regression coverage is in test:live. All listed checks and production build passed. Existing user dev server on localhost:5173 retained; temporary QA server stopped.

## Full geographic coverage correction — 26 November 2026

Supersedes the selected five-tower GIFT district and separate small Swarnim area above. GIFT now uses OSM boundary way 544499329 (3,701,439 m² in the unchanged local-metre projection). All 61 mapped building footprints inside that outline are individually represented at their original positions, sizes and orientations, including the courtyard relation. No future masterplan towers are inserted as completed buildings. Swarnim now follows all three outer members of OSM relation 13639535, plus the mapped Secretariat-end garden (337,144 m² of mapped garden polygons). Mahatma Mandir and the complete Central Vista corridor share one bounded walking area. Metro presents that combination as one destination; selecting its other local point on the map does not teleport the player. Other areas remain separate.

`src/data/destination-geography.json` is generated reproducibly by `npm run map:geography` from retained OSM source dumps. The existing dumps are dated July 24, 2026; the additional Overpass mirror response is dated July 15, 2026. Newest available source wins for duplicate element IDs. Do not call this a current November 2026 survey. The official GIFT occupancy list was cross-checked as a public reference, but it supplies no complete georeferenced inventory. Fifty GIFT footprints have no recorded height; those retain visibly approximate low-rise massing, and levels-derived heights are estimates. Exact present-day facades, missing new buildings and site engineering elevations remain unverified. Do not describe these models as exact digital twins or all currently existing buildings.

References: https://www.openstreetmap.org/way/544499329 ; https://www.openstreetmap.org/relation/13639535 ; https://hcp.co.in/urbanism/45 ; https://hcp.co.in/urbanism/36 ; https://www.giftgujarat.in/occupancy-details . HCP's 13.92 km² GIFT expansion is a proposed development plan and is not represented as already built.

Validation: `test:geography` checks all 61 footprint arrays byte-for-byte against the generated source, preservation through runtime clipping, the full mapped city outline, all four park polygons, outer movement limits, finite geometry and a continuous swept walking route from the museum side through the park to the Secretariat end. `test:destinations`, `test:live`, `test:site`, navigation, driving, traffic, collision, Metro and production build passed. Browser QA verified the expanded GIFT scene, one combined Metro card, arrival in the shared civic area, full park paths and no console errors. The map now shows building footprints and exploration outlines; a boundary hint appears near the limit, and player movement remains locked to the active area, including adjacent regions.
