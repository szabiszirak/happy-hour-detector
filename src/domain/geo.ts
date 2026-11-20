import type { LatLng } from "./types";

/**
 * Az MVP-terület sarkai: Fővám tér → Kálvin tér → Corvin negyed → Boráros tér.
 * A koordináták az OpenStreetMap-ből jönnek (data/corners.json, scripts/osm-corners.mjs).
 */
export const MVP_CORNERS: { name: string; at: LatLng }[] = [
  { name: "Fővám tér", at: { lat: 47.486455, lng: 19.057664 } },
  { name: "Kálvin tér", at: { lat: 47.489432, lng: 19.061488 } },
  { name: "Corvin negyed", at: { lat: 47.485546, lng: 19.070905 } },
  { name: "Boráros tér", at: { lat: 47.480488, lng: 19.067308 } },
];

export const MVP_POLYGON: LatLng[] = MVP_CORNERS.map((c) => c.at);

/** Alapértelmezett „saját hely”, amíg a felhasználó nem ad meg mást. */
export const DEFAULT_POSITION: LatLng = { lat: 47.4888, lng: 19.0622 }; // Kálvin tér, a Ráday utca torkolata

const R = 6371000;
const toRad = (d: number) => (d * Math.PI) / 180;

/** Távolság méterben (haversine). */
export function distanceM(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Ray casting: benne van-e a pont a sokszögben. */
export function isInsidePolygon(p: LatLng, poly: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    const crosses =
      a.lat > p.lat !== b.lat > p.lat &&
      p.lng < ((b.lng - a.lng) * (p.lat - a.lat)) / (b.lat - a.lat) + a.lng;
    if (crosses) inside = !inside;
  }
  return inside;
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(1).replace(".", ",")} km`;
}

/** Gyalogos idő percben (~80 m/perc). */
export function walkMinutes(m: number): number {
  return Math.max(1, Math.round(m / 80));
}
