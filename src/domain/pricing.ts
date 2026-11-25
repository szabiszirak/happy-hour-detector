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

// ======================================================================
// Fizetős ital-kiemelés („Szponzorált”)
// Szabályok:
//  - csak ellenőrzött kocsmáros kérheti, csak a saját helye italára;
//  - aktiválni csak admin tud (a díj rendezése után) – a kliens nem tudja magának beállítani;
//  - a kiemelt ajánlat KÜLÖN blokkban jelenik meg, „Szponzorált” címkével; az organikus lista
//    sorrendje és tartalma pontosan ugyanaz, mint kiemelés nélkül (a helyek sorrendje nem megvehető).
// ======================================================================

export type PromotionStatus = "requested" | "active" | "rejected";

export const PROMOTION_STATUS_LABELS: Record<PromotionStatus, string> = {
  requested: "Jóváhagyásra vár",
  active: "Aktív",
  rejected: "Elutasítva",
};

export interface DrinkPromotion {
  id: string;
  placeId: string;
  drinkId: string;
  /** Mentéskori név – ha az italt közben törlik, a lista így is olvasható marad. */
  drinkName: string;
  /** Rövid ajánlószöveg (opcionális), pl. „Csapolt, hidegen”. */
  tagline: string;
  startsAt: number;
  until: number;
  status: PromotionStatus;
  requestedBy: string;
  requestedAt: number;
  /** Csak admin tölti ki (fizetés / számla rendezése után). */
  activatedAt?: number;
  activatedBy?: string;
  reviewNote?: string;
}

export const PROMO_LIMITS = {
  /** Egy listában legfeljebb ennyi kiemelt ajánlat jelenik meg. */
  maxSponsoredSlots: 2,
  taglineMax: 60,
  minDays: 1,
  maxDays: 30,
  /** Egy helynek egyszerre ennyi élő (kért vagy aktív) kiemelése lehet. */
  maxOpenPerPlace: 3,
} as const;

const DAY_MS = 86400000;

/** Lejárt-e (az aktív kiemelés is lejár az `until` után – ezt nem kell külön állapotba írni). */
export function promotionEnded(p: DrinkPromotion, now: number): boolean {
  return now >= p.until;
}

/** Felhasználónak szóló állapot: kért / aktív / lejárt / elutasítva. */
export function promotionStateLabel(p: DrinkPromotion, now: number): string {
  if (p.status === "rejected") return PROMOTION_STATUS_LABELS.rejected;
  if (promotionEnded(p, now)) return "Lejárt";
  if (p.status === "active" && now < p.startsAt) return "Ütemezve";
  return PROMOTION_STATUS_LABELS[p.status];
}

export interface PromotionRequestInput {
  placeId: string;
  drinkId: string;
  tagline: string;
  days: number;
  startsAt: number;
}

/**
 * Kiemelés kérése. `isOwner`: a kérő ellenőrzött kocsmárosa-e a helynek (ownership.isVerifiedOwner).
 * Az eredmény mindig `requested` – aktív csak admin döntéssel lesz.
 */
export function buildPromotionRequest(
  input: PromotionRequestInput,
  place: Place,
  isOwner: boolean,
  uid: string,
  existing: DrinkPromotion[],
  id: string,
  now: number,
): DrinkPromotion {
  if (!isOwner) throw new Error("Kiemelést csak a hely ellenőrzött kocsmárosa kérhet.");
  if (input.placeId !== place.id) throw new Error("Rossz hely.");
  const drink = place.drinks.find((d) => d.id === input.drinkId);
  if (!drink) throw new Error("Ez az ital nincs a hely itallapján.");
  if (!Number.isInteger(input.days) || input.days < PROMO_LIMITS.minDays || input.days > PROMO_LIMITS.maxDays)
    throw new Error(`A futamidő ${PROMO_LIMITS.minDays}–${PROMO_LIMITS.maxDays} nap lehet.`);
  const tagline = input.tagline.trim();
  if (tagline.length > PROMO_LIMITS.taglineMax) throw new Error(`Az ajánlószöveg legfeljebb ${PROMO_LIMITS.taglineMax} karakter.`);
  if (input.startsAt < now - 60000) throw new Error("A kezdés nem lehet a múltban.");
  const open = existing.filter((p) => p.placeId === place.id && p.status !== "rejected" && !promotionEnded(p, now));
  if (open.some((p) => p.drinkId === drink.id)) throw new Error("Erre az italra már van kért vagy futó kiemelés.");
  if (open.length >= PROMO_LIMITS.maxOpenPerPlace) throw new Error(`Egyszerre legfeljebb ${PROMO_LIMITS.maxOpenPerPlace} kiemelés lehet.`);
  return {
    id,
    placeId: place.id,
    drinkId: drink.id,
    drinkName: drink.name,
    tagline,
    startsAt: input.startsAt,
    until: input.startsAt + input.days * DAY_MS,
    status: "requested",
    requestedBy: uid,
    requestedAt: now,
  };
}

/** Admin döntés egy kiemelési kérésről (aktiválás a díj rendezése után, vagy elutasítás). */
export function decidePromotion(
  p: DrinkPromotion,
  decision: "activate" | "reject",
  reviewer: { uid: string; isAdmin: boolean },
  now: number,
  note = "",
): DrinkPromotion {
  if (!reviewer.isAdmin) throw new Error("Kiemelést csak admin aktiválhat.");
  if (p.status !== "requested") throw new Error("Ez a kérés már el van bírálva.");
  if (decision === "reject") return { ...p, status: "rejected", reviewNote: note.trim() || undefined };
  if (promotionEnded(p, now)) throw new Error("A kért időszak már lejárt.");
  return { ...p, status: "active", activatedAt: now, activatedBy: reviewer.uid };
}

/**
 * Élő-e most a kiemelés: admin aktiválta, időn belül van, a hely ellenőrzött kocsmárosa kérte,
 * és az ital még az itallapon van.
 */
export function isPromotionLive(
  p: DrinkPromotion,
  place: Place | undefined,
  ownerUid: string | undefined,
  now: number,
): boolean {
  return (
    p.status === "active" &&
    p.activatedBy !== undefined &&
    now >= p.startsAt &&
    now < p.until &&
    ownerUid !== undefined &&
    ownerUid === p.requestedBy &&
    !!place &&
    place.id === p.placeId &&
    place.drinks.some((d) => d.id === p.drinkId)
  );
}

/** A most élő kiemelések kulcsa: `placeId/drinkId` → kiemelés. */
export function livePromotionIndex(
  promos: DrinkPromotion[],
  places: Place[],
  owners: Record<string, { uid: string }>,
  now: number,
): Map<string, DrinkPromotion> {
  const byId = new Map(places.map((p) => [p.id, p]));
  const out = new Map<string, DrinkPromotion>();
  for (const p of promos)
    if (isPromotionLive(p, byId.get(p.placeId), owners[p.placeId]?.uid, now)) out.set(`${p.placeId}/${p.drinkId}`, p);
  return out;
}

/**
 * „Piák & árak”: a szűrt, organikusan rendezett ajánlatokból kiválasztja a kiemelteket egy külön blokkba.
 * - csak olyan ajánlat lehet kiemelt, ami a felhasználó szűrésének amúgy is megfelel (az organikus listában van);
 * - a kiemelt blokk sorrendje az organikus sorrend (nem a fizetett összeg), legfeljebb `slots` darab, helyenként 1;
 * - az organikus lista VÁLTOZATLAN (ugyanaz a tömb-tartalom és sorrend) – a kiemelt tétel ott is a helyén marad.
 */
export function rankDrinkOffers<T extends { place: { id: string }; drink: { id: string } }>(
  organic: T[],
  live: Map<string, DrinkPromotion>,
  slots: number = PROMO_LIMITS.maxSponsoredSlots,
): { sponsored: (T & { promo: DrinkPromotion })[]; organic: T[] } {
  const sponsored: (T & { promo: DrinkPromotion })[] = [];
  const usedPlaces = new Set<string>();
  for (const o of organic) {
    if (sponsored.length >= slots) break;
    const promo = live.get(`${o.place.id}/${o.drink.id}`);
    if (!promo || usedPlaces.has(o.place.id)) continue;
    usedPlaces.add(o.place.id);
    sponsored.push({ ...o, promo });
  }
  return { sponsored, organic };
}

/** A hely saját itallapja: az élő kiemelések felül („Szponzorált”), utána a többi eredeti sorrendben. */
export function orderPlaceMenu(place: Place, live: Map<string, DrinkPromotion>): { drink: Drink; promo?: DrinkPromotion }[] {
  const rows = place.drinks.map((drink) => ({ drink, promo: live.get(`${place.id}/${drink.id}`) }));
  return [...rows.filter((r) => r.promo), ...rows.filter((r) => !r.promo)];
}
