import type { Place, PriceBand, TasteProfile } from "./types";
import { STYLE_TO_TASTE } from "./types";
import { cheapestBeer, currentPrice } from "./pricing";

/** Az ársáv felső határa egy korsóra (0,5 l) vetítve. */
export const BAND_MAX: Record<PriceBand, number> = { budget: 800, mid: 1200, premium: Infinity };

/**
 * Ízlés MatchScore (0–100).
 * 60% kínálati illeszkedés: a felhasználó kedvelt kategóriáiból hányat tud a hely.
 * 40% árszint: a hely kedvelt italai mennyire férnek bele a pénztárcasávba.
 * (A hangulati pillér akkor jön be, ha a profil tanul hangulatot – lásd ötlettár.)
 */
export function matchScore(place: Place, profile: TasteProfile, now: Date): number {
  if (profile.categories.length === 0) return 50;
  const offered = new Set(place.drinks.map((d) => STYLE_TO_TASTE[d.style]).filter(Boolean));
  const supply = profile.categories.filter((c) => offered.has(c)).length / profile.categories.length;

  const max = BAND_MAX[profile.priceBand];
  let priceScore: number;
  if (max === Infinity) priceScore = 1;
  else {
    const liked = place.drinks.filter((d) => {
      const t = STYLE_TO_TASTE[d.style];
      return t && profile.categories.includes(t);
    });
    const pool = liked.length ? liked : place.drinks;
    // korsó-egyenérték: a 0,5 l-es árra vetítve hasonlítjuk a sávhoz (söröknél)
    const ratios = pool.map((d) => {
      const { price } = currentPrice(d, place, now);
      const isBeer = ["pilsner", "lager", "ipa", "wheat", "dark", "craft"].includes(d.style);
      const comparable = isBeer ? (price / d.volumeL) * 0.5 : price;
      return comparable <= max ? 1 : Math.max(0, 1 - (comparable - max) / max);
    });
    priceScore = Math.max(...ratios, 0);
    const cb = cheapestBeer(place, now);
    if (profile.categories.includes("lightbeer") && cb && cb.perL * 0.5 <= max) priceScore = Math.max(priceScore, 1);
  }
  return Math.round((0.6 * supply + 0.4 * priceScore) * 100);
}
