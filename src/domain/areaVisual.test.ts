import { describe, expect, it } from "vitest";
import { DEFAULT_RADIUS_M, inRadius, MAX_RADIUS_M, MIN_RADIUS_M, radiusToInclude, RADIUS_STEPS, snapRadius, splitByRadius, stepRadius } from "./searchArea";
import { filterForList, groupLook, markerVisual } from "./mapVisual";
import { DEFAULT_POSITION, distanceM } from "./geo";
import { classifyFix } from "./location";
import { seedPlaces as realPlaces } from "../data/seed";
import type { Place } from "./types";

const fri = (h: number, m = 0) => new Date(2026, 10, 20, h, m); // péntek
const sat = (h: number, m = 0) => new Date(2026, 10, 21, h, m); // szombat
const center = DEFAULT_POSITION;
const at = (name: string) => realPlaces().find((p) => p.name === name)!;

describe("sugár", () => {
  it("lépcsők: alap 1 km, 250 m – 3 km, léptetés a széleken megáll", () => {
    expect(DEFAULT_RADIUS_M).toBe(1000);
    expect([MIN_RADIUS_M, MAX_RADIUS_M]).toEqual([250, 3000]);
    expect(stepRadius(1000, 1)).toBe(1500);
    expect(stepRadius(250, -1)).toBe(250);
    expect(stepRadius(3000, 1)).toBe(3000);
    expect(snapRadius(1100)).toBe(1000);
    expect(snapRadius(NaN)).toBe(1000);
    expect([...RADIUS_STEPS]).toEqual([...RADIUS_STEPS].sort((a, b) => a - b));
  });
  it("a kör szélén lévő hely még belül van", () => {
    const p = { location: { lat: center.lat + 0.004, lng: center.lng } };
    const d = distanceM(center, p.location);
    expect(inRadius(p, center, d)).toBe(true);
    expect(inRadius(p, center, d - 1)).toBe(false);
  });
  it("szétválogatás és a bevételhez szükséges sugár", () => {
    const ps = realPlaces();
    const { inside, outside } = splitByRadius(ps, center, 250);
    expect(inside.length + outside.length).toBe(ps.length);
    expect(inside.length).toBeGreaterThan(0);
    expect(outside.length).toBeGreaterThan(0);
    const far = outside[0];
    const r = radiusToInclude(far, center)!;
    expect(inRadius(far, center, r)).toBe(true);
    expect(radiusToInclude({ location: { lat: 47.6, lng: 19.2 } }, center)).toBeNull();
  });
  it("3 km-nél messzebbről a referenciapont a Kálvin tér marad (a helyzet nem használható)", () => {
    expect(classifyFix({ lat: 47.541, lng: 19.035 }, 20).usePosition).toBe(false);
  });
});

describe("térképes megjelenés és lista", () => {
  const base = { center, radiusM: 3000, openOnly: false, now: fri(20) };

  it("körön kívül: halvány, és nem kerül a listába", () => {
    const v = markerVisual(at("Orfeusz Söröző"), { ...base, radiusM: 250 });
    expect(v.look).toBe("dimmed");
    expect(v.matches).toBe(false);
  });

  it("„csak nyitva” ki: a szokásos megjelenés, minden körön belüli hely a listában", () => {
    const v = markerVisual(at("Csapszék"), base);
    expect(v.look).toBe("normal");
    expect(v.matches).toBe(true);
  });

  it("„csak nyitva” be: a nyitva lévő türkiz gyűrűt kap, a zárva lévő halvány szürke", () => {
    // Csapszék: H–Szo 16–24 → péntek 20:00 nyitva, péntek 10:00 zárva
    expect(markerVisual(at("Csapszék"), { ...base, openOnly: true }).look).toBe("open-ring");
    const closed = markerVisual(at("Csapszék"), { ...base, openOnly: true, now: fri(10) });
    expect(closed.look).toBe("muted");
    expect(closed.matches).toBe(false);
  });

  it("ismeretlen nyitvatartás „csak nyitva” mellett: nem felel meg", () => {
    const v = markerVisual(at("Harat's Pub"), { ...base, openOnly: true });
    expect(v.open.kind).toBe("unknown");
    expect(v.look).toBe("muted");
  });

  it("beállított időpont éjfél után: a pénteki sáv szombat 01:30-kor még nyitva (Paris, Texas 03:00-ig)", () => {
    expect(markerVisual(at("Paris, Texas"), { ...base, openOnly: true, now: sat(1, 30) }).look).toBe("open-ring");
    expect(markerVisual(at("Paris, Texas"), { ...base, openOnly: true, now: sat(4) }).look).toBe("muted");
  });

  it("a fül kiemelése (pl. Happy Hour fül) a körön belül halványít, a körön kívülit nem írja felül", () => {
    const hl = new Set<string>(["nincs-ilyen"]);
    expect(markerVisual(at("Csapszék"), { ...base, highlightIds: hl }).look).toBe("muted");
    expect(markerVisual(at("Orfeusz Söröző"), { ...base, radiusM: 250, highlightIds: hl }).look).toBe("dimmed");
  });

  it("lista: körön belüli + nyitva; a körön kívüli, egyébként megfelelő helyek száma", () => {
    const ps: Place[] = realPlaces();
    const all = filterForList(ps, base);
    expect(all.shown.length).toBe(ps.length);
    expect(all.outsideCount).toBe(0);
    const small = filterForList(ps, { ...base, radiusM: 250 });
    expect(small.shown.length + small.outsideCount).toBe(ps.length);
    const openSmall = filterForList(ps, { ...base, radiusM: 250, openOnly: true });
    expect(openSmall.shown.every((p) => markerVisual(p, { ...base, openOnly: true }).open.kind === "open")).toBe(true);
    expect(openSmall.shown.length).toBeLessThanOrEqual(small.shown.length);
  });

  it("csoport megjelenése: a legjobb tag számít", () => {
    const mk = (look: "normal" | "open-ring" | "muted" | "dimmed") => ({ look, state: "closed" as const, inRadius: true, open: { kind: "unknown" as const }, matches: true });
    expect(groupLook([mk("dimmed"), mk("muted")])).toBe("muted");
    expect(groupLook([mk("muted"), mk("open-ring")])).toBe("open-ring");
    expect(groupLook([mk("dimmed")])).toBe("dimmed");
  });
});
