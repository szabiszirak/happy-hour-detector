import { describe, expect, it } from "vitest";
import { iconFromName, parseIconOverrides, PLACE_ICON_IDS, PLACE_ICON_LABELS, resolvePlaceIcon } from "./placeIcon";
import { seedPlaces } from "../data/seed";
import { PLACE_ICON_OVERRIDES } from "../data/placeIcons";
import type { Place } from "./types";

const place = (name: string, info: Place["info"] = {}, id = "p1") => ({ id, name, info });

describe("ikon a névből", () => {
  it("egyértelmű kulcsszavak, ékezet- és kisbetű-függetlenül, magyar összetett szavakban is", () => {
    expect(iconFromName("Hanrah Live Music Club")).toBe("music");
    expect(iconFromName("Opus Jazz Club")).toBe("music");
    expect(iconFromName("Black Pool Darts & Biliárd")).toBe("games");
    expect(iconFromName("BarCraft Esport Bár")).toBe("games");
    expect(iconFromName("Board Game Cafe")).toBe("games");
    expect(iconFromName("Púder Bárszínház")).toBe("culture");
    expect(iconFromName("Inga Kultúrkávézó")).toBe("culture");
    expect(iconFromName("Blue Lagoon Tiki Bar")).toBe("cocktail");
    expect(iconFromName("Club C Cocktail Bar")).toBe("cocktail");
    expect(iconFromName("MONYO Tap House")).toBe("craft");
    expect(iconFromName("Szimpla Kert")).toBe("garden");
    expect(iconFromName("Grafika SÖRÖZŐ")).toBe("pub");
    expect(iconFromName("Csapszék")).toBe("pub");
    expect(iconFromName("Jolly presszó")).toBe("pub");
    expect(iconFromName("Kis Borozó")).toBe("wine");
  });
  it("a rövid angol szavak csak egész szóként illenek; semleges névre nincs találat", () => {
    expect(iconFromName("Republic")).toBeUndefined();
    expect(iconFromName("Clubhouse Pizza")).toBeUndefined();
    expect(iconFromName("Café Mézes söröző")).toBe("pub");
    expect(iconFromName("Gravity")).toBeUndefined();
  });
});

describe("feloldási sorrend és fallback", () => {
  it("kézi (szerkesztő) > gondozott felülírás > név > OSM-típus > alapikon", () => {
    expect(resolvePlaceIcon(place("Berliner Pub", { kind: "bar", icon: "cocktail" }), { p1: "wine" })).toMatchObject({ id: "cocktail", source: "override" });
    expect(resolvePlaceIcon(place("Berliner Pub", { kind: "bar" }), { p1: "wine" })).toMatchObject({ id: "wine", source: "override" });
    expect(resolvePlaceIcon(place("Berliner Pub", { kind: "bar" }))).toMatchObject({ id: "pub", source: "name" });
    expect(resolvePlaceIcon(place("Paris, Texas", { kind: "bar" }))).toMatchObject({ id: "bar", source: "tag", label: "Bár" });
    expect(resolvePlaceIcon(place("Bar Oriental", { kind: "restaurant" }))).toMatchObject({ id: "restaurant", source: "tag" });
    expect(resolvePlaceIcon(place("Valami", { kind: "ismeretlen" }))).toMatchObject({ id: "generic", source: "fallback", uncertain: true });
    expect(resolvePlaceIcon(place("Valami"))).toMatchObject({ id: "generic", source: "fallback" });
  });
  it("ellenőrizendő helynél bizonytalan, kivéve ha kézzel be van állítva", () => {
    expect(resolvePlaceIcon(place("Jaffa", { kind: "bar", checkNeeded: true }))).toMatchObject({ id: "bar", uncertain: true });
    expect(resolvePlaceIcon(place("Jaffa", { kind: "bar", checkNeeded: true, icon: "cocktail" }))).toMatchObject({ id: "cocktail", uncertain: false });
    expect(resolvePlaceIcon(place("Jaffa", { kind: "bar" })).uncertain).toBe(false);
  });
  it("érvénytelen kézi érték nem töri el (régi / sérült adat)", () => {
    const bad = { kind: "pub", icon: "unicorn" } as unknown as Place["info"];
    expect(resolvePlaceIcon(place("X", bad))).toMatchObject({ id: "pub", source: "tag" });
  });
  it("felülírás-fájl beolvasása: megjegyzés és ismeretlen ikon kiszűrve", () => {
    expect(parseIconOverrides({ _comment: "x", a: "pub", b: "unicorn", c: 3 })).toEqual({ a: "pub" });
    expect(parseIconOverrides(null)).toEqual({});
    expect(Object.values(PLACE_ICON_OVERRIDES).every((v) => PLACE_ICON_IDS.includes(v))).toBe(true);
  });
  it("minden ikonnak van magyar címkéje", () => {
    for (const id of PLACE_ICON_IDS) expect(PLACE_ICON_LABELS[id].length).toBeGreaterThan(2);
  });
});

describe("valódi helyek (seed)", () => {
  const places = seedPlaces();
  const icons = places.map((p) => ({ p, r: resolvePlaceIcon(p, PLACE_ICON_OVERRIDES) }));
  it("minden helynek érvényes ikonja van, alapikon nélkül", () => {
    expect(icons.every(({ r }) => PLACE_ICON_IDS.includes(r.id))).toBe(true);
    expect(icons.filter(({ r }) => r.id === "generic")).toEqual([]);
  });
  it("az ellenőrizendő helyek bizonytalannak jelöltek, a többi nem", () => {
    for (const { p, r } of icons) expect(r.uncertain, p.name).toBe(!!p.info?.checkNeeded);
  });
  it("jellemző hozzárendelések", () => {
    const of = (name: string) => icons.find(({ p }) => p.name === name)?.r.id;
    expect(of("MONYO Tap House")).toBe("craft");
    expect(of("Hanrah Live Music Club")).toBe("music");
    expect(of("Black Pool Darts & Biliárd")).toBe("games");
    expect(of("Grafika Söröző")).toBe("pub");
    expect(of("Csapszék")).toBe("pub");
    expect(of("Albert Bar")).toBe("bar");
  });
});
