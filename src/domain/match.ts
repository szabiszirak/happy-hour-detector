import type { Place, TasteProfile } from "./types";
import { CATEGORY_OF } from "./drinkCatalog";
import { prefScore } from "./tasteProfile";
import { placeBudgetScore } from "./priceBudget";

/** Súlyok: kínálat / pontos preferencia / ár. Részletek nélkül a preferencia súlya arányosan megoszlik. */
export const MATCH_WEIGHTS = { supply: 0.45, pref: 0.25, price: 0.3 } as const;

/**
 * Ízlés MatchScore (0–100).
 * - kínálat: a felhasználó kedvelt kategóriáiból hányat tud a hely,
 * - pontos preferencia: a kedvenc márka / alfajta (pl. Kozel, rosé, pálinka) kapható-e,
 * - ár: kategóriánként a legjobb ital mennyire fér bele a felhasználó árkeretébe (priceBudget.ts).
 * Ha a felhasználó nem részletezte az ízlését, a 25% a másik két pillér között oszlik meg (60/40).
 */
export function matchScore(place: Place, profile: TasteProfile, now: Date): number {
  if (profile.categories.length === 0) return 50;
  const offered = new Set(place.drinks.map((d) => CATEGORY_OF[d.style]));
  const supply = profile.categories.filter((c) => offered.has(c)).length / profile.categories.length;
  const priceScore = placeBudgetScore(place, profile, now);
  const pref = prefScore(place, profile);
  const { supply: ws, pref: wp, price: wpr } = MATCH_WEIGHTS;
  const score = pref === null ? (ws * supply + wpr * priceScore) / (ws + wpr) : ws * supply + wp * pref + wpr * priceScore;
  return Math.round(score * 100);
}
