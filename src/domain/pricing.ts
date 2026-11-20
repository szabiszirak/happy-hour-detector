import type { Drink, Place } from "./types";
import { happyHourStatus } from "./happyHour";

/** Az ital ára most: Happy Hour alatt a kedvezményes ár, ha van. */
export function currentPrice(drink: Drink, place: Place, now: Date): { price: number; isHH: boolean } {
  const hh = happyHourStatus(place, now).kind === "active";
  if (hh && drink.hhPrice !== undefined && drink.hhPrice < drink.price) return { price: drink.hhPrice, isHH: true };
  return { price: drink.price, isHH: false };
}

/** Ft/liter – enélkül a 0,3-as és a 0,5-ös korsó ára nem hasonlítható össze. */
export function pricePerLiter(price: number, volumeL: number): number {
  return Math.round(price / volumeL);
}

export function formatFt(n: number): string {
  return `${n.toLocaleString("hu-HU").replace(/ /g, " ")} Ft`;
}

export function formatVolume(l: number): string {
  if (l < 0.1) return `${Math.round(l * 100)} cl`;
  return `${String(l).replace(".", ",")} l`;
}

/** A hely legolcsóbb söre most (korsó-egyenértékben, Ft/l alapján). */
export function cheapestBeer(place: Place, now: Date): { drink: Drink; price: number; perL: number; isHH: boolean } | null {
  const beerStyles = new Set(["pilsner", "lager", "ipa", "wheat", "dark", "craft"]);
  let best: { drink: Drink; price: number; perL: number; isHH: boolean } | null = null;
  for (const d of place.drinks) {
    if (!beerStyles.has(d.style)) continue;
    const { price, isHH } = currentPrice(d, place, now);
    const perL = pricePerLiter(price, d.volumeL);
    if (!best || perL < best.perL) best = { drink: d, price, perL, isHH };
  }
  return best;
}
