// Places in the virtual Gandhinagar. Coordinates come from OpenStreetMap (Nominatim and
// the Overpass dump in data/). `approx: true` means the exact spot is not confirmed yet.
// `hub: true` places are travel destinations with residents, stalls and a passport stamp.
export const PLACES = [
  { id: "infocity", name: "Infocity", gu: "ઇન્ફોસિટી", kind: "business", hub: true,
    lat: 23.1933118, lon: 72.6348905, color: 0x4fa3d1,
    blurb: "IT parks, chai lari and long lunch breaks" },
  { id: "daiict", name: "DAIICT", gu: "ડીએ-આઈઆઈસીટી", kind: "college", hub: true,
    lat: 23.188408, lon: 72.6279691, color: 0x6a8dd8,
    blurb: "Coders, hostels and late-night labs" },
  { id: "nift", name: "NIFT", gu: "નિફ્ટ", kind: "college", hub: false,
    lat: 23.1914478, lon: 72.6291597, color: 0xd86a9c,
    blurb: "Design studios and sketchbooks" },
  { id: "tcs", name: "TCS", gu: "ટીસીએસ", kind: "office", hub: false,
    lat: 23.192776, lon: 72.6282751, color: 0x3b6fb6,
    blurb: "Tech office by Infocity" },
  { id: "gift", name: "GIFT City", gu: "ગિફ્ટ સિટી", kind: "business", hub: true,
    lat: 23.16465, lon: 72.68045, color: 0x2fb7a0,
    blurb: "Towers, finance and the river view" },
  { id: "pdeu", name: "PDEU", gu: "પીડીઈયુ", kind: "college", hub: true,
    lat: 23.1563544, lon: 72.6652774, color: 0xe08a3c,
    blurb: "Energy university on the knowledge corridor" },
  { id: "pdpu-bridge", name: "PDPU Bridge", gu: "પીડીપીયુ બ્રિજ", kind: "bridge", hub: false,
    lat: 23.15136, lon: 72.67657, color: 0xf2b84b,
    blurb: "Cross the Sabarmati between PDEU and GIFT City" },
  { id: "akshardham", name: "Akshardham", gu: "અક્ષરધામ", kind: "temple", hub: true,
    lat: 23.22938, lon: 72.67408, color: 0xf0c27a,
    blurb: "Temple, gardens and evening lights" },
  { id: "sarita", name: "Sarita Udyan", gu: "સરિતા ઉદ્યાન", kind: "park", hub: true,
    lat: 23.2026285, lon: 72.6598164, color: 0x5fae5a,
    blurb: "Riverside garden, green and quiet" },
  { id: "indroda", name: "Indroda Park", gu: "ઇન્દ્રોડા પાર્ક", kind: "park", hub: true,
    lat: 23.192299, lon: 72.646802, color: 0x4d9a4a,
    blurb: "Nature park with the dinosaur fossil park" },
  { id: "punitvan", name: "Punit Van", gu: "પુનિત વન", kind: "park", hub: false,
    lat: 23.2169187, lon: 72.6676339, color: 0x67b863,
    blurb: "Botanical garden walks" },
  { id: "swarnim", name: "Swarnim Park", gu: "સ્વર્ણિમ પાર્ક", kind: "park", hub: false,
    lat: 23.2221505, lon: 72.6519822, color: 0x76c26b,
    blurb: "Park in the middle of the sectors" },
  { id: "dandi", name: "Mahatma Mandir", gu: "મહાત્મા મંદિર · દાંડી કુટીર", kind: "museum", hub: true,
    lat: 23.2328055, lon: 72.631196, color: 0xeeeeee,
    blurb: "Mahatma Mandir campus, waterside walks and Dandi Bridge" },
  { id: "lakegarden", name: "Sector 1 Lake Garden", gu: "સેક્ટર ૧ લેક ગાર્ડન", kind: "park", hub: true,
    lat: 23.19981, lon: 72.64931, color: 0x58a6c9,
    blurb: "Suryajyot lake, evening walks and bhel" },
  { id: "swagat", name: "Swagat Holiday Mall", gu: "સ્વાગત મોલ", kind: "mall", hub: true,
    lat: 23.1891285, lon: 72.6097853, color: 0xc95b5b,
    blurb: "Mall on SG Highway at Sargasan, beside the Swagat flyover" },
  { id: "landmark", name: "The Landmark", gu: "ધ લેન્ડમાર્ક", kind: "hangout", hub: false, approx: true,
    lat: 23.1704419, lon: 72.6234269, color: 0x9b6fd1,
    blurb: "Kudasan hangout on PDPU Road (spot not confirmed yet)" },
  { id: "civil", name: "Civil Hospital", gu: "સિવિલ હોસ્પિટલ", kind: "hospital", hub: false,
    lat: 23.2196609, lon: 72.641845, color: 0xe25c5c,
    blurb: "Civil Hospital (GMERS), Sector 12" },
  // Google Maps place pin for LDRP-ITR inside the KSV campus, Sector 15.
  { id: "ldrp", name: "LDRP-ITR", gu: "એલડીઆરપી", kind: "college", hub: true,
    lat: 23.2389922, lon: 72.6390652, color: 0x2f5fa8, blurb: "KSV campus, Sector 15: engineering students, the arc and its garden" },
];

export const LIVE_PLACE_IDS = new Set(['ldrp','dandi']);
export const isLivePlace = id => LIVE_PLACE_IDS.has(id);
export const placedPlaces = () => PLACES.filter((p) => isLivePlace(p.id) && !p.pending && p.lat != null);
export const hubs = () => placedPlaces().filter((p) => p.hub);
export const placeById = (id) => PLACES.find((p) => p.id === id);

// Home districts offered in the profile form.
export const HOME_DISTRICTS = hubs().map((p) => p.name);

// Local metre coordinates (x east, z south), same projection as scripts/build-map.mjs.
const ORIGIN = { lat: 23.195, lon: 72.645 };
const R = 6371000;
export function toLocal(lat, lon) {
  return {
    x: (lon - ORIGIN.lon) * (Math.PI / 180) * R * Math.cos((ORIGIN.lat * Math.PI) / 180),
    z: -(lat - ORIGIN.lat) * (Math.PI / 180) * R,
  };
}
export function placePos(p) {
  return toLocal(p.lat, p.lon);
}
