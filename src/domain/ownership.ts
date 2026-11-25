// Kocsmáros profil: hely-igénylés („Ez az én helyem”), hitelesítés, jogosultságok.
// A szabályok itt tiszta függvények; ugyanezt a firestore.rules / storage.rules a szerveren is kikényszeríti,
// így kliensoldalról senki nem tudja magát hitelesíteni.
import type { AppUser, Drink, Place } from "./types";
import { validateCompanyReg, validatePhone, validateTaxNumber } from "./businessId";

export type ClaimStatus = "pending" | "verified" | "rejected" | "withdrawn";
export type ClaimRole = "owner" | "manager";
export type ClaimDocKind = "storefront" | "receipt" | "registry" | "other";

export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  pending: "Függőben",
  verified: "Ellenőrzött",
  rejected: "Elutasítva",
  withdrawn: "Visszavonva",
};
export const CLAIM_ROLE_LABELS: Record<ClaimRole, string> = { owner: "Tulajdonos", manager: "Üzletvezető" };
export const DOC_KIND_LABELS: Record<ClaimDocKind, string> = {
  storefront: "Helyszíni fotó (bejárat / cégtábla)",
  receipt: "Blokk vagy számla a hely nevével",
  registry: "Cégkivonat / vállalkozói igazolás",
  other: "Egyéb",
};

export interface ClaimDocument {
  id: string;
  kind: ClaimDocKind;
  name: string;
  mime: string;
  size: number;
  /** Éles módban a Storage-útvonal (claims/{uid}/{claimId}/…), csak a feltöltő és az admin olvashatja. */
  storagePath?: string;
  /** Demóban kicsinyített előnézet (data URL); PDF-nél nincs. */
  previewUrl?: string;
  uploadedAt: number;
}

export interface OwnerClaim {
  id: string;
  placeId: string;
  /** A Google-ből csak ezt az azonosítót tároljuk. */
  googlePlaceId?: string;
  placeName: string;
  uid: string;
  userName: string;
  role: ClaimRole;
  businessName: string;
  taxNumber: string;
  companyReg?: string;
  contactName: string;
  phone: string;
  documents: ClaimDocument[];
  status: ClaimStatus;
  createdAt: number;
  reviewedAt?: number;
  reviewedBy?: string;
  reviewNote?: string;
}

/** Ellenőrzött kocsmáros egy helyhez – csak admin hozhatja létre (owners/{placeId}). */
export interface PlaceOwner {
  placeId: string;
  uid: string;
  claimId: string;
  businessName: string;
  verifiedAt: number;
}

/** placeId → ellenőrzött kocsmáros */
export type OwnerIndex = Record<string, PlaceOwner>;

export interface Reviewer {
  uid: string;
  isAdmin: boolean;
}

// ---------- feltöltések ----------

export const UPLOAD_LIMITS = {
  maxFiles: 5,
  maxBytes: 5 * 1024 * 1024,
  mimes: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
} as const;

/** Az igazolások a döntés után ennyi nappal törlődnek. */
export const DOC_RETENTION_DAYS = 30;

export function validateUpload(file: { name: string; mime: string; size: number }, existingCount: number): string | null {
  if (existingCount >= UPLOAD_LIMITS.maxFiles) return `Legfeljebb ${UPLOAD_LIMITS.maxFiles} fájl tölthető fel.`;
  if (!(UPLOAD_LIMITS.mimes as readonly string[]).includes(file.mime)) return "Csak JPG, PNG, WebP kép vagy PDF tölthető fel.";
  if (file.size > UPLOAD_LIMITS.maxBytes) return "A fájl legfeljebb 5 MB lehet.";
  if (file.size === 0) return "Üres fájl.";
  return null;
}

// ---------- igénylés ----------

export interface ClaimDraft {
  role: ClaimRole | "";
  businessName: string;
  taxNumber: string;
  companyReg: string;
  contactName: string;
  phone: string;
  documents: ClaimDocument[];
  /** Nyilatkozat: jogosult vagyok a hely képviseletére, az adatok valósak. */
  consent: boolean;
}

export type ClaimDraftErrors = Partial<Record<keyof ClaimDraft, string>>;

export const EMPTY_DRAFT: ClaimDraft = {
  role: "",
  businessName: "",
  taxNumber: "",
  companyReg: "",
  contactName: "",
  phone: "",
  documents: [],
  consent: false,
};

/** Az igazolások minimuma: legalább 1 helyszíni fotó, és legalább 1 blokk/számla vagy cégkivonat. */
export function documentsError(docs: ClaimDocument[]): string | null {
  const has = (k: ClaimDocKind) => docs.some((d) => d.kind === k);
  if (!has("storefront")) return "Tölts fel legalább egy helyszíni fotót (bejárat vagy cégtábla).";
  if (!has("receipt") && !has("registry")) return "Kell egy blokk/számla a hely nevével vagy egy cégkivonat is.";
  return null;
}

export function validateClaimDraft(d: ClaimDraft): ClaimDraftErrors {
  const e: ClaimDraftErrors = {};
  if (!d.role) e.role = "Válaszd ki, milyen minőségben igényled.";
  if (d.businessName.trim().length < 2) e.businessName = "Add meg a vállalkozás nevét.";
  const tax = validateTaxNumber(d.taxNumber);
  if (!tax.ok) e.taxNumber = tax.error;
  if (d.companyReg.trim()) {
    const reg = validateCompanyReg(d.companyReg);
    if (!reg.ok) e.companyReg = reg.error;
  }
  if (d.contactName.trim().length < 3) e.contactName = "Add meg a kapcsolattartó nevét.";
  const phone = validatePhone(d.phone);
  if (!phone.ok) e.phone = phone.error;
  const docErr = documentsError(d.documents);
  if (docErr) e.documents = docErr;
  if (!d.consent) e.consent = "A nyilatkozat elfogadása kötelező.";
  return e;
}

export type Check = { ok: true } | { ok: false; reason: string };

/** Igényelheti-e a felhasználó ezt a helyet most. */
export function canSubmitClaim(uid: string, placeId: string, claims: OwnerClaim[], owners: OwnerIndex): Check {
  const owner = owners[placeId];
  if (owner?.uid === uid) return { ok: false, reason: "Ez már a te ellenőrzött helyed." };
  if (owner) return { ok: false, reason: "Ennek a helynek már van ellenőrzött kocsmárosa. Ha vitatod, írj nekünk." };
  if (claims.some((c) => c.uid === uid && c.placeId === placeId && c.status === "pending"))
    return { ok: false, reason: "Erre a helyre már van függőben lévő igénylésed." };
  return { ok: true };
}

/** Beküldhető igénylés a piszkozatból – mindig `pending` állapotban, ellenőrzési mezők nélkül. */
export function buildClaim(draft: ClaimDraft, user: AppUser, place: Place, id: string, now: number): OwnerClaim {
  const errors = validateClaimDraft(draft);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  const tax = validateTaxNumber(draft.taxNumber) as { ok: true; normalized: string };
  const phone = validatePhone(draft.phone) as { ok: true; normalized: string };
  const reg = draft.companyReg.trim() ? (validateCompanyReg(draft.companyReg) as { ok: true; normalized: string }).normalized : undefined;
  const claim: OwnerClaim = {
    id,
    placeId: place.id,
    placeName: place.name,
    uid: user.uid,
    userName: user.displayName,
    role: draft.role as ClaimRole,
    businessName: draft.businessName.trim(),
    taxNumber: tax.normalized,
    contactName: draft.contactName.trim(),
    phone: phone.normalized,
    documents: draft.documents,
    status: "pending",
    createdAt: now,
  };
  if (place.googlePlaceId) claim.googlePlaceId = place.googlePlaceId;
  if (reg) claim.companyReg = reg;
  return claim;
}

/** A felhasználó visszavonhatja a saját, még függő igénylését. */
export function withdrawClaim(claim: OwnerClaim, uid: string, now: number): OwnerClaim {
  if (claim.uid !== uid) throw new Error("Csak a saját igénylésed vonhatod vissza.");
  if (claim.status !== "pending") throw new Error("Csak függő igénylés vonható vissza.");
  return { ...claim, status: "withdrawn", reviewedAt: now };
}

export type ReviewDecision = { action: "verify" } | { action: "reject"; note: string };

/**
 * Admin döntés egy igénylésről. Csak admin, csak függő igénylésnél.
 * Jóváhagyáskor létrejön a PlaceOwner bejegyzés (owners/{placeId}).
 */
export function reviewClaim(
  claim: OwnerClaim,
  decision: ReviewDecision,
  reviewer: Reviewer,
  owners: OwnerIndex,
  now: number,
): { claim: OwnerClaim; owner?: PlaceOwner } {
  if (!reviewer.isAdmin) throw new Error("Igénylést csak admin bírálhat el.");
  if (reviewer.uid === claim.uid) throw new Error("A saját igénylésedet nem bírálhatod el.");
  if (claim.status !== "pending") throw new Error("Ez az igénylés már el van bírálva.");
  const base = { ...claim, reviewedAt: now, reviewedBy: reviewer.uid };
  if (decision.action === "reject") {
    if (!decision.note.trim()) throw new Error("Elutasításnál add meg az okát.");
    return { claim: { ...base, status: "rejected", reviewNote: decision.note.trim() } };
  }
  const existing = owners[claim.placeId];
  if (existing && existing.uid !== claim.uid) throw new Error("Ennek a helynek már van ellenőrzött kocsmárosa.");
  return {
    claim: { ...base, status: "verified" },
    owner: { placeId: claim.placeId, uid: claim.uid, claimId: claim.id, businessName: claim.businessName, verifiedAt: now },
  };
}

/** Az igazolások törölhetők-e már (a döntés után DOC_RETENTION_DAYS nappal). */
export function documentsExpired(claim: OwnerClaim, now: number): boolean {
  return claim.status !== "pending" && claim.reviewedAt !== undefined && now - claim.reviewedAt > DOC_RETENTION_DAYS * 86400000;
}

// ---------- jogosultság a hely adataihoz ----------

export function isVerifiedOwner(uid: string, placeId: string, owners: OwnerIndex): boolean {
  return owners[placeId]?.uid === uid;
}

/** Ellenőrzött helynél ezeket csak a kocsmáros módosíthatja (a közösség bejelentéssel jelezhet). */
export const OWNER_ONLY_FIELDS = ["name", "address", "info", "drinks", "happyHours", "photos", "description"] as const;
export type OwnerOnlyField = (typeof OWNER_ONLY_FIELDS)[number];

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Mely kocsmáros-mezőket érinti a módosítás. */
export function ownerOnlyChanges(before: Place, after: Place): OwnerOnlyField[] {
  return OWNER_ONLY_FIELDS.filter((f) => !same(before[f], after[f]));
}

/** Szerkesztheti-e a felhasználó a hely kocsmáros-mezőit. Gazdátlan helynél mindenki (Waze-elv). */
export function canEditPlaceDetails(uid: string, placeId: string, owners: OwnerIndex): boolean {
  const owner = owners[placeId];
  return !owner || owner.uid === uid;
}

/** Elmenthető-e a módosítás ennek a felhasználónak (a LocalRepo és a firestore.rules ugyanezt nézi). */
export function checkPlaceEdit(uid: string, before: Place | undefined, after: Place, owners: OwnerIndex): Check {
  if (!before || canEditPlaceDetails(uid, after.id, owners)) {
    if (before && !same(before.sponsored, after.sponsored)) return { ok: false, reason: "A kiemelést csak admin állíthatja." };
    return { ok: true };
  }
  const touched = ownerOnlyChanges(before, after);
  if (touched.length) return { ok: false, reason: "Ezt a helyet ellenőrzött kocsmáros kezeli – jelezz bejelentéssel." };
  return { ok: true };
}

// ---------- közösségi ármegerősítés (a kocsmáros adatait nem írja) ----------

/** „Még mindig ennyi?” – a megerősítés külön mezőbe kerül; régi, italba írt értékekkel összevonva. */
export function drinkConfirmation(place: Place, drink: Drink): { count: number; lastAt?: number } {
  const raw = place.confirmations?.[drink.id];
  // az ár módosítása óta adott megerősítések számítanak csak
  const c = raw && !(drink.updatedAt !== undefined && drink.updatedAt > raw.lastAt) ? raw : undefined;
  const legacyAt = drink.lastConfirmedAt;
  const lastAt = Math.max(c?.lastAt ?? 0, legacyAt ?? 0) || undefined;
  return { count: (c?.count ?? 0) + (drink.confirmCount ?? 0), lastAt };
}

/** Megerősítés hozzáadása. Ha az ár azóta változott (updatedAt újabb), a régi megerősítések nem számítanak. */
export function addConfirmation(place: Place, drinkId: string, now: number): Place {
  const drink = place.drinks.find((d) => d.id === drinkId);
  if (!drink) return place;
  const prev = place.confirmations?.[drinkId];
  const stale = prev && drink.updatedAt !== undefined && drink.updatedAt > prev.lastAt;
  const count = (stale || !prev ? 0 : prev.count) + 1;
  return { ...place, confirmations: { ...(place.confirmations ?? {}), [drinkId]: { count, lastAt: now } } };
}
