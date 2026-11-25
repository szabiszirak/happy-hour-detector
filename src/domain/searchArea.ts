// Keresési kör: a referenciapont (a helyed, vagy messziről a Kálvin tér) körüli sugár.
import type { LatLng, Place } from "./types";
import { distanceM, formatDistance } from "./geo";

/** A választható sugarak méterben (csúszka és −/+ léptetők). */
export const RADIUS_STEPS = [250, 500, 750, 1000, 1500, 2000, 3000] as const;
export const DEFAULT_RADIUS_M = 1000;
export const MIN_RADIUS_M = RADIUS_STEPS[0];
export const MAX_RADIUS_M = RADIUS_STEPS[RADIUS_STEPS.length - 1];

/** A legközelebbi megengedett lépcsőre igazít. */
export function snapRadius(m: number): number {
  if (!Number.isFinite(m)) return DEFAULT_RADIUS_M;
  return RADIUS_STEPS.reduce((best, s) => (Math.abs(s - m) < Math.abs(best - m) ? s : best), RADIUS_STEPS[0]);
}

/** Egy lépcsővel kisebb / nagyobb sugár (a széleken megáll). */
export function stepRadius(current: number, dir: -1 | 1): number {
  const i = RADIUS_STEPS.indexOf(snapRadius(current) as (typeof RADIUS_STEPS)[number]);
  return RADIUS_STEPS[Math.min(RADIUS_STEPS.length - 1, Math.max(0, i + dir))];
}

export const radiusIndex = (m: number) => RADIUS_STEPS.indexOf(snapRadius(m) as (typeof RADIUS_STEPS)[number]);

export const formatRadius = (m: number) => formatDistance(m);

/** A kör szélén lévő helyet még belülinek tekintjük (≤). */
export function inRadius(place: Pick<Place, "location">, center: LatLng, radiusM: number): boolean {
  return distanceM(center, place.location) <= radiusM;
}

/** Helyek szétválogatása körön belülire és kívülire. */
export function splitByRadius<T extends Pick<Place, "location">>(places: T[], center: LatLng, radiusM: number) {
  const inside: T[] = [];
  const outside: T[] = [];
  for (const p of places) (inRadius(p, center, radiusM) ? inside : outside).push(p);
  return { inside, outside };
}

/** Mekkora sugár kell legalább ahhoz, hogy a megadott hely bekerüljön (a következő lépcső), vagy null. */
export function radiusToInclude(place: Pick<Place, "location">, center: LatLng): number | null {
  const d = distanceM(center, place.location);
  return RADIUS_STEPS.find((s) => s >= d) ?? null;
}
