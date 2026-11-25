// Kategóriánkénti árkeret: „mennyit fizetnél szívesen…” – csak a kiválasztott italkategóriákra.
import type { CategoryBudgets, DrinkCategory, Drink, Place, PriceBand, TasteProfile } from "./types";
import { CATEGORY_LABELS, CATEGORY_OF, CATEGORY_ORDER } from "./drinkCatalog";
import { currentPrice, formatFt } from "./pricing";

/** Mire vonatkozik a keret: sörnél korsó (0,5 l), röviditalnál 4 cl, a többinél darab (pohár / fröccs / koktél). */
export const BUDGET_UNIT: Record<DrinkCategory, { question: string; unit: string; refVolumeL: number | null }> = {
  beer: { question: "Egy korsó (0,5 l) sörért", unit: "korsó", refVolumeL: 0.5 },
  wine: { question: "Egy pohár borért vagy egy fröccsért", unit: "pohár", refVolumeL: null },
  spirits: { question: "Egy feles (4 cl) röviditalért", unit: "4 cl", refVolumeL: 0.04 },
  cocktail: { question: "Egy koktélért / long drinkért", unit: "db", refVolumeL: null },
  soft: { question: "Egy üdítőért / alkoholmentes italért", unit: "db", refVolumeL: null },
};

/** Választható felső határok kategóriánként (Ft), budapesti 2026-os árakhoz igazítva. A „mindegy” = null. */
export const BUDGET_STEPS: Record<DrinkCategory, number[]> = {
  beer: [800, 1000, 1300, 1700],
  wine: [600, 900, 1300, 1800],
  spirits: [600, 900, 1300, 2000],
  cocktail: [1500, 2200, 3000, 4000],
  soft: [500, 700, 900],
};

/** A keretnél ennyivel drágább ital még kap részpontot (lineárisan csökkenve 0-ig). */
export const BUDGET_TOLERANCE = 0.25;

/** Alapértelmezett, előre kijelölt lépcső (a második). */
export function defaultBudget(c: DrinkCategory): number {
  return BUDGET_STEPS[c][1];
}

/** Az ital ára a keret egységére vetítve (sör → 0,5 l, rövid → 4 cl, egyébként darabár). */
export function normalizedPrice(drink: Drink, price: number): number {
  const ref = BUDGET_UNIT[CATEGORY_OF[drink.style]].refVolumeL;
  if (ref === null || !(drink.volumeL > 0)) return price;
  return Math.round((price / drink.volumeL) * ref);
}

/** 1 = belefér, 0 = jóval drágább; a kettő között a tűréssávban lineárisan. Nincs keret → 1. */
export function budgetFit(price: number, budget: number | null | undefined): number {
  if (budget === null || budget === undefined) return 1;
  if (price <= budget) return 1;
  return Math.max(0, 1 - (price - budget) / (budget * BUDGET_TOLERANCE));
}

/** Belefér-e az ital (most érvényes árával) a felhasználó keretébe. `null`, ha a kategóriára nincs keret. */
export function withinBudget(drink: Drink, price: number, profile: TasteProfile): boolean | null {
  const c = CATEGORY_OF[drink.style];
  if (!profile.categories.includes(c)) return null;
  const b = profile.budgets[c];
  if (b === null || b === undefined) return null;
  return normalizedPrice(drink, price) <= b;
}

/**
 * Ár-illeszkedés 0–1: a profil minden kategóriájára a hely legjobban illeszkedő itala számít,
 * ezek átlaga. Kategória, amiből a helyen nincs ital, nem húzza le (azt a kínálat-pillér bünteti);
 * ha a kedvelt kategóriákból semmi sincs, 0.
 */
export function placeBudgetScore(place: Place, profile: TasteProfile, now: Date): number {
  const fits: number[] = [];
  for (const c of profile.categories) {
    const drinks = place.drinks.filter((d) => CATEGORY_OF[d.style] === c);
    if (!drinks.length) continue;
    const best = Math.max(
      ...drinks.map((d) => budgetFit(normalizedPrice(d, currentPrice(d, place, now).price), profile.budgets[c])),
    );
    fits.push(best);
  }
  if (!fits.length) return 0;
  return fits.reduce((a, b) => a + b, 0) / fits.length;
}

/** A legközelebbi választható lépcső (régi / kézzel szerkesztett értékekhez). */
export function snapBudget(c: DrinkCategory, value: number): number {
  return BUDGET_STEPS[c].reduce((best, s) => (Math.abs(s - value) < Math.abs(best - value) ? s : best));
}

/** Mentés előtti rendrakás: csak a kiválasztott kategóriák, érvényes lépcsőkkel; hiányzóhoz az alapérték. */
export function normalizeBudgets(categories: DrinkCategory[], budgets: CategoryBudgets): CategoryBudgets {
  const out: CategoryBudgets = {};
  for (const c of CATEGORY_ORDER) {
    if (!categories.includes(c)) continue;
    const v = budgets[c];
    out[c] = v === null ? null : typeof v === "number" && v > 0 ? snapBudget(c, v) : defaultBudget(c);
  }
  return out;
}

/** v1/v2 profil egyetlen „korsó” ársávjából sörkeret. */
export function budgetsFromBand(band: PriceBand | undefined, categories: DrinkCategory[]): CategoryBudgets {
  const out: CategoryBudgets = {};
  if (categories.includes("beer")) out.beer = band === "budget" ? 800 : band === "premium" ? null : 1300;
  return out;
}

export function formatBudget(v: number | null | undefined): string {
  return v === null || v === undefined ? "mindegy" : `max. ${formatFt(v)}`;
}

/** Rövid összegzés a menühöz: „Sör max. 1 000 Ft · Bor / Fröccs mindegy”. */
export function describeBudgets(profile: TasteProfile): string {
  return profile.categories
    .filter((c) => c in profile.budgets)
    .map((c) => `${CATEGORY_LABELS[c]} ${formatBudget(profile.budgets[c])}`)
    .join(" · ");
}
