import type { LatLng } from "./types";
import { distanceM, MVP_POLYGON } from "./geo";

/** Az MVP-terület középpontja. */
export const AREA_CENTER: LatLng = {
  lat: MVP_POLYGON.reduce((s, p) => s + p.lat, 0) / MVP_POLYGON.length,
  lng: MVP_POLYGON.reduce((s, p) => s + p.lng, 0) / MVP_POLYGON.length,
};

/**
 * Ennél messzebbről a valódi helyet nem használjuk a távolságokhoz (értelmetlen lenne
 * „8,4 km”-t írni minden kocsma mellé) – helyette a Kálvin térhez mérünk, és ezt kiírjuk.
 */
export const NEARBY_LIMIT_M = 3000;

export type GeoStatus =
  | { kind: "idle" } // még nem kértük
  | { kind: "asking" } // a böngésző épp engedélyt kér
  | { kind: "tracking"; accuracy: number } // követjük, a helyzet a környéken van
  | { kind: "faraway"; distance: number; accuracy: number } // megvan, de messze van
  | { kind: "manual" } // a felhasználó a térképre koppintva adta meg
  | { kind: "denied" } // a felhasználó letiltotta
  | { kind: "unavailable" }; // nincs helymeghatározás / hiba / időtúllépés

/** Egy friss GPS-adatból: használjuk-e, és milyen állapotot mutatunk. */
export function classifyFix(fix: LatLng, accuracy: number): { usePosition: boolean; status: GeoStatus } {
  const d = distanceM(fix, AREA_CENTER);
  if (d > NEARBY_LIMIT_M) return { usePosition: false, status: { kind: "faraway", distance: d, accuracy } };
  return { usePosition: true, status: { kind: "tracking", accuracy } };
}

/** GeolocationPositionError.code → állapot (1 = PERMISSION_DENIED). */
export function classifyError(code: number): GeoStatus {
  return code === 1 ? { kind: "denied" } : { kind: "unavailable" };
}
