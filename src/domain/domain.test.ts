import { describe, expect, it } from "vitest";
import { isInsidePolygon, MVP_POLYGON, distanceM } from "./geo";
import { happyHourStatus, slotMinutesLeft } from "./happyHour";
import { cheapestBeer, currentPrice, pricePerLiter } from "./pricing";
import { applyVote, extractPrice, reportStatus } from "./reports";
import { activeSponsored, DEFAULT_FILTER, searchDrinks } from "./search";
import { matchScore } from "./match";
import { seedPlaces } from "./fixtures";
import type { Place, Report } from "./types";

// 2026-11-20 péntek
const fri = (h: number, m = 0) => new Date(2026, 10, 20, h, m);
const sat = (h: number, m = 0) => new Date(2026, 10, 21, h, m);

describe("geo", () => {
  it("minden demó hely az MVP-négyszögön belül van", () => {
    for (const p of seedPlaces()) expect(isInsidePolygon(p.location, MVP_POLYGON), p.name).toBe(true);
  });
  it("a Margit-sziget nincs benne", () => {
    expect(isInsidePolygon({ lat: 47.527, lng: 19.047 }, MVP_POLYGON)).toBe(false);
  });
  it("Kálvin tér – Boráros tér kb. 1 km", () => {
    const d = distanceM(MVP_POLYGON[1], MVP_POLYGON[3]);
    expect(d).toBeGreaterThan(800);
    expect(d).toBeLessThan(1200);
  });
});

describe("happy hour", () => {
  const slot = { id: "x", days: [5], start: "22:00", end: "00:30", note: "" };
  it("éjfélen átnyúló sáv: péntek 23:00-kor aktív, 90 perc van hátra", () => {
    expect(slotMinutesLeft(slot, fri(23))).toBe(90);
  });
  it("éjfélen átnyúló sáv: szombat 00:15-kor még a pénteki sáv aktív", () => {
    expect(slotMinutesLeft(slot, sat(0, 15))).toBe(15);
  });
  it("szombat 23:00-kor nem aktív (csak péntek)", () => {
    expect(slotMinutesLeft(slot, sat(23))).toBeNull();
  });
  it("hamarosan induló jelzés 3 órán belül", () => {
    const p = seedPlaces().find((x) => x.id === "p1")!; // H–P 16–18
    expect(happyHourStatus(p, fri(14)).kind).toBe("upcoming");
    expect(happyHourStatus(p, fri(16, 30))).toMatchObject({ kind: "active", minutesLeft: 90 });
    expect(happyHourStatus(p, fri(19)).kind).toBe("none");
  });
});

describe("árak", () => {
  const places = seedPlaces();
  const p1 = places.find((p) => p.id === "p1")!;
  it("happy hour alatt a kedvezményes ár él", () => {
    const aa = p1.drinks[0];
    expect(currentPrice(aa, p1, fri(17))).toEqual({ price: 690, isHH: true });
    expect(currentPrice(aa, p1, fri(20))).toEqual({ price: 890, isHH: false });
  });
  it("Ft/liter: 0,3 l 690 Ft drágább literre, mint 0,5 l 990 Ft", () => {
    expect(pricePerLiter(690, 0.3)).toBe(2300);
    expect(pricePerLiter(990, 0.5)).toBe(1980);
  });
  it("legolcsóbb sör literárral", () => {
    expect(cheapestBeer(p1, fri(17))?.perL).toBe(1380);
  });
});

describe("kereső", () => {
  const places = seedPlaces();
  const pos = MVP_POLYGON[1];
  it("pilsner, legolcsóbb elöl, 2 km-en belül", () => {
    const res = searchDrinks(places, { ...DEFAULT_FILTER, styles: ["pilsner"] }, pos, fri(20));
    expect(res.length).toBeGreaterThan(0);
    expect(res.every((r) => r.drink.style === "pilsner")).toBe(true);
    for (let i = 1; i < res.length; i++) expect(res[i].perL).toBeGreaterThanOrEqual(res[i - 1].perL);
  });
  it("márkára ékezet nélkül is talál", () => {
    const res = searchDrinks(places, { ...DEFAULT_FILTER, brandQuery: "arany aszok" }, pos, fri(20));
    expect(res.length).toBe(3);
  });
  it("a szponzoráció nem változtat a sorrenden", () => {
    const base = searchDrinks(places, DEFAULT_FILTER, pos, fri(20)).map((r) => `${r.place.id}/${r.drink.id}`);
    const unsponsored: Place[] = places.map((p) => ({ ...p, sponsored: undefined }));
    const other = searchDrinks(unsponsored, DEFAULT_FILTER, pos, fri(20)).map((r) => `${r.place.id}/${r.drink.id}`);
    expect(base).toEqual(other);
    expect(activeSponsored(places, fri(20)).map((p) => p.id)).toEqual(["p3"]);
  });
  it("maximum ár szűrő a mostani (HH) árra vonatkozik", () => {
    const res = searchDrinks(places, { ...DEFAULT_FILTER, maxPrice: 700, maxDistanceM: undefined }, pos, fri(17));
    expect(res.every((r) => r.price <= 700)).toBe(true);
    expect(res.some((r) => r.isHH)).toBe(true);
  });
});

describe("bejelentések", () => {
  const now = Date.now();
  const r: Report = {
    id: "r", placeId: "p1", userId: "u", userName: "U", text: "", createdAt: now, expiresAt: now + 1000,
    confirms: [], denies: [],
  };
  it("lejárat", () => expect(reportStatus(r, now + 2000)).toBe("expired"));
  it("két megerősítés után „Megerősítve”", () => {
    const v = applyVote(applyVote(r, "a", "confirm"), "b", "confirm");
    expect(reportStatus(v, now)).toBe("confirmed");
  });
  it("egy felhasználó csak egyszer szavaz, és átszavazhat", () => {
    const v = applyVote(applyVote(r, "a", "confirm"), "a", "deny");
    expect(v.confirms).toEqual([]);
    expect(v.denies).toEqual(["a"]);
  });
  it("ár kiolvasása a szövegből", () => {
    expect(extractPrice("gyertek ide, ma csak 700 forint az arany ászok")).toBe(700);
    expect(extractPrice("tele van")).toBeUndefined();
  });
});

describe("MatchScore", () => {
  const places = seedPlaces();
  it("olcsó sörös profilnak a söröző jobban passzol, mint a koktélbár", () => {
    const profile = { categories: ["lightbeer" as const], priceBand: "budget" as const, completedAt: 0 };
    const soror = matchScore(places.find((p) => p.id === "p5")!, profile, fri(20));
    const bar = matchScore(places.find((p) => p.id === "p8")!, profile, fri(20));
    expect(soror).toBeGreaterThan(bar);
    expect(soror).toBe(100);
  });
});

import { formatOpeningHours, openState, parseOpeningHours } from "./openingHours";
import { seedPlaces as realPlaces } from "../data/seed";

describe("nyitvatartás (OSM opening_hours)", () => {
  // 2026-11-20 péntek, 2026-11-21 szombat
  it("egyszerű hétköznapi sáv", () => {
    expect(openState("Mo-Fr 16:00-24:00", fri(17))).toMatchObject({ kind: "open", closesAt: "00:00" });
    expect(openState("Mo-Fr 16:00-24:00", fri(10))).toMatchObject({ kind: "closed", opensAt: "16:00", opensToday: true });
    expect(openState("Mo-Fr 16:00-24:00", sat(12))).toMatchObject({ kind: "closed", opensToday: false });
  });
  it("éjfélen átnyúló sáv a következő napra is érvényes", () => {
    expect(openState("Mo-Th 16:00-01:00, Fr,Sa 16:00-02:00, Su 16:00-24:00", sat(1, 30))).toMatchObject({ kind: "open", closesAt: "02:00" });
    expect(openState("Su-Tu 14:00-00:00; We-Sa 14:00-02:00", fri(23))).toMatchObject({ kind: "open", closesAt: "02:00" });
  });
  it("éjfélkor folytatódó sávok összefűzése (P 16–24 + Szo 00–02)", () => {
    const s = "Mo-Fr 16:00-24:00; Sa 00:00-02:00,16:00-24:00; Su 00:00-02:00";
    expect(openState(s, fri(23, 30))).toMatchObject({ kind: "open", closesAt: "02:00" });
    expect(openState(s, sat(1))).toMatchObject({ kind: "open", closesAt: "02:00" });
    expect(openState(s, sat(3))).toMatchObject({ kind: "closed", opensAt: "16:00" });
  });
  it("napmegjelölés nélkül minden nap; 24/7; ismeretlen", () => {
    expect(openState("14:00-24:00", sat(15)).kind).toBe("open");
    expect(openState("24/7", sat(4)).kind).toBe("open");
    expect(openState(undefined, sat(4)).kind).toBe("unknown");
    expect(openState("by appointment", sat(4)).kind).toBe("unknown");
  });
  it("a későbbi szabály felülírja a korábbit, PH off kimarad", () => {
    expect(parseOpeningHours("Mo-Su 11:00-23:00; Fr,Sa 11:00-24:00; PH off")![4]).toEqual([[660, 1440]]);
  });
  it("magyar megjelenítés", () => {
    expect(formatOpeningHours("Mo-Fr 16:00-24:00; Sa 17:00-02:00")).toBe("H–P 16:00–24:00 · Szo 17:00–02:00");
  });
  it("a valódi helyek összes nyitvatartása értelmezhető", () => {
    for (const p of realPlaces()) {
      if (!p.info?.openingHours) continue;
      expect(parseOpeningHours(p.info.openingHours), `${p.name}: ${p.info.openingHours}`).not.toBeNull();
    }
  });
});

describe("valódi helyek", () => {
  it("33 hely, mind az MVP-négyszögben, árak és HH nélkül", () => {
    const ps = realPlaces();
    expect(ps.length).toBe(33);
    for (const p of ps) {
      expect(isInsidePolygon(p.location, MVP_POLYGON), p.name).toBe(true);
      expect(p.drinks).toEqual([]);
      expect(p.sponsored).toBeUndefined();
    }
  });
});

import { classifyError, classifyFix } from "./location";

describe("helymeghatározás", () => {
  it("a környéken (Ráday utca) követjük a valódi helyet", () => {
    expect(classifyFix({ lat: 47.4867, lng: 19.0636 }, 20)).toEqual({ usePosition: true, status: { kind: "tracking", accuracy: 20 } });
  });
  it("messziről (Óbuda) nem használjuk, hanem jelezzük", () => {
    const r = classifyFix({ lat: 47.541, lng: 19.035 }, 30);
    expect(r.usePosition).toBe(false);
    expect(r.status.kind).toBe("faraway");
  });
  it("letiltás vs. egyéb hiba", () => {
    expect(classifyError(1).kind).toBe("denied");
    expect(classifyError(2).kind).toBe("unavailable");
    expect(classifyError(3).kind).toBe("unavailable");
  });
});
