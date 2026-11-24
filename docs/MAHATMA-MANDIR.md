# Mahatma Mandir reconstruction

Updated 24 November 2026. This is a hand-built Three.js exterior reconstruction,
not a photogrammetry scan or a claim of survey-grade, centimetre accuracy.

## Boundary, people and traffic update

The museum now follows a closed irregular plot along Salt Mount Road and the
curving KH Road. The convention/exhibition grounds and Gandhi Garden have their
own separate perimeter on the opposite side of KH Road. The supplied marked
satellite crop and fence photographs guided these outlines, masonry pillars,
aged concrete plinth, vertical metal pickets, open pedestrian gates, outside
paved footpaths, yellow/black curbs and planting. The plot edge follows OSM way
744514802 and KH Road carriageways 338768422 / 386749310, offset inside the road
edges. The low ground surface is clipped to these polygons; the earlier circular
grass slab and long rectangular paving slab are removed.

Fence rendering and movement collision share the same sections and gate gaps.
The bridge passes above the road and both perimeters; pedestrians can cross in
either direction, while ground-level entry uses the gates. Some residents now
follow the full bridge route rather than wandering only around one bridge point.

Characters use two locally bundled, textured and skinned male/female GLB rigs,
including captured Idle/Walk/Wave clips. They replace the capsule figures for
players and NPCs. Clothing colours, skin tones, male/female profile selection,
independent skeletons, blinking, wave animation and cycling poses are supported.
Walking speed is 1.8 m/s, running 5.2 m/s and cycling 10 m/s. Horizontal motion
from the captured clips is removed so it cannot move a character outside the
collision capsule. The two source models are Microsoft Rocketbox characters,
converted/fitted by [Avatar Studio](https://github.com/memoriesrohit/avatar-studio)
under MIT. Full Microsoft and conversion notices ship with the GLBs in
`public/models/humans/`; no character service or remote model URL is used at runtime.

Sedans, hatchbacks, SUVs, autos and buses have separate paint, glass, rubber,
metal, plate and lamp materials. Traffic samples only mapped road lanes, respects
OSM one-way direction, follows the actual curved road between the plots, and
checks a vehicle's complete footprint against road width and both compounds.
Vehicles are excluded from the museum, convention grounds and Gandhi Garden,
including at open gates. Failed spawns and invalid road-end poses are hidden;
they cannot remain visible at the origin or at an old position. A deterministic
test covers 40,500 complete vehicle placements near the actual campus.

Additional visual QA views: `&view=boundary`, `road`, and `people`.
`npm run test:traffic` checks road-only placement and compound exclusion.

## References inspected

- Google Maps satellite and tilted globe imagery of the campus, plus the user's
  Dandi Kutir 360° panorama. The available imagery is satellite/Photo Spheres,
  rather than a downloadable textured 3D building model.
- Multiple separate January 2019 Photo Spheres by Mahesh Dilip Salvi: south
  waterside at 23.232177, 72.6315168; west at 23.2329345, 72.6304541; north at
  23.2334852, 72.6310102; east at 23.2330009, 72.6319349. Rotated views establish
  the moat, inner paved promenade, benches, small trees, flower/drainage strips,
  gallery slope, pool railings, surrounding paths and the bridge approach.
- August 2021 aerial photograph by Rajendra Parab in the Maps gallery: the bridge
  deck, tapered H pylons with pierced feet, twin turbines, cable fan, roof edges
  and the landscaped approaches. The bridge's selected Street View returned
  “No user photo available here”, so photographs supplement that coverage.
- Convention-centre Photo Sphere at 23.2321789, 72.6334735: inspected its glazed
  wall, column rhythm and roof structure. Event-specific stalls/furniture shown
  there are not permanent building geometry and have not been reproduced.
- [ARCOP project description](https://arcop.co.in/inner-page-th-sub-category-by-name.php?id=68):
  salt-mound museum, bridge/windmill, gardens and convention roofs.
- [Contractor's project account](https://shapoorji.in/wp-content/uploads/2017/pdf/we%40sp-jan-apr-2015-Final.pdf):
  mound diameter 90 m, height 40.5 m, and an 81 m pylon. Reported bridge lengths
  vary by whether the span or entire approach is counted; the model follows the
  mapped route rather than treating the span length as the entire bridge.
- [The Leela master plan and factsheet](https://www.theleela.com/prod/content/assets/2021-10/MMCC_Factsheet_Sept_2021.pdf):
  hall massing, the open central court and convention/exhibition arrangement.
- Existing local OpenStreetMap download: convention footprint **way 326048766**,
  museum **way 338769679**, and bridge route **way 842647503**.

## Geometry and limits

The mound has a round 144-segment circumference and a capped apex, replacing the
undersized 60 m cone. An annular glazed gallery has a beige outward-sloping roof.
Separate inner/outer paved promenades enclose a shallow reflecting moat, with
four radial access corridors. The bridge leads southeast along the OSM bearing;
the convention building uses the projected OSM polygon, including the central
open court, with glazing, fins, parapets and green roofs.

Photo-Sphere coordinates put the inner waterside path roughly 77 m from the
museum centre. Gallery/pool boundaries, bridge deck heights/landings, details of
stairs and planting are photographic estimates. They are editable together in
`src/world/mahatma-layout.js`; they have not been measured on site. The roughly
1.04-radian rotation aligns the campus to the existing x-east/z-south city map.

Museum exhibits and convention interiors have not been reconstructed. Building
envelopes remain closed instead of inventing unverified rooms or public access.
Temporary events, current opening restrictions and every utility fitting are
outside this exterior model. Older panoramas and newer satellite images differ
in vegetation and roof colour; green roof treatment follows the aerial photos.

## Pedestrian behaviour

`navigation.js` is shared by the player, cyclists, AI residents, travel spawns,
story markers and remote presence avatars. Substeps sweep the pedestrian radius,
with sliding along obstructions. Cone, sloped gallery roof, water, planted beds,
closed halls, benches and tree trunks are blocked. Raised bridge and ground
underneath are separate surfaces with limited step height; railings prevent
walking off the deck. Residents choose reachable routes and use surface heights.

Rendering geometry is batched by material; animated water and a blue night light
ring are inexpensive. Camera rays avoid the mound, gallery and convention solids.

## Verify

The screenshot follow-up fixes coplanar turf/promenade flicker by cutting turf
out through the entire outer walkway and lifting radial crossing decks 15 mm.
All paved surfaces share a world-aligned 37.5 cm tile grid, including the long
crossings. Outside perimeter footpaths use continuous mitered joins, closing
the small triangular gaps at fence corners. Cycling uses anatomical left/right grip targets, a saddle-anchored
pelvis, a forward lean and feet matched to visible animated cranks/pedals.
Stopped riders hold their pedals; cadence follows movement speed. Head correction
leaves Neck alone because this particular rig parents its shoulders there.

Run `npm run test:navigation`, `npm run test:traffic`, `npm run test:cycling`
and `npm run build`. The cycling regression uses both shipped GLB skeletons:
5,760 hand/foot contacts across two revolutions and four world headings, plus
saddle alignment, outward elbows and forward knees. Navigation scenarios cover
both complete promenade loops, all four crossings, the full rising/falling bridge,
underpass, railings for walking/cycling, unsafe spawn recovery, closed halls,
NPC route rejection and 18,000 deterministic random movements.

With the dev server running, `/?tour&place=dandi` opens the entrance in daylight.
Use `&view=overview`, `aerial`, `waterside`, `courtyard`, or `bridge` for repeatable
reference views; `&night=1` tests night lighting. Any key or drag exits the fixed
view and resumes the third-person walking camera. These options are local QA
helpers; the usual BRTS destination remains **Dandi Kutir**.
`&view=cycle-front`, `cycle-side` (optionally `&gender=female`) and `paving`
reproduce the corrected screenshot angles.
