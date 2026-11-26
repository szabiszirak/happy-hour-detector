import { describe, expect, it } from "vitest";
import { buildReview, canReview, formatRating, publicName, reviewId, reviewsFor, summarizeReviews, validateReviewDraft, type Review } from "./reviews";
import { googleMapsUrl } from "./links";

const user = { uid: "u1", displayName: "Szabolcs Szirák" };
const NOW = 1_800_000_000_000;
const rev = (uid: string, rating: Review["rating"], createdAt: number, placeId = "p1", updatedAt?: number): Review => ({
  id: reviewId(placeId, uid), placeId, uid, userName: uid, rating, text: "", createdAt, ...(updatedAt ? { updatedAt } : {}),
});

describe("nyilvános név", () => {
  it("keresztnév + vezetéknév kezdőbetűje", () => {
    expect(publicName("Szabolcs Szirák")).toBe("Szabolcs S.");
    expect(publicName("Kati")).toBe("Kati");
    expect(publicName("Dr. Nagy Béla Ödön")).toBe("Nagy Ö.");
    expect(publicName("  ")).toBe("Névtelen");
  });
});

describe("értékelés beküldése", () => {
  it("1–5 egész csillag, max. 500 karakter, link nélkül", () => {
    expect(validateReviewDraft({ rating: 4, text: "Jó sörök, kedves pultos." })).toEqual({});
    expect(validateReviewDraft({ rating: 0, text: "" }).rating).toBeDefined();
    expect(validateReviewDraft({ rating: 4.5, text: "" }).rating).toBeDefined();
    expect(validateReviewDraft({ rating: 5, text: "x".repeat(501) }).text).toMatch(/500/);
    expect(validateReviewDraft({ rating: 5, text: "nézd meg: www.akcio.hu" }).text).toMatch(/Linket/);
    expect(validateReviewDraft({ rating: 5, text: "szuper hely https://x.com" }).text).toMatch(/Linket/);
    expect(validateReviewDraft({ rating: 3, text: "" })).toEqual({});
  });
  it("egy felhasználó – egy értékelés helyenként; módosításkor a létrehozás ideje megmarad", () => {
    const r = buildReview({ rating: 5, text: "  Szuper!  " }, user, "p1", NOW);
    expect(r).toEqual({ id: "p1__u1", placeId: "p1", uid: "u1", userName: "Szabolcs S.", rating: 5, text: "Szuper!", createdAt: NOW });
    const r2 = buildReview({ rating: 3, text: "Romlott a hely." }, user, "p1", NOW + 10, r);
    expect(r2).toMatchObject({ id: "p1__u1", rating: 3, createdAt: NOW, updatedAt: NOW + 10 });
    expect(() => buildReview({ rating: 9, text: "" }, user, "p1", NOW)).toThrow();
  });
  it("a hely kocsmárosa a saját helyét nem értékelheti", () => {
    const owners = { p1: { placeId: "p1", uid: "u1", claimId: "c", businessName: "X", verifiedAt: 1 } };
    expect(canReview("u1", "p1", owners).ok).toBe(false);
    expect(canReview("u2", "p1", owners).ok).toBe(true);
    expect(canReview("u1", "p2", owners).ok).toBe(true);
  });
});

describe("összesítés és sorrend", () => {
  it("átlag egy tizedesre, eloszlás csillagonként", () => {
    expect(summarizeReviews([])).toEqual({ count: 0, average: 0, distribution: [0, 0, 0, 0, 0] });
    expect(summarizeReviews([rev("a", 5, 1), rev("b", 4, 2), rev("c", 5, 3)])).toEqual({ count: 3, average: 4.7, distribution: [0, 0, 0, 1, 2] });
    expect(formatRating(4.67)).toBe("4,7");
  });
  it("csak az adott hely; a saját elöl, utána a legfrissebb", () => {
    const all = [rev("a", 5, 10), rev("b", 4, 30), rev("me", 2, 5), rev("c", 3, 20, "p1", 40), rev("x", 1, 99, "p2")];
    expect(reviewsFor(all, "p1", "me").map((r) => r.uid)).toEqual(["me", "c", "b", "a"]);
    expect(reviewsFor(all, "p1").map((r) => r.uid)).toEqual(["c", "b", "a", "me"]);
  });
});

describe("Google Térkép link (csak saját adatból / place_id-ből)", () => {
  const base = { name: "Berliner Pub", address: "1092 Budapest, Ráday utca 5", location: { lat: 47.48, lng: 19.06 } };
  it("place_id-vel pontos, nélküle név + cím", () => {
    expect(googleMapsUrl({ ...base, googlePlaceId: "ChIJabc" })).toBe(
      "https://www.google.com/maps/search/?api=1&query=Berliner%20Pub&query_place_id=ChIJabc",
    );
    expect(googleMapsUrl(base)).toBe(
      "https://www.google.com/maps/search/?api=1&query=Berliner%20Pub%2C%201092%20Budapest%2C%20R%C3%A1day%20utca%205",
    );
    expect(googleMapsUrl({ ...base, address: "" })).toBe("https://www.google.com/maps/search/?api=1&query=47.48%2C19.06");
  });
});
