import { describe, expect, it } from "vitest";
import {
  buildOwnerAccount,
  canEditPlaceAs,
  canManagePlace,
  canRequestPromotionAs,
  capabilities,
  claimButtonState,
  ownerDashboardState,
  parseAccountMode,
  parseOwnerAccount,
  validateOwnerAccountDraft,
  type OwnerAccount,
} from "./account";
import { validateEmail } from "./businessId";
import type { OwnerClaim, OwnerIndex } from "./ownership";

const NOW = 1_800_000_000_000;
const account: OwnerAccount = { uid: "me", contactEmail: "kati@pelda.hu", termsAcceptedAt: NOW, createdAt: NOW };
const owners: OwnerIndex = {
  mine: { placeId: "mine", uid: "me", claimId: "c0", businessName: "X", verifiedAt: NOW },
  other: { placeId: "other", uid: "someone", claimId: "c9", businessName: "Y", verifiedAt: NOW },
};
const claim = (placeId: string, status: OwnerClaim["status"], createdAt = NOW, uid = "me"): OwnerClaim => ({
  id: `${placeId}-${status}-${createdAt}`, placeId, placeName: placeId, uid, userName: "Kati", role: "owner", businessName: "X",
  taxNumber: "10625790-4-44", contactName: "Kati", phone: "+36 301234567", documents: [], status, createdAt,
});

describe("kocsmáros fiók létrehozása", () => {
  it("e-mail és feltételek kötelezők", () => {
    expect(Object.keys(validateOwnerAccountDraft({ contactEmail: "", acceptTerms: false })).sort()).toEqual(["acceptTerms", "contactEmail"]);
    expect(validateOwnerAccountDraft({ contactEmail: "kati@pelda.hu", acceptTerms: true })).toEqual({});
    expect(validateEmail(" Kati@Pelda.HU ")).toEqual({ ok: true, normalized: "kati@pelda.hu" });
    expect(validateEmail("kati@pelda").ok).toBe(false);
  });
  it("fiók építése normalizált e-maillel; hibás piszkozatnál kivétel", () => {
    expect(buildOwnerAccount({ contactEmail: "Kati@Pelda.hu", acceptTerms: true }, "me", NOW)).toEqual(account);
    expect(() => buildOwnerAccount({ contactEmail: "x", acceptTerms: true }, "me", NOW)).toThrow();
  });
  it("tárolt adat beolvasása", () => {
    expect(parseOwnerAccount({ contactEmail: "kati@pelda.hu", termsAcceptedAt: NOW, createdAt: NOW }, "me")).toEqual(account);
    expect(parseOwnerAccount({ contactEmail: "a@b.hu" }, "me")).toBeUndefined();
    expect(parseOwnerAccount(null, "me")).toBeUndefined();
    expect(parseAccountMode("owner")).toBe("owner");
    expect(parseAccountMode("admin")).toBe("guest");
    expect(parseAccountMode(undefined)).toBe("guest");
  });
});

describe("jogosultságok az aktív fiók szerint", () => {
  it("vendég fiókban semmilyen kocsmáros jog nincs – a saját ellenőrzött helyén sem", () => {
    const c = capabilities("guest", "me", account, owners);
    expect(c).toEqual({ mode: "guest", hasOwnerAccount: true, canClaim: false, canOpenOwnerDashboard: false, managedPlaceIds: [] });
    expect(canManagePlace("guest", "me", "mine", owners)).toBe(false);
    expect(canEditPlaceAs("guest", "me", "mine", owners)).toBe(false);
    expect(canRequestPromotionAs("guest", "me", "mine", owners)).toBe(false);
  });
  it("kocsmáros fiókban: igényelhet (ha a fiók létrejött), a saját helyét kezelheti, másét nem", () => {
    expect(capabilities("owner", "me", account, owners)).toMatchObject({ canClaim: true, canOpenOwnerDashboard: true, managedPlaceIds: ["mine"] });
    expect(capabilities("owner", "me", undefined, owners).canClaim).toBe(false);
    expect(canManagePlace("owner", "me", "mine", owners)).toBe(true);
    expect(canRequestPromotionAs("owner", "me", "mine", owners)).toBe(true);
    expect(canEditPlaceAs("owner", "me", "other", owners)).toBe(false);
    expect(canRequestPromotionAs("owner", "me", "other", owners)).toBe(false);
  });
  it("gazdátlan helyet bármelyik fiókból lehet szerkeszteni (Waze-elv), kiemelést kérni nem", () => {
    expect(canEditPlaceAs("guest", "me", "free", owners)).toBe(true);
    expect(canEditPlaceAs("owner", "me", "free", owners)).toBe(true);
    expect(canRequestPromotionAs("owner", "me", "free", owners)).toBe(false);
  });
});

describe("„Ez az én helyem” gomb", () => {
  it("vendég fiókban sosem látszik", () => {
    for (const p of ["free", "mine", "other"]) expect(claimButtonState("guest", "me", account, p, [], owners)).toBe("hidden");
  });
  it("kocsmáros fiókban az állapot szerint", () => {
    expect(claimButtonState("owner", "me", account, "free", [], owners)).toBe("claim");
    expect(claimButtonState("owner", "me", undefined, "free", [], owners)).toBe("needs-account");
    expect(claimButtonState("owner", "me", account, "mine", [], owners)).toBe("mine");
    expect(claimButtonState("owner", "me", account, "other", [], owners)).toBe("taken");
    expect(claimButtonState("owner", "me", account, "free", [claim("free", "pending")], owners)).toBe("pending");
    expect(claimButtonState("owner", "me", account, "free", [claim("free", "rejected")], owners)).toBe("retry");
    expect(claimButtonState("owner", "me", account, "free", [claim("free", "rejected"), claim("free", "withdrawn", NOW + 1)], owners)).toBe("claim");
    expect(claimButtonState("owner", "me", account, "free", [claim("free", "pending", NOW, "valaki")], owners)).toBe("claim");
  });
});

describe("Kocsmáros felület állapota", () => {
  it("fiók nélkül → fiók létrehozása; igénylés nélkül → helyválasztás; függő → pending; ellenőrzött → active", () => {
    expect(ownerDashboardState("me", undefined, [], owners)).toBe("no-account");
    expect(ownerDashboardState("me", account, [], {})).toBe("pick-place");
    expect(ownerDashboardState("me", account, [claim("free", "rejected")], {})).toBe("pick-place");
    expect(ownerDashboardState("me", account, [claim("free", "pending")], {})).toBe("pending");
    expect(ownerDashboardState("me", account, [claim("free", "pending")], owners)).toBe("active");
  });
});
