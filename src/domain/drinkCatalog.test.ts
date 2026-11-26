import { describe, expect, it } from "vitest";
import {
  BADGE_COLORS,
  brandBadge,
  brandKey,
  brandSuggestions,
  buildCatalog,
  canonicalBrand,
  CATEGORY_OF,
  CATEGORY_ORDER,
  compareHu,
  KNOWN_BRANDS,
  matchesSelection,
  OTHER_BRAND,
  STYLES_BY_CATEGORY,
} from "./drinkCatalog";
import { DEFAULT_FILTER, searchDrinks } from "./search";
import { seedPlaces as fixturePlaces } from "./fixtures";
import { seedPlaces as realPlaces } from "../data/seed";
import { MVP_POLYGON } from "./geo";
import type { Drink, DrinkStyle, Place } from "./types";
import { STYLE_LABELS } from "./types";

const fri = (h: number, m = 0) => new Date(2026, 10, 20, h, m);
const pos = MVP_POLYGON[1];

describe("kategóriák", () => {
  it("minden italstílus pontosan egy kategóriában van, és a kategória-listája tartalmazza", () => {
    for (const style of Object.keys(STYLE_LABELS) as DrinkStyle[]) {
      const cat = CATEGORY_OF[style];
      expect(CATEGORY_ORDER).toContain(cat);
      const holders = CATEGORY_ORDER.filter((c) => STYLES_BY_CATEGORY[c].includes(style));
      expect(holders, style).toEqual([cat]);
    }
  });
});

describe("márkák: ABC-sorrend és egyesítés", () => {
  it("magyar ABC szerint rendez (ékezetekkel)", () => {
    const sorted = ["Soproni", "Kőbányai", "Dreher", "Kozel", "Arany Ászok", "Borsodi"].sort(compareHu);
    expect(sorted).toEqual(["Arany Ászok", "Borsodi", "Dreher", "Kozel", "Kőbányai", "Soproni"]);
  });
  it("a szótár listái ABC-sorrendben jönnek ki a javaslatoknál", () => {
    for (const c of CATEGORY_ORDER) {
      const s = brandSuggestions(c);
      expect([...s].sort(compareHu)).toEqual(s);
      expect(s.length).toBe(KNOWN_BRANDS[c].length);
    }
  });
  it("kis-nagybetű és ékezet nem számít, az írásmód a szótár szerinti", () => {
    expect(brandKey("Kőbányai")).toBe(brandKey("kobanyai"));
    expect(brandKey("  Arany   Ászok ")).toBe("arany aszok");
    expect(canonicalBrand("arany aszok")).toBe("Arany Ászok");
    expect(canonicalBrand("  Saját  Főzde ")).toBe("Saját Főzde");
    expect(canonicalBrand("hedon")).toBe("Hedon");
    expect(canonicalBrand("fehér nyúl")).toBe("Fehér Nyúl");
    expect(canonicalBrand("MONYO")).toBe("MONYO");
  });
  it("kategórián belül nincs két ugyanolyan kulcsú márka (a szeszmárkák a koktéloknál is szerepelhetnek)", () => {
    for (const c of CATEGORY_ORDER) {
      const keys = KNOWN_BRANDS[c].map(brandKey);
      expect(new Set(keys).size, c).toBe(keys.length);
    }
  });
});

describe("márkajelvény (monogram, nem logó)", () => {
  it("kezdőbetűk: két szónál a két első betű, egy szónál az első kettő", () => {
    expect(brandBadge("Arany Ászok").initials).toBe("AÁ");
    expect(brandBadge("Dreher").initials).toBe("Dr");
    expect(brandBadge("Jack Daniel's").initials).toBe("JD");
    expect(brandBadge("Coca-Cola").initials).toBe("CC");
  });
  it("a szín a palettából jön, és márkánként mindig ugyanaz", () => {
    const a = brandBadge("Soproni");
    expect(BADGE_COLORS).toContain(a.color);
    expect(brandBadge("soproni").color).toBe(a.color);
  });
});

describe("katalógus", () => {
  it("üres adatnál nem dob hibát: nullás darabszámok, a szótárbeli márkák megjelennek", () => {
    const cat = buildCatalog(realPlaces());
    expect(cat.map((c) => c.category)).toEqual(CATEGORY_ORDER);
    for (const node of cat) {
      expect(node.count).toBe(0);
      expect(node.otherCount).toBe(0);
      expect(node.brands.length).toBe(KNOWN_BRANDS[node.category].length);
      expect(node.brands.every((b) => b.count === 0 && b.known)).toBe(true);
    }
    expect(buildCatalog([]).length).toBe(CATEGORY_ORDER.length);
  });

  it("megszámolja az ajánlatokat; a szótáron kívüli márka is bekerül, ABC-helyre", () => {
    const cat = buildCatalog(fixturePlaces());
    const beer = cat.find((c) => c.category === "beer")!;
    const brands = beer.brands.map((b) => b.label);
    expect([...brands].sort(compareHu)).toEqual(brands);
    expect(beer.brands.find((b) => b.label === "Arany Ászok")!.count).toBe(3);
    expect(beer.brands.find((b) => b.label === "Kozel")!.count).toBe(3);
    // a márka nélküli sörök (pl. „Házi IPA”) az Egyéb csoportba kerülnek
    expect(beer.otherCount).toBeGreaterThan(0);
    // a kategória darabszáma = a stílusok összege
    expect(beer.count).toBe(beer.styles.reduce((s, x) => s + x.count, 0));
  });

  it("azonos márka eltérő írásmóddal egy sorba kerül", () => {
    const mk = (brand: string): Drink => ({ id: brand, name: "Korsó", brand, style: "lager", volumeL: 0.5, price: 800 });
    const place: Place = {
      id: "x", name: "X", address: "", location: pos, vibes: [], happyHours: [],
      drinks: [mk("Kőbányai"), mk("kobanyai"), mk(" KŐBÁNYAI "), mk("Saját Sör")],
    };
    const beer = buildCatalog([place]).find((c) => c.category === "beer")!;
    expect(beer.brands.find((b) => b.label === "Kőbányai")!.count).toBe(3);
    const own = beer.brands.find((b) => b.label === "Saját Sör")!;
    expect(own).toMatchObject({ count: 1, known: false });
  });
});

describe("szűrés kategória / stílus / márka szerint", () => {
  const drink = (p: Partial<Drink>): Drink => ({ id: "d", name: "x", style: "lager", volumeL: 0.5, price: 800, ...p });
  it("matchesSelection", () => {
    const none = { category: null, styles: [], brand: null };
    expect(matchesSelection(drink({}), none)).toBe(true);
    expect(matchesSelection(drink({}), { ...none, category: "wine" })).toBe(false);
    expect(matchesSelection(drink({ brand: "Dreher" }), { ...none, category: "beer", brand: "dreher" })).toBe(true);
    expect(matchesSelection(drink({ brand: "Dreher" }), { ...none, brand: OTHER_BRAND })).toBe(false);
    expect(matchesSelection(drink({}), { ...none, brand: OTHER_BRAND })).toBe(true);
    expect(matchesSelection(drink({ style: "ipa" }), { ...none, category: "beer", styles: ["pilsner"] })).toBe(false);
  });

  it("a kereső a kategóriát, márkát és a meglévő szűrőket együtt alkalmazza", () => {
    const places = fixturePlaces();
    const kozel = searchDrinks(places, { ...DEFAULT_FILTER, category: "beer", brand: brandKey("Kozel"), maxDistanceM: undefined }, pos, fri(20));
    expect(kozel.length).toBe(3);
    expect(kozel.every((o) => o.drink.brand === "Kozel")).toBe(true);
    for (let i = 1; i < kozel.length; i++) expect(kozel[i].perL).toBeGreaterThanOrEqual(kozel[i - 1].perL);

    const cheapKozel = searchDrinks(places, { ...DEFAULT_FILTER, category: "beer", brand: brandKey("Kozel"), maxPrice: 800, maxDistanceM: undefined }, pos, fri(20));
    expect(cheapKozel.every((o) => o.price <= 800)).toBe(true);
    expect(cheapKozel.length).toBeLessThan(kozel.length);

    const wine = searchDrinks(places, { ...DEFAULT_FILTER, category: "wine", maxDistanceM: undefined }, pos, fri(20));
    expect(wine.length).toBeGreaterThan(0);
    expect(wine.every((o) => CATEGORY_OF[o.drink.style] === "wine")).toBe(true);
  });

  it("üres adatnál bármilyen választással üres listát ad, hiba nélkül", () => {
    for (const category of [null, ...CATEGORY_ORDER])
      expect(searchDrinks(realPlaces(), { ...DEFAULT_FILTER, category, brand: OTHER_BRAND }, pos, fri(20))).toEqual([]);
  });
});
