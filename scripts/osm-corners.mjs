#!/usr/bin/env node
// A négyszög sarkainak pontos koordinátái OpenStreetMap-ből (a terek / a megálló középpontja).
// Kimenet: data/corners.json – ezt használja az import-osm.mjs, ha létezik.
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = process.argv[2] ?? "data";
const BBOX = "(47.47,19.04,47.50,19.09)";
const NAMES = [
  ["Fővám tér", `nwr["name"="Fővám tér"]["highway"]${BBOX};`],
  ["Kálvin tér", `nwr["name"="Kálvin tér"]["highway"]${BBOX};`],
  ["Corvin negyed", `nwr["name"~"^Corvin-negyed"]["railway"~"station|stop|subway_entrance"]${BBOX};`],
  ["Boráros tér", `nwr["name"="Boráros tér"]["highway"]${BBOX};`],
];

const out = [];
for (const [name, q] of NAMES) {
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ data: `[out:json][timeout:60];(${q});out center;` }),
  });
  const els = (await res.json()).elements;
  const pts = els.map((e) => [e.lat ?? e.center?.lat, e.lon ?? e.center?.lon]).filter(([a]) => a);
  if (!pts.length) {
    console.error(`Nincs találat: ${name}`);
    process.exit(1);
  }
  const lat = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const lng = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  out.push({ name, lat: +lat.toFixed(6), lng: +lng.toFixed(6), elements: pts.length });
  console.log(name, lat.toFixed(6), lng.toFixed(6), `(${pts.length} elem)`);
}
mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/corners.json`, JSON.stringify(out, null, 2) + "\n");
