#!/usr/bin/env node
// Kocsmák, bárok importja az MVP-négyszögből OpenStreetMap-ből (Overpass API).
// Az OSM-adatok (ODbL licenc) szabadon tárolhatók – hivatkozással: „© OpenStreetMap közreműködők”.
// A Google Places adataiból tartósan csak a place_id tárolható (googlePlaceId mező).
//
// Használat:  node scripts/import-osm.mjs [kimeneti-mappa]   (alapértelmezés: data/)
// Kimenet:
//   data/places.osm.json  – Place[] (src/domain/types.ts), üres itallappal és HH-listával
//   data/places.osm.csv   – ugyanez táblázatként, átnézéshez
// A négyszöget ~80 méteres pufferrel kérdezzük le, hogy a határoló körutak/terek túloldali
// házsorában lévő helyek se vesszenek el; ezek „inMvp: false” jelölést kapnak.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT = process.argv[2] ?? "data";

// Sarkok: ha van data/corners.json (scripts/osm-corners.mjs), azt használjuk.
const CORNERS = existsSync(`${OUT}/corners.json`)
  ? JSON.parse(readFileSync(`${OUT}/corners.json`, "utf8")).map((c) => [c.name, c.lat, c.lng])
  : [
      ["Fővám tér", 47.4872, 19.0582],
      ["Kálvin tér", 47.4895, 19.0617],
      ["Corvin negyed", 47.4857, 19.0707],
      ["Boráros tér", 47.4812, 19.0652],
    ];
const POLY = CORNERS.map(([, lat, lng]) => ({ lat, lng }));

// sokszög kitolása a középpontból kb. 60 méterrel
const c = POLY.reduce((a, p) => ({ lat: a.lat + p.lat / POLY.length, lng: a.lng + p.lng / POLY.length }), { lat: 0, lng: 0 });
const M_PER_LAT = 111_320;
const M_PER_LNG = 111_320 * Math.cos((c.lat * Math.PI) / 180);
const BUFFER_M = 80;
const BUFFERED = POLY.map((p) => {
  const dy = (p.lat - c.lat) * M_PER_LAT;
  const dx = (p.lng - c.lng) * M_PER_LNG;
  const len = Math.hypot(dx, dy);
  const k = (len + BUFFER_M) / len;
  return { lat: c.lat + (dy * k) / M_PER_LAT, lng: c.lng + (dx * k) / M_PER_LNG };
});

function inside(p, poly) {
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (a.lat > p.lat !== b.lat > p.lat && p.lng < ((b.lng - a.lng) * (p.lat - a.lat)) / (b.lat - a.lat) + a.lng) ins = !ins;
  }
  return ins;
}

const polyStr = BUFFERED.map((p) => `${p.lat.toFixed(6)} ${p.lng.toFixed(6)}`).join(" ");
const AMENITIES = "pub|bar|biergarten|nightclub";
const query = `
[out:json][timeout:90];
(
  nwr["amenity"~"^(${AMENITIES})$"](poly:"${polyStr}");
  nwr["craft"="brewery"](poly:"${polyStr}");
  nwr["amenity"~"^(cafe|restaurant)$"](poly:"${polyStr}");
);
out center tags;
`;

// Kávézók, éttermek közül csak azok kellenek, amelyek bárként is működnek.
const BARLIKE_NAME = /(b[aá]r\b|bar\b|pub\b|s[öo]r|bor[oó]z|kocsma|tap\s?house|taproom|csapsz|pince|presszó|brewing|wine|jazz)/i;
const isBarLike = (t) =>
  ["pub", "bar", "biergarten", "nightclub"].includes(t.amenity) ||
  t.craft === "brewery" ||
  t.bar === "yes" ||
  t["drink:beer"] === "yes" || t["drink:wine"] === "yes" || t["drink:cocktail"] === "yes" ||
  Boolean(t.brewery) ||
  BARLIKE_NAME.test(t.name ?? "");
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
let json;
// Az Overpass néha túlterhelt (502/504): több próbálkozás, növekvő várakozással.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
outer: for (let attempt = 1; attempt <= 4; attempt++) {
  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "happy-hour-detector/0.1" },
        body: new URLSearchParams({ data: query }),
      });
      const text = await res.text();
      if (!res.ok || !text.startsWith("{")) throw new Error(`${res.status}: ${text.slice(0, 120)}`);
      json = JSON.parse(text);
      break outer;
    } catch (e) {
      console.error(`Overpass hiba (${attempt}. kör, ${url}): ${e.message}`);
    }
  }
  await sleep(attempt * 20_000);
}
if (!json) process.exit(1);

const VIBES = (t) => {
  const v = [];
  if (t.amenity === "biergarten" || t.beer_garden === "yes" || t.outdoor_seating === "yes") v.push("garden");
  if (t.amenity === "nightclub") v.push("party");
  if (t.sport || t["screen"] === "yes" || /sport/i.test(t.name ?? "")) v.push("sport");
  return v;
};

let places = json.elements
  .filter((e) => e.tags?.name && isBarLike(e.tags))
  .map((e) => {
    const t = e.tags;
    const lat = +(e.lat ?? e.center?.lat).toFixed(6);
    const lng = +(e.lon ?? e.center?.lon).toFixed(6);
    const street = [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(" ");
    const pc = t["addr:postcode"];
    return {
      id: `osm-${e.type}-${e.id}`,
      osmId: `${e.type}/${e.id}`,
      name: t.name,
      address: street ? `${pc ? pc + " " : ""}Budapest, ${street}` : "",
      location: { lat, lng },
      vibes: VIBES(t),
      drinks: [],
      happyHours: [],
      // OSM-ből jövő kiegészítő adatok (nem kötelezőek az apphoz)
      osm: {
        amenity: t.amenity ?? (t.craft === "brewery" ? "brewery" : ""),
        source: "osm",
        openingHours: t.opening_hours ?? "",
        website: t.website ?? t["contact:website"] ?? "",
        phone: t.phone ?? t["contact:phone"] ?? "",
        brewery: t.brewery ?? "",
        inMvp: inside({ lat, lng }, POLY),
      },
    };
  })
  // ugyanaz a hely néha pontként és épületként is szerepel: név + 40 m-en belül → egy
  .filter((p, i, arr) => {
    const dup = arr.findIndex(
      (q) => q.name.toLowerCase() === p.name.toLowerCase() &&
        Math.hypot((q.location.lat - p.location.lat) * M_PER_LAT, (q.location.lng - p.location.lng) * M_PER_LNG) < 40,
    );
    return dup === i;
  })
  .sort((a, b) => Number(b.osm.inMvp) - Number(a.osm.inMvp) || a.name.localeCompare(b.name, "hu"));

// Webes kiegészítés: ismert helyek, amelyek az OSM-ben hiányoznak vagy nem bárként szerepelnek.
// Forrás: data/places.web.json ({name, address, source}); a koordinátát a Nominatim adja.
const norm = (x) => x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
if (existsSync(`${OUT}/places.web.json`)) {
  const extra = JSON.parse(readFileSync(`${OUT}/places.web.json`, "utf8"));
  for (const x of extra) {
    if (places.some((p) => norm(p.name).includes(norm(x.name)) || norm(x.name).includes(norm(p.name)))) continue;
    await sleep(1200); // Nominatim: max. 1 kérés/mp
    const q = new URLSearchParams({ q: `${x.address}, Budapest, Hungary`, format: "json", limit: "1" });
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?${q}`, { headers: { "User-Agent": "happy-hour-detector/0.1" } });
      const [hit] = await r.json();
      if (!hit) { console.error(`Nem található cím: ${x.address}`); continue; }
      const lat = +(+hit.lat).toFixed(6), lng = +(+hit.lon).toFixed(6);
      places.push({
        id: `web-${norm(x.name)}`,
        name: x.name,
        address: x.address,
        location: { lat, lng },
        vibes: [],
        drinks: [],
        happyHours: [],
        osm: { amenity: x.kind ?? "bar", source: `web: ${x.source}`, openingHours: "", website: x.website ?? "", phone: "", brewery: "", inMvp: inside({ lat, lng }, POLY) },
      });
    } catch (e) {
      console.error(`Geokódolási hiba (${x.name}): ${e.message}`);
    }
  }
  places.sort((a, b) => Number(b.osm.inMvp) - Number(a.osm.inMvp) || a.name.localeCompare(b.name, "hu"));
}

mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/places.osm.json`, JSON.stringify(places, null, 2) + "\n");

const esc = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
const csv = [
  ["név", "típus", "cím", "lat", "lng", "négyszögön belül", "nyitvatartás (OSM)", "weboldal", "telefon", "forrás", "link"].join(","),
  ...places.map((p) =>
    [p.name, p.osm.amenity, p.address, p.location.lat, p.location.lng, p.osm.inMvp ? "igen" : "nem (szomszédos)", p.osm.openingHours, p.osm.website, p.osm.phone, p.osm.source, p.osmId ? `https://www.openstreetmap.org/${p.osmId}` : ""]
      .map(esc)
      .join(","),
  ),
].join("\n");
writeFileSync(`${OUT}/places.osm.csv`, csv + "\n");

console.log(`${places.length} hely (${places.filter((p) => p.osm.inMvp).length} a négyszögön belül) → ${OUT}/`);
