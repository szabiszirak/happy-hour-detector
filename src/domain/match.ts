import type { Place, PriceBand, TasteProfile } from "./types";
import { cheapestBeer, currentPrice } from "./pricing";
import { CATEGORY_OF } from "./drinkCatalog";
import { prefScore } from "./tasteProfile";

/** Az ársáv felső határa egy korsóra (0,5 l) vetítve. */
export const BAND_MAX: Record<PriceBand, number> = { budget: 800, mid: 1200, premium: Infinity };

/** Súlyok: kínálat / pontos preferencia / ár. Részletek nélkül a preferencia súlya arányosan megoszlik. */
export const MATCH_WEIGHTS = { supply: 0.45, pref: 0.25, price: 0.3 } as const;

/**
 * Ízlés MatchScore (0–100).
 * - kínálat: a felhasználó kedvelt kategóriáiból hányat tud a hely,
 * - pontos preferencia: a kedvenc márka / alfajta (pl. Kozel, rosé, pálinka) kapható-e,
 * - ár: a kedvelt italok mennyire férnek bele a pénztárcasávba.
 * Ha a felhasználó nem részletezte az ízlését, a 25% a másik két pillér között oszlik meg (60/40).
 */
export function matchScore(place: Place, profile: TasteProfile, now: Date): number {
  if (profile.categories.length === 0) return 50;
  const offered = new Set(place.drinks.map((d) => CATEGORY_OF[d.style]));
  const supply = profile.categories.filter((c) => offered.has(c)).length / profile.categories.length;

  const max = BAND_MAX[profile.priceBand];
  let priceScore: number;
  if (max === Infinity) priceScore = 1;
  else {
    const liked = place.drinks.filter((d) => profile.categories.includes(CATEGORY_OF[d.style]));
    const pool = liked.length ? liked : place.drinks;
    // korsó-egyenérték: a 0,5 l-es árra vetítve hasonlítjuk a sávhoz (söröknél)
    const ratios = pool.map((d) => {
      const { price } = currentPrice(d, place, now);
      const isBeer = CATEGORY_OF[d.style] === "beer";
      const comparable = isBeer ? (price / d.volumeL) * 0.5 : price;
      return comparable <= max ? 1 : Math.max(0, 1 - (comparable - max) / max);
    });
    priceScore = Math.max(...ratios, 0);
    const cb = cheapestBeer(place, now);
    if (profile.categories.includes("beer") && cb && cb.perL * 0.5 <= max) priceScore = Math.max(priceScore, 1);
  }

  const pref = prefScore(place, profile);
  const { supply: ws, pref: wp, price: wpr } = MATCH_WEIGHTS;
  const score = pref === null ? (ws * supply + wpr * priceScore) / (ws + wpr) : ws * supply + wp * pref + wpr * priceScore;
  return Math.round(score * 100);
}
