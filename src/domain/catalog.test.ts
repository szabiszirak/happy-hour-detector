import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  brandsIn,
  canonicalBrand,
  catalogGroups,
  catalogHint,
  compareHu,
  exportCatalog,
  findCatalogBrand,
  findMix,
  KNOWN_BRANDS,
  logoAllowed,
  popularBrands,
  searchCatalog,
  spritzerVolumeL,
  validateCatalog,
} from "./drinkCatalog";
import { CATALOG_GROUPS, CATALOG_MIXES, type CatalogBrand } from "./catalogData";
import { inferSubtype } from "./tasteProfile";
import type { Drink } from "./types";

const sortedHu = (xs: string[]) => [...xs].sort(compareHu);

describe("katalógus – integritás", () => {
  it("nincs hiba: ABC-sorrend csoportonként, egyedi nevek és álnevek", () => {
    expect(validateCatalog()).toEqual([]);
  });
  it("bőséges: legalább 200 márka és 30 kevert ital, minden kategóriában van márka", () => {
    expect(CATALOG_GROUPS.flatMap((g) => g.brands).length).toBeGreaterThanOrEqual(200);
    expect(CATALOG_MIXES.length).toBeGreaterThanOrEqual(30);
    for (const c of ["beer", "wine", "spirits", "cocktail", "soft"] as const) expect(KNOWN_BRANDS[c].length, c).toBeGreaterThan(0);
  });
  it("nem tartalmaz árat, happy hourt, szponzorációt, és egyik márkánál sincs logó", () => {
    const json = JSON.stringify(exportCatalog());
    expect(json).not.toMatch(/"(price|hhPrice|happyHours?|sponsored|logo)"/);
    expect(CATALOG_GROUPS.flatMap((g) => g.brands).some((b) => b.logo)).toBe(false);
  });
  it("a data/drink-catalog.json naprakész (npm run catalog:export)", () => {
    const onDisk = JSON.parse(readFileSync(new URL("../../data/drink-catalog.json", import.meta.url), "utf8"));
    expect(onDisk).toEqual(JSON.parse(JSON.stringify(exportCatalog())));
  });
});

describe("katalógus – rendezés és szűrés", () => {
  it("a kategória márkái magyar ABC-ben (Kozel < Kőbányai, Szent András a S-ek után)", () => {
    const beer = brandsIn("beer").map((b) => b.name);
    expect(beer).toEqual(sortedHu(beer));
    expect(beer.indexOf("Kozel")).toBeLessThan(beer.indexOf("Kőbányai"));
    expect(beer.indexOf("Stella Artois")).toBeLessThan(beer.indexOf("Szent András"));
    expect(beer).toContain("Somersby");
  });
  it("csoportok és csoporton belüli lista", () => {
    expect(catalogGroups("beer").map((g) => g.id)).toContain("beer-hu-craft");
    expect(brandsIn("beer", "beer-cz").map((b) => b.name)).toEqual([
      "Bernard", "Budweiser Budvar", "Gambrinus", "Kozel", "Krušovice", "Pilsner Urquell", "Radegast", "Staropramen",
    ]);
    expect(brandsIn("spirits", "spirits-gin").every((b) => b.origin === "import")).toBe(true);
  });
  it("a koktéloknál a szeszmárkák is szerepelnek; a népszerű gyorsválasztó rövid és rendezett", () => {
    expect(KNOWN_BRANDS.cocktail).toEqual(expect.arrayContaining(["Beefeater", "Bacardi", "Aperol", "Absolut"]));
    expect(KNOWN_BRANDS.cocktail).not.toContain("Soproni");
    const pop = popularBrands("beer");
    expect(pop.length).toBeGreaterThanOrEqual(10);
    expect(pop.length).toBeLessThanOrEqual(25);
    expect(pop).toEqual(sortedHu(pop));
    expect(pop).toEqual(expect.arrayContaining(["Dreher", "Soproni", "Kozel", "MONYO"]));
  });
});

describe("katalógus – keresés és felismerés", () => {
  it("álnevekből és ékezet nélkül is felismer", () => {
    expect(findCatalogBrand("urquell")?.brand.name).toBe("Pilsner Urquell");
    expect(findCatalogBrand("kobanyai")?.brand.name).toBe("Kőbányai");
    expect(findCatalogBrand("Jager")?.brand.name).toBe("Jägermeister");
    expect(findCatalogBrand("zwack unicum")?.brand.name).toBe("Unicum");
    expect(findCatalogBrand("Ismeretlen Sörfőzde")).toBeUndefined();
    expect(canonicalBrand("jack daniels")).toBe("Jack Daniel's");
  });
  it("keresés: előtag előbb, azon belül ABC; kategóriaszűrés; koktélok is", () => {
    const r = searchCatalog("bo");
    expect(r.slice(0, 3).map((x) => x.name)).toEqual(["Bock", "Bolyhos", "Bombay Sapphire"]);
    // előbb a „bo”-val kezdődők, utána a belsejükben „bo”-t tartalmazók
    expect(searchCatalog("bo", { category: "beer" }).map((x) => x.name)).toEqual(["Bors Sörmanufaktúra", "Borsodi", "Kronenbourg", "Strongbow", "Tuborg"]);
    expect(searchCatalog("balaton")[0]).toMatchObject({ name: "BB", matchedAlias: "Balatonboglári" });
    expect(searchCatalog("mojito")[0]).toEqual({ name: "Mojito", kind: "mix", category: "cocktail" });
    expect(searchCatalog("g&t", { category: "cocktail" })[0]?.name).toBe("Gin Tonic");
    expect(searchCatalog("")).toEqual([]);
    expect(searchCatalog("a", { limit: 5 })).toHaveLength(5);
  });
  it("fröccsök: arány és mennyiség", () => {
    expect(spritzerVolumeL("Nagyfröccs")).toBe(0.3);
    expect(spritzerVolumeL("kisfroccs")).toBe(0.2);
    expect(spritzerVolumeL("Házmester")).toBe(0.5);
    expect(spritzerVolumeL("Krúdy fröccs")).toBe(1);
    expect(spritzerVolumeL("Mojito")).toBeUndefined();
    expect(findMix("Sóher fröccs")?.wineDl).toBe(1);
  });
  it("szerkesztő-tipp: keverék → márka (névelőtagból is) → szőlőfajta", () => {
    expect(catalogHint("Nagyfröccs")).toEqual({ category: "wine", style: "spritzer", volumeL: 0.3 });
    expect(catalogHint("Mojito")).toEqual({ category: "cocktail", style: "longdrink", subtype: "mojito" });
    expect(catalogHint("Hoegaarden")).toEqual({ category: "beer", brand: "Hoegaarden", style: "wheat" });
    expect(catalogHint("Kozel Premium 0,5")).toMatchObject({ category: "beer", brand: "Kozel", style: "pilsner" });
    expect(catalogHint("Ital", "Tanqueray")).toMatchObject({ category: "spirits", subtype: "gin", style: "shot" });
    expect(catalogHint("Somersby alma")).toMatchObject({ category: "beer", style: "cider" });
    expect(catalogHint("Törley Charmant")).toMatchObject({ category: "wine", subtype: "sparkling" });
    expect(catalogHint("Pohár Kékfrankos")).toEqual({ category: "wine", style: "wine", subtype: "red" });
    expect(catalogHint("Házi limonádé")).toBeUndefined();
  });
  it("az alfajta-felismerés a katalógust is használja", () => {
    const d = (name: string, style: Drink["style"], brand?: string): Drink => ({ id: "x", name, style, volumeL: 0.04, price: 0, brand });
    expect(inferSubtype(d("Tanqueray 4 cl", "shot"))).toBe("gin");
    expect(inferSubtype(d("Feles", "shot", "Kraken"))).toBe("rum");
    expect(inferSubtype(d("Long Island", "longdrink"))).toBe("longdrink");
    expect(inferSubtype(d("Pohár pezsgő", "wine"))).toBe("sparkling");
  });
});

describe("logók", () => {
  const brand = (logo?: CatalogBrand["logo"]): CatalogBrand => ({ name: "Teszt", origin: "hu", logo });
  it("logó csak érvényes, írásos engedéllyel jelenhet meg", () => {
    const now = 1_800_000_000_000;
    expect(logoAllowed(brand(), now)).toBe(false);
    expect(logoAllowed(brand({ url: "x", licensor: "Sörgyár Kft.", grantedAt: now - 1, scope: "app" }), now)).toBe(true);
    expect(logoAllowed(brand({ url: "x", licensor: "Sörgyár Kft.", grantedAt: now - 10, expiresAt: now - 1, scope: "app" }), now)).toBe(false);
    expect(logoAllowed(brand({ url: "x", licensor: " ", grantedAt: now - 1, scope: "app" }), now)).toBe(false);
    expect(logoAllowed(brand({ url: "x", licensor: "Sörgyár Kft.", grantedAt: now + 1000, scope: "app" }), now)).toBe(false);
  });
});

describe("márkalista bontása a szűrőben", () => {
  it("felül az árazottak és a kiválasztott, alul a többi – kereséssel szűrhetően", async () => {
    const { splitBrandList, brandBadge, brandKey } = await import("./drinkCatalog");
    const e = (label: string, count: number) => ({ key: brandKey(label), label, count, known: true, badge: brandBadge(label) });
    const list = [e("Borsodi", 2), e("Kozel", 0), e("Kőbányai", 0), e("Soproni", 1)];
    const r = splitBrandList(list, "kozel");
    expect(r.shown.map((b) => b.label)).toEqual(["Borsodi", "Kozel", "Soproni"]);
    expect(r.more.map((b) => b.label)).toEqual(["Kőbányai"]);
    expect(r.moreTotal).toBe(1);
    expect(splitBrandList(list, null, "kö").more.map((b) => b.label)).toEqual(["Kozel", "Kőbányai"]);
    expect(splitBrandList(list, null).moreTotal).toBe(2);
  });
});

describe("szerkesztő-tipp alkalmazása", () => {
  it("csak a besorolást módosítja, árat nem; ha minden stimmel, nincs javaslat", async () => {
    const { hintPatch, catalogHint } = await import("./drinkCatalog");
    const d = (p: Partial<Drink>): Drink => ({ id: "x", name: "Ital", style: "lager", volumeL: 0.5, price: 990, ...p });
    expect(hintPatch(d({ name: "Hoegaarden" }), catalogHint("Hoegaarden"))).toEqual({ style: "wheat", brand: "Hoegaarden" });
    expect(hintPatch(d({ name: "Nagyfröccs", style: "lager", volumeL: 0.5 }), catalogHint("Nagyfröccs"))).toEqual({ style: "spritzer", volumeL: 0.3 });
    expect(hintPatch(d({ name: "Mojito", style: "longdrink", subtype: "mojito", volumeL: 0.3 }), catalogHint("Mojito"))).toBeNull();
    expect(hintPatch(d({ name: "Tanqueray", style: "shot", volumeL: 0.04 }), catalogHint("Tanqueray"))).toEqual({ subtype: "gin", brand: "Tanqueray" });
    expect(hintPatch(d({}), undefined)).toBeNull();
    const p = hintPatch(d({ name: "Hoegaarden" }), catalogHint("Hoegaarden"));
    expect(p && "price" in p).toBe(false);
  });
});
