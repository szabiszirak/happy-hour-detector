#!/usr/bin/env node
// A négyszög sarkainak pontos koordinátái OpenStreetMap-ből (a terek / a megálló középpontja).
// Kimenet: data/corners.json – ezt használja az import-osm.mjs, ha létezik.
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = process.argv[2] ?? "data";
const BBOX = "(47.47,19.04,47.50,19.09)";
const CORNERS = [
  { name: "Fővám tér", match: (t) => t.name === "Fővám tér" && t.highway },
  { name: "Kálvin tér", match: (t) => t.name === "Kálvin tér" && t.highway },
  { name: "Corvin negyed", match: (t) => /^Corvin-negyed/.test(t.name ?? "") && t.railway },
  { name: "Boráros tér", match: (t) => t.name === "Boráros tér" && t.highway },
];
// Egyetlen lekérdezés mind a négy sarokra (kíméli az Overpass szervert).
const query = `[out:json][timeout:60];
(
  nwr["name"~"^(Fővám tér|Kálvin tér|Boráros tér)$"]["highway"]${BBOX};
  nwr["name"~"^Corvin-negyed"]["railway"~"station|stop|subway_entrance"]${BBOX};
);
out center tags;`;

const ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
let els;
for (const url of ENDPOINTS) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "happy-hour-detector/0.1" },
      body: new URLSearchParams({ data: query }),
    });
    const text = await res.text();
    if (!res.ok || !text.startsWith("{")) throw new Error(`${res.status}: ${text.slice(0, 200)}`);
    els = JSON.parse(text).elements;
    break;
  } catch (e) {
    console.error(`Overpass hiba (${url}): ${e.message}`);
  }
}
if (!els) process.exit(1);

const out = [];
for (const c of CORNERS) {
  const pts = els
    .filter((e) => c.match(e.tags ?? {}))
    .map((e) => [e.lat ?? e.center?.lat, e.lon ?? e.center?.lon])
    .filter(([a]) => a);
  if (!pts.length) {
    console.error(`Nincs találat: ${c.name}`);
    process.exit(1);
  }
  const lat = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const lng = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  out.push({ name: c.name, lat: +lat.toFixed(6), lng: +lng.toFixed(6), elements: pts.length });
  console.log(c.name, lat.toFixed(6), lng.toFixed(6), `(${pts.length} elem)`);
}
mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/corners.json`, JSON.stringify(out, null, 2) + "\n");
