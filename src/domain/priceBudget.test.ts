import { describe, expect, it } from "vitest";
import type { Drink, Place, TasteProfile } from "./types";
import {
  BUDGET_STEPS,
  budgetFit,
  budgetsFromBand,
  defaultBudget,
  describeBudgets,
  normalizeBudgets,
  normalizedPrice,
  placeBudgetScore,
  snapBudget,
  withinBudget,
} from "./priceBudget";
import { matchScore } from "./match";

const fri = (h: number, m = 0) => new Date(2026, 10, 20, h, m);
let n = 0;
const d = (name: string, style: Drink["style"], price: number, extra: Partial<Drink> = {}): Drink => ({
  id: `d${n++}`, name, style, volumeL: 0.5, price, ...extra,
});
const place = (drinks: Drink[], extra: Partial<Place> = {}): Place => ({
  id: `p${n++}`, name: "Teszt", address: "", location: { lat: 47.48, lng: 19.06 }, vibes: [], drinks, happyHours: [], ...extra,
});
const profile = (p: Partial<TasteProfile>): TasteProfile => ({ version: 3, categories: [], prefs: {}, budgets: {}, completedAt: 0, ...p });

describe("árkeret – egységre vetítés", () => {
  it("a sör 0,5 l-re, a rövidital 4 cl-re számolódik, a többi darabár", () => {
    expect(normalizedPrice(d("Kozel 0,3", "lager", 600, { volumeL: 0.3 }), 600)).toBe(1000);
    expect(normalizedPrice(d("Pálinka 2 cl", "shot", 500, { volumeL: 0.02 }), 500)).toBe(1000);
    expect(normalizedPrice(d("Nagyfröccs", "spritzer", 900, { volumeL: 0.3 }), 900)).toBe(900);
    expect(normalizedPrice(d("Mojito", "longdrink", 2500, { volumeL: 0.3 }), 2500)).toBe(2500);
  });
  it("illeszkedés: kereten belül 1, +25%-ig fokozatosan csökken, afölött 0; „mindegy” mindig 1", () => {
    expect(budgetFit(1000, 1000)).toBe(1);
    expect(budgetFit(1125, 1000)).toBeCloseTo(0.5);
    expect(budgetFit(1300, 1000)).toBe(0);
    expect(budgetFit(99999, null)).toBe(1);
    expect(budgetFit(99999, undefined)).toBe(1);
  });
});

describe("árkeret – hely pontszáma", () => {
  it("kategóriánként a legjobb ital számít, a kategóriák átlaga", () => {
    const p = profile({ categories: ["beer", "cocktail"], budgets: { beer: 1000, cocktail: 2200 } });
    const pl = place([d("Drága sör", "craft", 1800), d("Olcsó sör", "lager", 900), d("Koktél", "longdrink", 3000, { volumeL: 0.3 })]);
    expect(placeBudgetScore(pl, p, fri(20))).toBeCloseTo(0.5); // sör 1, koktél 0
  });
  it("a hiányzó kategória nem húz le; ha semmi nincs a kedveltekből, 0", () => {
    const p = profile({ categories: ["beer", "wine"], budgets: { beer: 800, wine: 600 } });
    expect(placeBudgetScore(place([d("Sör", "lager", 800)]), p, fri(20))).toBe(1);
    expect(placeBudgetScore(place([d("Mojito", "longdrink", 1500)]), p, fri(20))).toBe(0);
  });
  it("Happy Hour alatt a kedvezményes ár számít", () => {
    const hh = [{ id: "h", days: [5], start: "17:00", end: "19:00", note: "" }];
    const pl = place([d("Sör", "lager", 1200, { hhPrice: 800 })], { happyHours: hh });
    const p = profile({ categories: ["beer"], budgets: { beer: 800 } });
    expect(placeBudgetScore(pl, p, fri(18))).toBe(1);
    expect(placeBudgetScore(pl, p, fri(21))).toBe(0);
  });
  it("a MatchScore az árkerettel számol: drága koktélbár < kereten belüli", () => {
    const p = profile({ categories: ["cocktail"], budgets: { cocktail: 2200 } });
    const cheap = place([d("Gin-tonik", "longdrink", 2000, { volumeL: 0.3 })]);
    const pricey = place([d("Gin-tonik", "longdrink", 3500, { volumeL: 0.3 })]);
    expect(matchScore(cheap, p, fri(20))).toBe(100);
    expect(matchScore(pricey, p, fri(20))).toBe(60);
  });
  it("withinBudget: csak a profil kategóriáira, „mindegy” esetén nincs jelölés", () => {
    const p = profile({ categories: ["beer", "wine"], budgets: { beer: 1000, wine: null } });
    expect(withinBudget(d("Sör", "lager", 900), 900, p)).toBe(true);
    expect(withinBudget(d("Sör", "lager", 1100), 1100, p)).toBe(false);
    expect(withinBudget(d("Bor", "wine", 5000), 5000, p)).toBeNull();
    expect(withinBudget(d("Mojito", "longdrink", 100), 100, p)).toBeNull();
  });
});

describe("árkeret – mentés és migráció", () => {
  it("csak a kiválasztott kategóriák maradnak, lépcsőre igazítva, hiányzónál alapértékkel", () => {
    expect(normalizeBudgets(["beer", "spirits", "soft"], { beer: 950, wine: 900, soft: null })).toEqual({
      beer: 1000,
      spirits: defaultBudget("spirits"),
      soft: null,
    });
    expect(snapBudget("cocktail", 10000)).toBe(4000);
  });
  it("minden kategória lépcsői növekvők, és az alapérték köztük van", () => {
    for (const [c, steps] of Object.entries(BUDGET_STEPS)) {
      expect([...steps].sort((a, b) => a - b)).toEqual(steps);
      expect(steps).toContain(defaultBudget(c as keyof typeof BUDGET_STEPS));
    }
  });
  it("régi ársávból sörkeret; sör nélküli profilnál üres", () => {
    expect(budgetsFromBand("budget", ["beer"])).toEqual({ beer: 800 });
    expect(budgetsFromBand("mid", ["beer", "wine"])).toEqual({ beer: 1300 });
    expect(budgetsFromBand("premium", ["beer"])).toEqual({ beer: null });
    expect(budgetsFromBand("budget", ["wine"])).toEqual({});
  });
  it("menü-összegzés", () => {
    const p = profile({ categories: ["beer", "wine"], budgets: { beer: 1000, wine: null } });
    expect(describeBudgets(p)).toBe("Sör max. 1000 Ft · Bor / Fröccs mindegy");
  });
});
