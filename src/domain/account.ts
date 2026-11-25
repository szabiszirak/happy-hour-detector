// Fiókok és szerepkörök: vendég fiók / kocsmáros fiók.
// Egy személy (egy Google-fiók) mindkettőt használhatja, fiókváltással. A kocsmáros fiók önmagában
// semmilyen jogot nem ad a helyekhez: szerkeszteni és kiemelést kérni csak az admin által ellenőrzött
// igénylés után lehet (owners/{placeId}), és csak kocsmáros fiókban.
import { validateEmail } from "./businessId";
import type { OwnerClaim, OwnerIndex } from "./ownership";

export type AccountMode = "guest" | "owner";

export const ACCOUNT_MODE_LABELS: Record<AccountMode, string> = {
  guest: "Vendég fiók",
  owner: "Kocsmáros fiók",
};

/** Kocsmáros fiók – egyszer kell létrehozni (users/{uid}.ownerAccount). */
export interface OwnerAccount {
  uid: string;
  contactEmail: string;
  termsAcceptedAt: number;
  createdAt: number;
}

export interface OwnerAccountDraft {
  contactEmail: string;
  acceptTerms: boolean;
}

export type OwnerAccountErrors = Partial<Record<keyof OwnerAccountDraft, string>>;

export function validateOwnerAccountDraft(d: OwnerAccountDraft): OwnerAccountErrors {
  const e: OwnerAccountErrors = {};
  const email = validateEmail(d.contactEmail);
  if (!email.ok) e.contactEmail = email.error;
  if (!d.acceptTerms) e.acceptTerms = "A kocsmárosi feltételek elfogadása kötelező.";
  return e;
}

export function buildOwnerAccount(d: OwnerAccountDraft, uid: string, now: number): OwnerAccount {
  const errors = validateOwnerAccountDraft(d);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  const email = validateEmail(d.contactEmail) as { ok: true; normalized: string };
  return { uid, contactEmail: email.normalized, termsAcceptedAt: now, createdAt: now };
}

/** Érvényes, tárolt kocsmáros fiók-e (régi / hibás adatnál undefined). */
export function parseOwnerAccount(raw: unknown, uid: string): OwnerAccount | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Partial<OwnerAccount>;
  if (typeof r.contactEmail !== "string" || typeof r.termsAcceptedAt !== "number") return undefined;
  return { uid, contactEmail: r.contactEmail, termsAcceptedAt: r.termsAcceptedAt, createdAt: r.createdAt ?? r.termsAcceptedAt };
}

/** Eltárolt aktív fiók beolvasása (ismeretlen érték → vendég). */
export function parseAccountMode(raw: unknown): AccountMode {
  return raw === "owner" ? "owner" : "guest";
}

// ---------- jogosultságok az aktív fiók szerint ----------

export interface Capabilities {
  mode: AccountMode;
  hasOwnerAccount: boolean;
  /** Indíthat-e „Ez az én helyem” igénylést (kocsmáros fiók + létrehozott fiók). */
  canClaim: boolean;
  /** Látja-e a Kocsmáros felületet a menüben. */
  canOpenOwnerDashboard: boolean;
  /** Az ellenőrzött helyei – kezelni csak kocsmáros fiókban tudja őket. */
  managedPlaceIds: string[];
}

export function capabilities(mode: AccountMode, uid: string, account: OwnerAccount | undefined, owners: OwnerIndex): Capabilities {
  const isOwnerMode = mode === "owner";
  const managed = isOwnerMode ? Object.values(owners).filter((o) => o.uid === uid).map((o) => o.placeId) : [];
  return {
    mode,
    hasOwnerAccount: !!account,
    canClaim: isOwnerMode && !!account,
    canOpenOwnerDashboard: isOwnerMode,
    managedPlaceIds: managed,
  };
}

/** Kezelheti-e a hely kocsmáros-adatait (nyitvatartás, HH, itallap, fotók): csak kocsmáros fiókban, csak ellenőrzés után. */
export function canManagePlace(mode: AccountMode, uid: string, placeId: string, owners: OwnerIndex): boolean {
  return mode === "owner" && owners[placeId]?.uid === uid;
}

/**
 * Szerkesztés gomb: gazdátlan helyet bárki szerkeszthet (Waze-elv, bármelyik fiókból);
 * ellenőrzött helyet csak a kocsmárosa, kocsmáros fiókból.
 */
export function canEditPlaceAs(mode: AccountMode, uid: string, placeId: string, owners: OwnerIndex): boolean {
  return !owners[placeId] || canManagePlace(mode, uid, placeId, owners);
}

/** Ital-kiemelést kérhet-e ehhez a helyhez. */
export function canRequestPromotionAs(mode: AccountMode, uid: string, placeId: string, owners: OwnerIndex): boolean {
  return canManagePlace(mode, uid, placeId, owners);
}

// ---------- „Ez az én helyem” gomb ----------

export type ClaimButtonState =
  /** vendég fiókban nem látszik */
  | "hidden"
  /** kocsmáros módban van, de a kocsmáros fiók még nincs létrehozva */
  | "needs-account"
  | "claim"
  /** a saját igénylése függőben */
  | "pending"
  /** korábban elutasították – újra igényelhet */
  | "retry"
  /** a saját, ellenőrzött helye */
  | "mine"
  /** másnak már ellenőrzött helye */
  | "taken";

export function claimButtonState(
  mode: AccountMode,
  uid: string,
  account: OwnerAccount | undefined,
  placeId: string,
  myClaims: OwnerClaim[],
  owners: OwnerIndex,
): ClaimButtonState {
  if (mode !== "owner") return "hidden";
  const owner = owners[placeId];
  if (owner) return owner.uid === uid ? "mine" : "taken";
  if (!account) return "needs-account";
  const mine = myClaims.filter((c) => c.uid === uid && c.placeId === placeId).sort((a, b) => b.createdAt - a.createdAt);
  if (mine.some((c) => c.status === "pending")) return "pending";
  if (mine[0]?.status === "rejected") return "retry";
  return "claim";
}

// ---------- Kocsmáros felület ----------

export type OwnerDashboardState =
  /** még nincs kocsmáros fiók → fiók létrehozása */
  | "no-account"
  /** van fiók, de nincs igénylés / ellenőrzött hely → válassz helyet */
  | "pick-place"
  /** van függő igénylés, ellenőrzött hely még nincs */
  | "pending"
  /** van legalább egy ellenőrzött helye */
  | "active";

export function ownerDashboardState(uid: string, account: OwnerAccount | undefined, myClaims: OwnerClaim[], owners: OwnerIndex): OwnerDashboardState {
  if (!account) return "no-account";
  if (Object.values(owners).some((o) => o.uid === uid)) return "active";
  if (myClaims.some((c) => c.uid === uid && c.status === "pending")) return "pending";
  return "pick-place";
}
