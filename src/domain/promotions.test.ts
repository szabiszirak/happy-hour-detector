import { describe, expect, it } from "vitest";
import type { Drink, Place } from "./types";
import {
  buildPromotionRequest,
  decidePromotion,
  isPromotionLive,
  livePromotionIndex,
  orderPlaceMenu,
  promotionStateLabel,
  rankDrinkOffers,
  type DrinkPromotion,
} from "./pricing";

const NOW = 1_800_000_000_000;
const DAY = 86400000;
const admin = { uid: "admin", isAdmin: true };
const drink = (id: string, price = 900): Drink => ({ id, name: `Ital ${id}`, style: "lager", volumeL: 0.5, price });
const place = (id: string, drinks: Drink[]): Place => ({ id, name: id, address: "", location: { lat: 47.48, lng: 19.06 }, vibes: [], drinks, happyHours: [] });
const p1 = place("p1", [drink("a"), drink("b"), drink("c"), drink("d")]);
const p2 = place("p2", [drink("x")]);
const owners = { p1: { uid: "owner1" }, p2: { uid: "owner2" } };

const req = (drinkId: string, existing: DrinkPromotion[] = [], extra = {}) =>
  buildPromotionRequest({ placeId: "p1", drinkId, tagline: "Hideg, csapolt", days: 7, startsAt: NOW, ...extra }, p1, true, "owner1", existing, `pr-${drinkId}`, NOW);
const activate = (p: DrinkPromotion) => decidePromotion(p, "activate", admin, NOW);

describe("kiemelés kérése", () => {
  it("csak ellenőrzött kocsmáros kérheti, mindig jóváhagyásra váró állapotban", () => {
    const r = req("a");
    expect(r.status).toBe("requested");
    expect(r.until).toBe(NOW + 7 * DAY);
    expect(r.activatedBy).toBeUndefined();
    expect(() => buildPromotionRequest({ placeId: "p1", drinkId: "a", tagline: "", days: 7, startsAt: NOW }, p1, false, "u", [], "x", NOW)).toThrow(/kocsmáros/);
  });
  it("korlátok: létező ital, futamidő, szöveghossz, múltbeli kezdés, duplikáció, helyenként max 3", () => {
    expect(() => req("zz")).toThrow(/itallapján/);
    expect(() => req("a", [], { days: 0 })).toThrow(/futamidő/);
    expect(() => req("a", [], { days: 31 })).toThrow(/futamidő/);
    expect(() => req("a", [], { tagline: "x".repeat(61) })).toThrow(/60/);
    expect(() => req("a", [], { startsAt: NOW - DAY })).toThrow(/múltban/);
    expect(() => req("a", [req("a")])).toThrow(/már van/);
    expect(() => req("d", [req("a"), req("b"), req("c")])).toThrow(/legfeljebb 3/);
    const ended = { ...activate(req("a")), until: NOW - 1 };
    expect(req("a", [ended]).status).toBe("requested");
  });
});

describe("aktiválás és élő állapot", () => {
  it("csak admin aktiválhat, egyszer", () => {
    expect(() => decidePromotion(req("a"), "activate", { uid: "owner1", isAdmin: false }, NOW)).toThrow(/admin/);
    const a = activate(req("a"));
    expect(a.status).toBe("active");
    expect(a.activatedBy).toBe("admin");
    expect(() => activate(a)).toThrow(/bírálva/);
    expect(decidePromotion(req("b"), "reject", admin, NOW, "nem megfelelő szöveg").status).toBe("rejected");
  });
  it("kliensoldalon hamisított aktív státusz (admin nélkül) nem élő", () => {
    const forged: DrinkPromotion = { ...req("a"), status: "active" };
    expect(isPromotionLive(forged, p1, "owner1", NOW + 1)).toBe(false);
  });
  it("élő csak időn belül, ha a kérő a hely kocsmárosa és az ital megvan", () => {
    const a = activate(req("a"));
    expect(isPromotionLive(a, p1, "owner1", NOW + DAY)).toBe(true);
    expect(isPromotionLive(a, p1, "owner1", NOW + 8 * DAY)).toBe(false);
    expect(isPromotionLive(a, p1, "valaki", NOW + DAY)).toBe(false);
    expect(isPromotionLive(a, place("p1", [drink("b")]), "owner1", NOW + DAY)).toBe(false);
    expect(promotionStateLabel(a, NOW + 8 * DAY)).toBe("Lejárt");
    expect(promotionStateLabel(req("b"), NOW)).toBe("Jóváhagyásra vár");
  });
});

describe("megjelenítés: szponzorált blokk, organikus sorrend változatlan", () => {
  const offer = (pl: Place, id: string) => ({ place: pl, drink: pl.drinks.find((d) => d.id === id)! });
  const organic = [offer(p1, "b"), offer(p2, "x"), offer(p1, "a"), offer(p1, "c")];
  const promos = [activate(req("a")), activate(req("c")), activate(buildPromotionRequest({ placeId: "p2", drinkId: "x", tagline: "", days: 3, startsAt: NOW }, p2, true, "owner2", [], "px", NOW))];
  const live = livePromotionIndex(promos, [p1, p2], owners, NOW + 1);

  it("az organikus lista pontosan ugyanaz, mint kiemelés nélkül", () => {
    const r = rankDrinkOffers(organic, live);
    expect(r.organic).toBe(organic);
    expect(r.organic.map((o) => o.drink.id)).toEqual(["b", "x", "a", "c"]);
    expect(rankDrinkOffers(organic, new Map()).sponsored).toEqual([]);
  });
  it("legfeljebb 2 kiemelt, helyenként 1, az organikus sorrend szerint, csak a szűrésnek megfelelőkből", () => {
    const r = rankDrinkOffers(organic, live);
    expect(r.sponsored.map((o) => `${o.place.id}/${o.drink.id}`)).toEqual(["p2/x", "p1/a"]);
    expect(r.sponsored.every((o) => o.promo.status === "active")).toBe(true);
    const filtered = organic.filter((o) => o.drink.id === "b");
    expect(rankDrinkOffers(filtered, live).sponsored).toEqual([]);
  });
  it("a hely itallapján a kiemeltek felül, a többi eredeti sorrendben", () => {
    expect(orderPlaceMenu(p1, live).map((r) => `${r.drink.id}${r.promo ? "*" : ""}`)).toEqual(["a*", "c*", "b", "d"]);
  });
});
