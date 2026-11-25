import { describe, expect, it } from "vitest";
import type { AppUser, Drink, Place } from "./types";
import {
  addConfirmation,
  buildClaim,
  canSubmitClaim,
  checkPlaceEdit,
  documentsExpired,
  drinkConfirmation,
  EMPTY_DRAFT,
  isVerifiedOwner,
  ownerOnlyChanges,
  reviewClaim,
  validateClaimDraft,
  validateUpload,
  withdrawClaim,
  type ClaimDocument,
  type ClaimDraft,
  type OwnerIndex,
} from "./ownership";

const NOW = 1_800_000_000_000;
const user: AppUser = { uid: "u1", displayName: "Kocsmáros Kati" };
const admin = { uid: "admin", isAdmin: true };
const doc = (kind: ClaimDocument["kind"], i = 0): ClaimDocument => ({ id: `f${kind}${i}`, kind, name: `${kind}.jpg`, mime: "image/jpeg", size: 1000, uploadedAt: NOW });
const drink = (id: string, price = 900): Drink => ({ id, name: "Sör", style: "lager", volumeL: 0.5, price });
const place = (extra: Partial<Place> = {}): Place => ({
  id: "p1", name: "Teszt Kocsma", address: "Bp", location: { lat: 47.48, lng: 19.06 }, vibes: [], drinks: [drink("d1")], happyHours: [], ...extra,
});
const draft = (extra: Partial<ClaimDraft> = {}): ClaimDraft => ({
  role: "owner",
  businessName: "Teszt Kft.",
  taxNumber: "10625790444",
  companyReg: "",
  contactName: "Kocsmáros Kati",
  phone: "06 30 123 4567",
  documents: [doc("storefront"), doc("receipt")],
  consent: true,
  ...extra,
});

describe("feltöltések", () => {
  it("típus, méret és darabszám korlát", () => {
    expect(validateUpload({ name: "a.jpg", mime: "image/jpeg", size: 2e6 }, 0)).toBeNull();
    expect(validateUpload({ name: "a.pdf", mime: "application/pdf", size: 2e6 }, 4)).toBeNull();
    expect(validateUpload({ name: "a.gif", mime: "image/gif", size: 1000 }, 0)).toMatch(/JPG/);
    expect(validateUpload({ name: "a.jpg", mime: "image/jpeg", size: 6e6 }, 0)).toMatch(/5 MB/);
    expect(validateUpload({ name: "a.jpg", mime: "image/jpeg", size: 1000 }, 5)).toMatch(/Legfeljebb/);
  });
});

describe("igénylés piszkozata", () => {
  it("teljes, helyes piszkozatnál nincs hiba", () => {
    expect(validateClaimDraft(draft())).toEqual({});
  });
  it("üres piszkozatnál minden kötelező mező hibás", () => {
    expect(Object.keys(validateClaimDraft(EMPTY_DRAFT)).sort()).toEqual(
      ["businessName", "consent", "contactName", "documents", "phone", "role", "taxNumber"].sort(),
    );
  });
  it("igazolás minimum: fotó + (blokk vagy cégkivonat)", () => {
    expect(validateClaimDraft(draft({ documents: [doc("receipt")] })).documents).toMatch(/helyszíni fotót/);
    expect(validateClaimDraft(draft({ documents: [doc("storefront"), doc("other")] })).documents).toMatch(/blokk/);
    expect(validateClaimDraft(draft({ documents: [doc("storefront"), doc("registry")] })).documents).toBeUndefined();
  });
  it("hibás opcionális cégjegyzékszám is hiba", () => {
    expect(validateClaimDraft(draft({ companyReg: "123" })).companyReg).toBeDefined();
  });
});

describe("igénylés beküldése és bírálata", () => {
  const claim = buildClaim(draft({ companyReg: "01 09 123456" }), user, place({ googlePlaceId: "ChIJ123" }), "c1", NOW);

  it("beküldve mindig függőben, normalizált azonosítókkal, csak place_id-vel a Google-ből", () => {
    expect(claim.status).toBe("pending");
    expect(claim.taxNumber).toBe("10625790-4-44");
    expect(claim.companyReg).toBe("01-09-123456");
    expect(claim.phone).toBe("+36 301234567");
    expect(claim.googlePlaceId).toBe("ChIJ123");
    expect(claim.reviewedBy).toBeUndefined();
    expect(() => buildClaim(EMPTY_DRAFT, user, place(), "c2", NOW)).toThrow();
  });

  it("duplikált függő igénylés és már gazdás hely tiltva", () => {
    expect(canSubmitClaim("u1", "p1", [claim], {})).toEqual({ ok: false, reason: expect.stringMatching(/függőben/) });
    expect(canSubmitClaim("u2", "p1", [claim], {}).ok).toBe(true);
    const owners: OwnerIndex = { p1: { placeId: "p1", uid: "u9", claimId: "x", businessName: "X", verifiedAt: NOW } };
    expect(canSubmitClaim("u2", "p1", [], owners).ok).toBe(false);
  });

  it("nem admin és a saját igénylését bíráló admin nem hagyhat jóvá", () => {
    expect(() => reviewClaim(claim, { action: "verify" }, { uid: "u1", isAdmin: false }, {}, NOW)).toThrow(/admin/);
    expect(() => reviewClaim(claim, { action: "verify" }, { uid: "u1", isAdmin: true }, {}, NOW)).toThrow(/saját/);
  });

  it("jóváhagyás: ellenőrzött lesz és létrejön a kocsmáros bejegyzés", () => {
    const r = reviewClaim(claim, { action: "verify" }, admin, {}, NOW + 1);
    expect(r.claim.status).toBe("verified");
    expect(r.claim.reviewedBy).toBe("admin");
    expect(r.owner).toEqual({ placeId: "p1", uid: "u1", claimId: "c1", businessName: "Teszt Kft.", verifiedAt: NOW + 1 });
    expect(() => reviewClaim(r.claim, { action: "verify" }, admin, {}, NOW)).toThrow(/bírálva/);
  });

  it("elutasítás csak indoklással; gazdás helyre nem hagyható jóvá másik igénylés", () => {
    expect(() => reviewClaim(claim, { action: "reject", note: " " }, admin, {}, NOW)).toThrow(/okát/);
    const r = reviewClaim(claim, { action: "reject", note: "Nem olvasható a blokk" }, admin, {}, NOW);
    expect(r.claim.status).toBe("rejected");
    expect(r.owner).toBeUndefined();
    const owners: OwnerIndex = { p1: { placeId: "p1", uid: "u9", claimId: "x", businessName: "X", verifiedAt: NOW } };
    expect(() => reviewClaim(claim, { action: "verify" }, admin, owners, NOW)).toThrow(/már van/);
  });

  it("visszavonás csak a sajátot, csak függőben", () => {
    expect(withdrawClaim(claim, "u1", NOW).status).toBe("withdrawn");
    expect(() => withdrawClaim(claim, "u2", NOW)).toThrow();
  });

  it("az igazolások a döntés után 30 nappal lejárnak", () => {
    const r = reviewClaim(claim, { action: "verify" }, admin, {}, NOW).claim;
    expect(documentsExpired(claim, NOW + 99 * 86400000)).toBe(false);
    expect(documentsExpired(r, NOW + 29 * 86400000)).toBe(false);
    expect(documentsExpired(r, NOW + 31 * 86400000)).toBe(true);
  });
});

describe("szerkesztési jog ellenőrzött helynél", () => {
  const owners: OwnerIndex = { p1: { placeId: "p1", uid: "owner", claimId: "c", businessName: "X", verifiedAt: NOW } };
  const before = place();

  it("a kocsmáros szerkesztheti; más csak a hangulat-címkéket", () => {
    const pricier = { ...before, drinks: [drink("d1", 1500)] };
    expect(isVerifiedOwner("owner", "p1", owners)).toBe(true);
    expect(checkPlaceEdit("owner", before, pricier, owners).ok).toBe(true);
    expect(checkPlaceEdit("other", before, pricier, owners).ok).toBe(false);
    expect(checkPlaceEdit("other", before, { ...before, info: { openingHours: "Mo-Su 10:00-22:00" } }, owners).ok).toBe(false);
    expect(checkPlaceEdit("other", before, { ...before, vibes: ["garden"] }, owners).ok).toBe(true);
    expect(ownerOnlyChanges(before, { ...before, name: "Új", photos: [] })).toEqual(["name", "photos"]);
  });

  it("gazdátlan helynél mindenki szerkeszthet (Waze-elv), de a kiemelést senki", () => {
    expect(checkPlaceEdit("bárki", before, { ...before, drinks: [] }, {}).ok).toBe(true);
    expect(checkPlaceEdit("bárki", before, { ...before, sponsored: { until: NOW, tagline: "x" } }, {}).ok).toBe(false);
    expect(checkPlaceEdit("owner", before, { ...before, sponsored: { until: NOW, tagline: "x" } }, owners).ok).toBe(false);
  });
});

describe("közösségi ármegerősítés", () => {
  it("külön mezőbe kerül, az ital adatai változatlanok", () => {
    const p = addConfirmation(addConfirmation(place(), "d1", NOW), "d1", NOW + 5);
    expect(p.drinks).toEqual(place().drinks);
    expect(drinkConfirmation(p, p.drinks[0])).toEqual({ count: 2, lastAt: NOW + 5 });
    expect(addConfirmation(place(), "nincs", NOW)).toEqual(place());
  });
  it("árváltozás után a régi megerősítések nem számítanak", () => {
    const p = addConfirmation(place(), "d1", NOW);
    const changed = { ...p, drinks: [{ ...drink("d1", 1100), updatedAt: NOW + 10 }] };
    expect(drinkConfirmation(changed, changed.drinks[0])).toEqual({ count: 0, lastAt: undefined });
    expect(drinkConfirmation(addConfirmation(changed, "d1", NOW + 20), changed.drinks[0])).toEqual({ count: 1, lastAt: NOW + 20 });
  });
});
