import type { Drink, DrinkStyle, LatLng, Place, TasteProfile } from "./types";
import { distanceM } from "./geo";
import { currentPrice, pricePerLiter } from "./pricing";
import { happyHourStatus, type HHStatus } from "./happyHour";
import { matchScore } from "./match";
import { matchesSelection, type DrinkCategory } from "./drinkCatalog";

export type SortKey = "perL" | "price" | "distance" | "match";

export interface DrinkFilter {
  /** Kiválasztott italkategória (null = mind). */
  category: DrinkCategory | null;
  styles: DrinkStyle[]; // üres = mind (a kategórián belül)
  /** Márkakulcs (brandKey), OTHER_BRAND a márka nélküliekre, null = összes márka. */
  brand: string | null;
  brandQuery: string; // részszöveg a névben / márkában
  maxPrice?: number; // Ft, a mostani árra
  maxDistanceM?: number;
  hhOnly: boolean;
  sort: SortKey;
}

export const DEFAULT_FILTER: DrinkFilter = {
  category: null,
  styles: [],
  brand: null,
  brandQuery: "",
  maxPrice: undefined,
  maxDistanceM: 2000,
  hhOnly: false,
  sort: "perL",
};

export interface DrinkOffer {
  place: Place;
  drink: Drink;
  price: number;
  perL: number;
  isHH: boolean;
  distance: number;
  match?: number;
}

const norm = (s: string) =>
  s.toLocaleLowerCase("hu-HU").normalize("NFD").replace(/[̀-ͯ]/g, "");

/** A „Piák & árak” fül: ital-ajánlatok listája szűrve, rendezve. */
export function searchDrinks(
  places: Place[],
  filter: DrinkFilter,
  pos: LatLng,
  now: Date,
  profile?: TasteProfile,
): DrinkOffer[] {
  const q = norm(filter.brandQuery.trim());
  const out: DrinkOffer[] = [];
  for (const place of places) {
    const distance = distanceM(pos, place.location);
    if (filter.maxDistanceM !== undefined && distance > filter.maxDistanceM) continue;
    const hhActive = happyHourStatus(place, now).kind === "active";
    if (filter.hhOnly && !hhActive) continue;
    const match = profile ? matchScore(place, profile, now) : undefined;
    for (const drink of place.drinks) {
      if (!matchesSelection(drink, filter)) continue;
      if (q && !norm(`${drink.name} ${drink.brand ?? ""}`).includes(q)) continue;
      const { price, isHH } = currentPrice(drink, place, now);
      if (filter.maxPrice !== undefined && price > filter.maxPrice) continue;
      out.push({ place, drink, price, perL: pricePerLiter(price, drink.volumeL), isHH, distance, match });
    }
  }
  const cmp: Record<SortKey, (a: DrinkOffer, b: DrinkOffer) => number> = {
    perL: (a, b) => a.perL - b.perL || a.distance - b.distance,
    price: (a, b) => a.price - b.price || a.distance - b.distance,
    distance: (a, b) => a.distance - b.distance || a.perL - b.perL,
    match: (a, b) => (b.match ?? 0) - (a.match ?? 0) || a.perL - b.perL,
  };
  // Fontos: a szponzoráció NEM szerepel a rendezésben – az organikus sorrend nem megvehető.
  return out.sort(cmp[filter.sort]);
}

export interface HHEntry {
  place: Place;
  status: Exclude<HHStatus, { kind: "none" }>;
  distance: number;
}

/** A „Happy Hour” fül: most zajló, majd hamarosan induló akciók. */
export function happyHourList(places: Place[], pos: LatLng, now: Date): HHEntry[] {
  const out: HHEntry[] = [];
  for (const place of places) {
    const status = happyHourStatus(place, now);
    if (status.kind === "none") continue;
    out.push({ place, status, distance: distanceM(pos, place.location) });
  }
  return out.sort((a, b) => {
    if (a.status.kind !== b.status.kind) return a.status.kind === "active" ? -1 : 1;
    return a.distance - b.distance;
  });
}

/**
 * Régi, hely-szintű kiemelés: a felület már NEM jeleníti meg (a kocsmák listája / térképe nem megvehető).
 * A fizetős kiemelés italokra szól – lásd pricing.ts rankDrinkOffers.
 */
export function activeSponsored(places: Place[], now: Date): Place[] {
  return places.filter((p) => p.sponsored && p.sponsored.until > now.getTime());
}
