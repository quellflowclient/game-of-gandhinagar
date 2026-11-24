# LDRP / KH-5 street life

Updated 24 November 2026. Three.js local implementation; no deployment performed.

## References and placement

The user's `C:/Users/dharmik/Downloads/ldrp.pdf` is a one-page schematic. Its
shop order and road sides are preserved in a local frame anchored to the mapped
KH-5 roundabout. Distances within the schematic are estimates, not surveyed pins.
`example images/` supplies 31 street/campus photographs: the named Babu, Chintu,
Lalbhai, Natu, Masi, Ajit and Patel images guide individual forms. Sarpanch follows
the user's tea-lari description. Campus/lab photos were inspected; the explicit
instruction to keep building interiors closed still applies.

Distinct stall geometry: Babu's open prep tables and tree shade; Chintu's tall
painted menu panels replacing the Anjali name; Lalbhai's packet-lined kiosk;
Natu's green fabric cover; Masi's large cart wheels and pitched green hood;
Patel's cream cargo tempo with a side hatch; Ajit's shaded tea kiosk. Generated
materials, aged walls, crates, parked vans/autos/two-wheelers, mature foliage,
cooking utensils and steam add detail without embedding Street View screenshots.

Also read the user's shared chat:
https://chatgpt.com/share/6b0556e6-071c-83e8-9feb-521cb94daefc
Relevant principles: geographic footprints, detailed local landmarks, GLB people,
collision, local assets and distance-based detail. Its general engine/offline
architecture suggestions were not treated as a request to replace this working
Three.js application or implement an unrelated logistics product.

## Interaction rules

- Approach a shop and call its worker by name. The worker walks over before the
  verbal menu opens. Cooking, carrying/delivering, eating and paying are separate
  states. There are no tokens and no advance charges. Payment happens once after
  eating, using the existing play-money wallet. Pending food/bills block BRTS travel.
- Named workers match the request: Saras, Masi and Babu; Chintu and Kaka; Lalbhai;
  Natu; Masi and Kaka; Sarpanch; Patel; Ajit and occasional Bapu.
- Natu's quiet bottle interaction is fictional and serves a soda bottle. Adult
  ambient characters at Lalbhai smoke or prepare a small packet; those actions
  are not items in the order menu. The shop NPCs are fictional game characters.
- Small square sitting tables are separate from dining tables. Every sitting
  table has one occupant slot. Each group has occupied tables and spare tables.
  Ask before sitting on or taking its spare table; yes grants permission, no
  reserves it. The group's characters nod or shake their heads.
- Carry only an empty, permitted table. Carry speed is reduced. Drop only on a
  clear seating plot, not a road, doorway, counter or another table. Workers
  recompute walking routes after furniture changes. Sitting/standing and carrying
  have distinct poses. Stand or put the table down before cycling/travelling.
- Occupancy is synchronized between tabs of this local browser using Web Locks,
  storage notifications and expiring claims. This is not a deployed cross-device
  authoritative multiplayer furniture service. The existing live Supabase adapter
  has not been deployed or extended with a server furniture ledger in this pass.

## Rendering and movement

Male/female GLB rigs have independent cooking, tea, serving, cash, eating,
smoking, palm-rubbing and carry poses. The actual skeletons are tested; sitting
keeps the pelvis at table-seat height and feet on the ground. Workers use a local
walk grid around counters, vans, dining tables and sitting tables. Ambient guests
arrive, wait, eat, pay and leave; a human's service request takes priority.

Road/footpath movement heights match `city.js` (asphalt `0.2 + width*0.004`, public
footpath another 0.1 m up). Campus geometry and navigation share path elevations.
The old city roads are clipped inside LDRP so they cannot overlap above its paths.
Characters refresh ground height even when idle. A planted-foot correction keeps
captured motion from putting both soles below the surface. Cycle tyres have a
positive floor clearance; parked scooter/car tyre heights are corrected too.
Bikes are limited to city roads/paved corridors and LDRP's mapped drives/paving;
walkers may still explore gardens. Buildings, compound walls and the single gate
retain their collision rules.

Phone layouts expose the left circular joystick (outer ring runs), a run toggle,
camera drag, large nearby action buttons and bottom-sheet menus. Coarse/narrow
devices use fewer residents/traffic, smaller shadows and capped pixel ratio with
adaptive quality. A graphics-context recovery screen avoids a silent blank canvas.
Device-sized browser QA is not a claim of testing every physical handset.

## Verification and previews

`npm run test:street`: eight placements, service sequencing, no advance payment,
single final charge, insufficient funds, refusal, exclusive sitting/carrying and
road/campus cycle restrictions plus road/footpath heights.

`npm run test:activities`: 1,950 poses on the shipped male/female rigs.
`npm run test:cycling`: 5,760 contact checks on both rigs.
`npm run test:navigation`: 18,000 seeded moves plus bridge/path journeys.
`npm run test:traffic`: 40,500 validated vehicle poses.
`node scripts/test-ldrp.mjs`: one gate and closed mapped building envelopes.
`npm run build`: production bundle.

Preview `/?tour&place=ldrp&view=market`, or `view=babu`, `chintu`, `lalbhai`,
`natu`, `masi`, `sarpanch`, `patel`, `ajit`, `seats`, `garden`, `overview`.
Any key/drag exits the fixed camera. `&qa=NAME` on tour URLs uses a separate
play-money progress key so browser verification does not spend the user's wallet.

These are reference-based real-world-inspired models, not photogrammetric scans.
Exact unseen elevations, every fitting and all current street arrangements cannot
be verified from the supplied photographs and schematic.

## KH-5, driving and live environment (24 November)

The OSM KH-5 ring has a 15.8 m road centreline radius. Its island now has a
9.12 m outer paved radius, 7.35 m raised garden, red/cream pavers, black/yellow
kerb, circular steel railing details, flag and four bilingual KH-5 signs. Use
`/?tour&place=ldrp&view=circle` to find it directly. `&day=1` or `&night=1` is an
explicit lighting preview; without either, the tour now uses live IST.

Road 5 uses two 6.2 m carriageways and outer footpaths. Its planted median has
iron fencing on both sides with crossing gaps. Stalls meet the continuous paved
or compacted shoulder; long walls run behind the rows. Metro parallel tracks
share circular piers in one centre row. The camera menu has follow, front,
wide, free orbit and human eye views with an adjustable field of view.

Each of the six non-food tea/snack stalls has exactly 25 small single-person
sitting tables in a 5 by 5 arrangement, with no customer dining tables. Babu and
Chintu retain their separate dining tables and eight sitting tables each,
making 166 seats total. Furniture storage is versioned v4 for the new layout.

The cycle FAB/C key opens Walk/Cycle/Auto/Car. Auto is limited to 35 km/h and
car to 80 km/h, converted to metres/second internally. Forward input accelerates;
backward input brakes; lateral input steers; release brakes to rest. Their
full footprints must remain on public asphalt and outside vehicle-free zones.
Sweeps use <=15 cm steps. Roadside entry searches within 14 m; campus entry is
rejected. Exit checks for clear pedestrian space. Driving cannot interrupt an
unpaid meal, sitting or carrying. Opening a panel immediately stops driving.

Entering LDRP activates a local exploration rectangle in the road frame:
u=-375..212, v=-295..65 metres. This includes the entire campus, junction and
eight stalls. Players/vehicles cannot move beyond it. Visible road end markers
and a HUD label identify the area. Choosing a different city travel destination
switches areas normally. This is a local exploration limit, not a server-side
security boundary.

Roadside/campus scooters and motorcycles use local, textured CC0 GLB assets
(see public/models/vehicles/CREDITS.txt), decoded with Meshopt/KTX2. Quantized
attributes convert to floats before static batching. Low-detail parking LODs
keep the payload below 500 KB for both vehicle GLBs combined. These generic
models are not manufacturer CAD or an exact branded Activa replica.

Live IST is independent of device timezone. Open-Meteo supplies current
temperature plus today's sunrise/sunset, refreshed every 15 minutes. An
astronomical seasonal fallback drives lighting offline. AQI failure does not
hide a valid temperature. Failed refreshes mark the last temperature; missing
data is shown as unavailable. Local date rollover invalidates yesterday's solar
times. Preview time is labelled PREVIEW. Night switches on emissive lamp heads,
warm ground pools and the three nearest real point lights without extra shadow
maps. Car/auto headlights also glow at night.

Additional checks: `npm run test:driving`, `npm run test:clock`,
`npm run test:site`, and `node scripts/test-road5.mjs`.

The later pillar screenshot correction replaces the straight Road 5 fence with
two fences offset 1.22 m from the actual, unchanged metro support alignment,
including its curve. A tree sits halfway between each adjacent pair of supports.
The college crossing stays open. The planted strip blocks pedestrians and
vehicles; extra navigation obstacles enforce this even where campus zones overlap.
Direct QA views: `view=metro` and `view=tea-seats`. Parking vehicles use shared
instancing within 85 m; sitting tables render within 65 m to keep phone costs down.

The circle anchor now uses the runtime spherical map projection and the actual
OSM ring bounding centre, removing a roughly 5.5 m offset caused by an earlier
111320 m/degree test-origin approximation. Geometry tests use placePos(LDRP),
and Road 5 checks the authored island against the mapped circle centre. The
gate forecourt bridges the campus boundary to the public footpath.

## Two-location release and clean HD controls

The visible catalogue is now limited to LDRP and Mahatma Mandir. Full PLACES,
other builders and original content remain in source. `live-content.js` provides
supported mission goals and hides unavailable stories, gigs and sample events.
Travel rejects inactive destinations. Runtime map geometry is clipped to the
two active areas; the complete source map stays unchanged. The active release
uses 538 nearby background buildings instead of 24,857 citywide buildings.

The canvas targets a 1080-pixel short edge (up to 3× DPR / 8 megapixels) and no
longer drops resolution to 0.65× when frame rate falls. Texture anisotropy improves
oblique road/material sampling. HUD keeps compact place/time, a small map, the
joystick, ride/camera controls and a three-action dock. Social and mission tools
remain in Menu; duplicate street order prompts and the large mission/arrival
overlays are removed.

LDRP's road-facing iron compound fence is removed; a low masonry boundary keeps
the shared entry/exit logic. Metro-side mesh is allowed only between paired
carriageways, with no planting/fence crossing asphalt. Carriageways run outside
the central support clearance; junction asphalt spans have no support placed
inside them. The deck alignment is retained. Geometry checks verify every visible
support is clear of road edges and every median fence is between carriageways.

Reference audit resumed on working Google Maps Street View (Road 5, Mar 2026).
Observed: stalls directly along a dusty shoulder, mature shade trees, parked
two-wheelers/autos, a continuous rear wall, green diagonal median mesh and
black/yellow kerbs; no extra metal fence between the college frontage and road.
KH-5 photo (Aug 2023) also shows the central gear monument and traffic-signal
poles. These dated images must be distinguished from today's live conditions.

`npm run test:live` verifies the two-destination whitelist, retained source
catalogue, supported mission goals, clipped road extents and HD buffers.
