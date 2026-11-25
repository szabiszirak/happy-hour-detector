import { describe, expect, it } from "vitest";
import {
  beerBrandOptions,
  describeProfile,
  inferSubtype,
  migrateProfile,
  normalizePrefs,
  prefScore,
  SUBTYPE_CATEGORY,
  SUBTYPE_OPTIONS,
} from "./tasteProfile";
import { compareHu, CATEGORY_OF } from "./drinkCatalog";
import { matchScore } from "./match";
import { seedPlaces as fixturePlaces } from "./fixtures";
import type { Drink, DrinkStyle, Place, TasteProfile } from "./types";

const fri = (h: number) => new Date(2026, 10, 20, h, 0);
const d = (name: string, style: DrinkStyle, extra: Partial<Drink> = {}): Drink => ({ id: name, name, style, volumeL: 0.5, price: 900, ...extra });
const place = (drinks: Drink[]): Place => ({ id: "x", name: "X", address: "", location: { lat: 47.486, lng: 19.064 }, vibes: [], drinks, happyHours: [] });
const profile = (p: Partial<TasteProfile>): TasteProfile => ({ version: 2, categories: [], prefs: {}, priceBand: "premium", completedAt: 0, ...p });

describe("alfajták", () => {
  it("minden alfajta pontosan egy kategóriához tartozik", () => {
    for (const [cat, opts] of Object.entries(SUBTYPE_OPTIONS)) for (const o of opts) expect(SUBTYPE_CATEGORY[o.value]).toBe(cat);
  });
  it("a sörmárkák ABC-sorrendben jönnek", () => {
    const b = beerBrandOptions();
    expect([...b].sort(compareHu)).toEqual(b);
    expect(b.indexOf("Kozel")).toBeLessThan(b.indexOf("Kőbányai"));
  });
});

describe("alfajta felismerése névből / márkából", () => {
  it.each([
    ["Pohár rosé", "wine", "rose"],
    ["Kékfrankos", "wine", "red"],
    ["Tokaji aszú", "wine", "sweet"],
    ["Félédes muskotály", "wine", "semi_sweet"],
    ["Pohár olaszrizling", "wine", "dry_white"],
    ["Pálinka (szilva)", "shot", "palinka"],
    ["Jameson", "shot", "whiskey"],
    ["Jägermeister", "shot", "liqueur"],
    ["Tequila", "shot", "tequila"],
    ["Gin-tonik", "longdrink", "gin_tonic"],
    ["Aperol Spritz", "longdrink", "spritz"],
    ["Mojito", "longdrink", "mojito"],
    ["Negroni", "longdrink", "classic"],
    ["Whisky-cola", "longdrink", "longdrink"],
    ["Heineken 0.0", "nonalcoholic", "na_beer"],
    ["Limonádé", "nonalcoholic", "lemonade"],
    ["Kinley tonik", "nonalcoholic", "tonic_soda"],
  ] as [string, DrinkStyle, string][])("%s → %s", (name, style, sub) => {
    expect(inferSubtype(d(name, style))).toBe(sub);
  });
  it("a megadott Fajta felülírja a névből következtetést, de csak a saját kategóriáján belül", () => {
    expect(inferSubtype(d("Házi bor", "wine", { subtype: "red" }))).toBe("red");
    expect(inferSubtype(d("Házi bor", "wine", { subtype: "gin" }))).toBeUndefined();
  });
  it("sörnél és ismeretlen névnél nincs alfajta", () => {
    expect(inferSubtype(d("Dreher korsó", "lager"))).toBeUndefined();
    expect(inferSubtype(d("Ház bora", "wine"))).toBeUndefined();
  });
});

describe("profil-migráció (v1 → v2)", () => {
  it("a régi kategóriák lefordulnak, ismétlés nélkül, sorrendben", () => {
    const p = migrateProfile({ categories: ["craftbeer", "shot", "lightbeer", "longdrink"], priceBand: "budget", completedAt: 5 })!;
    expect(p).toEqual({ version: 2, categories: ["beer", "spirits", "cocktail"], prefs: {}, priceBand: "budget", completedAt: 5 });
  });
  it("a v2 profil változatlan marad; hibás adatnál undefined", () => {
    const v2 = profile({ categories: ["wine"], prefs: { wine: ["rose"] }, priceBand: "mid" });
    expect(migrateProfile(v2)).toEqual(v2);
    expect(migrateProfile(null)).toBeUndefined();
    expect(migrateProfile("x")).toBeUndefined();
    expect(migrateProfile({ foo: 1 })).toBeUndefined();
  });
});

describe("preferenciák rendezése és leírása", () => {
  it("csak a kiválasztott kategóriák maradnak, a márkák egységesítve, ABC-ben, ismétlés nélkül", () => {
    const p = normalizePrefs(["beer", "wine"], { beerBrands: ["soproni", "Kozel", "kozel", "Saját Sör"], wine: ["rose", "rose"], spirits: ["gin"] });
    expect(p).toEqual({ beerBrands: ["Kozel", "Saját Sör", "Soproni"], wine: ["rose"] });
  });
  it("leírás a menühöz", () => {
    expect(describeProfile(profile({ categories: ["beer", "wine", "soft"], prefs: { beerBrands: ["Kozel"], wine: ["rose", "red"] } }))).toBe(
      "Sör (Kozel) · Bor / Fröccs (Rosé, Vörös) · Üdítő / Alkoholmentes",
    );
  });
});

describe("pontos preferencia a MatchScore-ban", () => {
  const kozelBar = place([d("Kozel korsó", "lager", { brand: "Kozel" })]);
  const dreherBar = place([d("Dreher korsó", "lager", { brand: "Dreher" })]);

  it("prefScore: null, ha nincs részlet; 1 / 0 a kedvenc márka szerint", () => {
    expect(prefScore(kozelBar, profile({ categories: ["beer"] }))).toBeNull();
    expect(prefScore(kozelBar, profile({ categories: ["beer"], prefs: { beerBrands: ["kozel"] } }))).toBe(1);
    expect(prefScore(dreherBar, profile({ categories: ["beer"], prefs: { beerBrands: ["Kozel"] } }))).toBe(0);
  });

  it("a kedvenc márkát kínáló hely jobban passzol", () => {
    const p = profile({ categories: ["beer"], prefs: { beerBrands: ["Kozel"] } });
    expect(matchScore(kozelBar, p, fri(20))).toBeGreaterThan(matchScore(dreherBar, p, fri(20)));
    expect(matchScore(kozelBar, p, fri(20))).toBe(100);
  });

  it("részletek nélkül a pontszám ugyanaz, mint korábban (60% kínálat / 40% ár)", () => {
    const p = profile({ categories: ["beer"] });
    expect(matchScore(kozelBar, p, fri(20))).toBe(100);
    expect(matchScore(place([d("Bor", "wine")]), p, fri(20))).toBe(40);
  });

  it("alfajta-preferencia: rosét kedvelőnek a rosét kínáló bár jobb", () => {
    const p = profile({ categories: ["wine"], prefs: { wine: ["rose"] } });
    const rose = place([d("Pohár rosé", "wine", { volumeL: 0.15 })]);
    const red = place([d("Pohár kékfrankos", "wine", { volumeL: 0.15 })]);
    expect(matchScore(rose, p, fri(20))).toBeGreaterThan(matchScore(red, p, fri(20)));
  });

  it("több kategóriánál csak a részletezettek számítanak a preferenciába", () => {
    const p = profile({ categories: ["beer", "spirits"], prefs: { spirits: ["palinka"] } });
    const both = place([d("Kozel", "lager", { brand: "Kozel" }), d("Pálinka (szilva)", "shot", { volumeL: 0.04 })]);
    expect(prefScore(both, p)).toBe(1);
    expect(prefScore(place([d("Kozel", "lager")]), p)).toBe(0);
  });

  it("a teszthelyek mindegyikén lefut hibátlanul, 0–100 közötti értékkel", () => {
    const p = profile({ categories: ["beer", "wine", "spirits", "cocktail", "soft"], prefs: { beerBrands: ["Soproni"], wine: ["dry_white"], spirits: ["palinka"], cocktail: ["gin_tonic"], soft: ["lemonade"] }, priceBand: "budget" });
    for (const pl of fixturePlaces()) {
      const s = matchScore(pl, p, fri(20));
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
    }
    expect(Object.keys(CATEGORY_OF).length).toBe(11);
  });
});
