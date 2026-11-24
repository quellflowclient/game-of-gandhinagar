# Handoff · People of Gandhinagar (last updated 2026-11-24)

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
New checks: test:driving, test:clock, test:site. No deployment performed.

