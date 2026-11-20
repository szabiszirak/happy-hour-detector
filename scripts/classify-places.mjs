#!/usr/bin/env node
// A letöltött helylista utófeldolgozása (hálózat nélkül):
//  - kiszűri a nevük alapján tévesen bekerült éttermeket/kávézókat (sushi bar, espresso bar…),
//  - eldönti, hogy a hely a négyszögön belül van-e: a határoló körutak túloldala
//    más irányítószámú (VIII. ker. 108x, külső Ferencváros 1094/1095, V. ker. 105x),
//    ezért a sokszög mellett az irányítószámot is figyelembe vesszük,
//  - a webes forrásból jövő helyeket „ellenőrizendő” jelzéssel látja el.
// Használat: node scripts/classify-places.mjs [data]
import { readFileSync, writeFileSync } from "node:fs";

const OUT = process.argv[2] ?? "data";

/** Nem kocsma, csak a nevében van „bar” – kiszűrjük. */
export const NOT_A_BAR = /(sushi|wok\b|ph[oở]\b|thai|espresso bar|salad bar|nail|beauty|szépség)/i;

/** A négyszögön belüli irányítószámok: Belső-Ferencváros (1091–1093). */
const INNER_POSTCODES = new Set(["1091", "1092", "1093"]);

function inside(p, poly) {
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (a.lat > p.lat !== b.lat > p.lat && p.lng < ((b.lng - a.lng) * (p.lat - a.lat)) / (b.lat - a.lat) + a.lng) ins = !ins;
  }
  return ins;
}

export function classify(places, poly) {
  return places
    .filter((p) => !NOT_A_BAR.test(p.name))
    .map((p) => {
      const pc = (p.address.match(/\b(1\d{3})\b/) ?? [])[1];
      const geo = inside(p.location, poly);
      const inMvp = pc ? INNER_POSTCODES.has(pc) && geo : geo;
      const checkNeeded = p.osm.source?.startsWith("web") || p.osm.amenity === "restaurant" || p.osm.amenity === "cafe";
      return { ...p, osm: { ...p.osm, inMvp, checkNeeded } };
    })
    .sort((a, b) => Number(b.osm.inMvp) - Number(a.osm.inMvp) || a.name.localeCompare(b.name, "hu"));
}

export function toCsv(places) {
  const esc = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  return [
    ["név", "típus", "cím", "lat", "lng", "négyszögön belül", "ellenőrizendő", "nyitvatartás (OSM)", "weboldal", "telefon", "forrás", "link"].join(","),
    ...places.map((p) =>
      [
        p.name, p.osm.amenity, p.address, p.location.lat, p.location.lng,
        p.osm.inMvp ? "igen" : "nem (szomszédos)", p.osm.checkNeeded ? "igen" : "",
        p.osm.openingHours, p.osm.website, p.osm.phone, p.osm.source,
        p.osmId ? `https://www.openstreetmap.org/${p.osmId}` : "",
      ].map(esc).join(","),
    ),
  ].join("\n") + "\n";
}

// Közvetlen futtatás: a meglévő data/places.osm.json újraosztályozása.
if (import.meta.url === `file://${process.argv[1]}`) {
  const corners = JSON.parse(readFileSync(`${OUT}/corners.json`, "utf8"));
  const poly = corners.map((c) => ({ lat: c.lat, lng: c.lng }));
  const places = classify(JSON.parse(readFileSync(`${OUT}/places.osm.json`, "utf8")), poly);
  writeFileSync(`${OUT}/places.osm.json`, JSON.stringify(places, null, 2) + "\n");
  writeFileSync(`${OUT}/places.osm.csv`, toCsv(places));
  console.log(`${places.length} hely, ebből ${places.filter((p) => p.osm.inMvp).length} a négyszögön belül.`);
}
