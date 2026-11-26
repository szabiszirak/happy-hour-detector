// Saját értékelések: 1–5 csillag + rövid szöveg, helyenként felhasználónként egy (szerkeszthető).
// Google-értékeléseket NEM veszünk át (csak egy linket adunk a Google Térképre, lásd links.ts).
import type { AppUser } from "./types";
import type { OwnerIndex } from "./ownership";

export type Stars = 1 | 2 | 3 | 4 | 5;

export interface Review {
  /** `${placeId}__${uid}` – így egy felhasználónak egy helyre egy értékelése lehet. */
  id: string;
  placeId: string;
  uid: string;
  /** Nyilvános, rövidített név („Szabolcs S.”). */
  userName: string;
  rating: Stars;
  text: string;
  createdAt: number;
  updatedAt?: number;
}

export const REVIEW_TEXT_MAX = 500;

export const reviewId = (placeId: string, uid: string) => `${placeId}__${uid}`;

/** Nyilvános név: keresztnév + vezetéknév kezdőbetűje („Szabolcs Szirák” → „Szabolcs S.”). */
export function publicName(displayName: string): string {
  const words = displayName.trim().split(/\s+/).filter((w) => /\p{L}/u.test(w) && !/\.$/.test(w));
  if (!words.length) return "Névtelen";
  if (words.length === 1) return words[0];
  const last = words[words.length - 1].match(/\p{L}/u)?.[0]?.toLocaleUpperCase("hu-HU") ?? "";
  return `${words[0]} ${last}.`;
}

export interface ReviewDraft {
  rating: number;
  text: string;
}

export type ReviewErrors = Partial<Record<keyof ReviewDraft, string>>;

const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(hu|com|net|org|eu|io)\b)/i;

export function validateReviewDraft(d: ReviewDraft): ReviewErrors {
  const e: ReviewErrors = {};
  if (!Number.isInteger(d.rating) || d.rating < 1 || d.rating > 5) e.rating = "Válassz 1–5 csillagot.";
  const t = d.text.trim();
  if (t.length > REVIEW_TEXT_MAX) e.text = `Legfeljebb ${REVIEW_TEXT_MAX} karakter.`;
  else if (LINK.test(t)) e.text = "Linket nem lehet az értékelésbe írni.";
  return e;
}

export type Check = { ok: true } | { ok: false; reason: string };

/** A hely ellenőrzött kocsmárosa a saját helyét nem értékelheti (összeférhetetlenség). */
export function canReview(uid: string, placeId: string, owners: OwnerIndex): Check {
  if (owners[placeId]?.uid === uid) return { ok: false, reason: "A saját helyedet nem értékelheted." };
  return { ok: true };
}

/** Új vagy módosított értékelés (a létrehozás ideje megmarad). */
export function buildReview(d: ReviewDraft, user: AppUser, placeId: string, now: number, existing?: Review): Review {
  const errors = validateReviewDraft(d);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  return {
    id: reviewId(placeId, user.uid),
    placeId,
    uid: user.uid,
    userName: publicName(user.displayName),
    rating: d.rating as Stars,
    text: d.text.trim().replace(/\s+\n/g, "\n"),
    createdAt: existing?.createdAt ?? now,
    ...(existing ? { updatedAt: now } : {}),
  };
}

export interface ReviewSummary {
  count: number;
  /** Egy tizedesre kerekítve; 0, ha nincs értékelés. */
  average: number;
  /** Csillagonként a darabszám: [1★, 2★, 3★, 4★, 5★]. */
  distribution: [number, number, number, number, number];
}

export function summarizeReviews(reviews: Review[]): ReviewSummary {
  const distribution: ReviewSummary["distribution"] = [0, 0, 0, 0, 0];
  for (const r of reviews) if (r.rating >= 1 && r.rating <= 5) distribution[r.rating - 1]++;
  const count = distribution.reduce((a, b) => a + b, 0);
  const sum = distribution.reduce((a, n, i) => a + n * (i + 1), 0);
  return { count, average: count ? Math.round((sum / count) * 10) / 10 : 0, distribution };
}

/** Egy hely értékelései: a saját elöl, utána a legfrissebb (módosítás vagy létrehozás szerint). */
export function reviewsFor(all: Review[], placeId: string, uid?: string): Review[] {
  const t = (r: Review) => r.updatedAt ?? r.createdAt;
  return all
    .filter((r) => r.placeId === placeId)
    .sort((a, b) => (a.uid === uid ? -1 : b.uid === uid ? 1 : t(b) - t(a)));
}

/** „4,6” – magyar tizedesvesszővel. */
export const formatRating = (avg: number) => avg.toFixed(1).replace(".", ",");
