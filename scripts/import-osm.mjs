#!/usr/bin/env node
// Kocsmák, bárok importja az MVP-négyszögből OpenStreetMap-ből (Overpass API).
// Az OSM-adatok (ODbL licenc) szabadon tárolhatók a saját adatbázisunkban – hivatkozással
// („© OpenStreetMap közreműködők”). A Google Places adataiból tartósan csak a place_id tárolható,
// ezért a Google-azonosítót külön, a googlePlaceId mezőbe érdemes később hozzápárosítani.
//
// Használat:  node scripts/import-osm.mjs > places.osm.json
// Kimenet: Place[] (lásd src/domain/types.ts), üres itallappal és happy hour listával –
// az árakat és időpontokat a saját begyűjtésünk tölti fel.

const POLY = [
  [47.4872, 19.0582], // Fővám tér
  [47.4895, 19.0617], // Kálvin tér
  [47.4857, 19.0707], // Corvin negyed
  [47.4812, 19.0652], // Boráros tér
];

const polyStr = POLY.map(([lat, lng]) => `${lat} ${lng}`).join(" ");
const query = `
[out:json][timeout:60];
(
  node["amenity"~"^(pub|bar|biergarten)$"](poly:"${polyStr}");
  way["amenity"~"^(pub|bar|biergarten)$"](poly:"${polyStr}");
);
out center tags;
`;

const res = await fetch("https://overpass-api.de/api/interpreter", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ data: query }),
});
if (!res.ok) {
  console.error(`Overpass hiba: ${res.status} ${res.statusText}`);
  process.exit(1);
}
const json = await res.json();

const places = json.elements
  .filter((e) => e.tags?.name)
  .map((e) => {
    const lat = e.lat ?? e.center?.lat;
    const lng = e.lon ?? e.center?.lon;
    const t = e.tags;
    const street = [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(" ");
    return {
      id: `osm-${e.type}-${e.id}`,
      osmId: `${e.type}/${e.id}`,
      name: t.name,
      address: street ? `${street}, IX. kerület` : "IX. kerület",
      location: { lat: +lat.toFixed(6), lng: +lng.toFixed(6) },
      vibes: t.beer_garden === "yes" || t.amenity === "biergarten" ? ["garden"] : [],
      drinks: [],
      happyHours: [],
    };
  });

console.error(`${places.length} hely importálva az MVP-négyszögből.`);
console.log(JSON.stringify(places, null, 2));
