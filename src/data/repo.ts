import type { AppUser, Place, PlacePhoto, Report, TasteProfile } from "../domain/types";
import type { ClaimDocKind, ClaimDocument, OwnerClaim, OwnerIndex, ReviewDecision } from "../domain/ownership";
import type { DrinkPromotion } from "../domain/pricing";
import type { OwnerAccount } from "../domain/account";
import type { AvatarPref, AvatarSettings } from "../domain/avatar";

export type Unsubscribe = () => void;

/**
 * Elbírálói műveletek (igénylések, kiemelések). Éles módban csak `admin` custom claimmel rendelkező
 * felhasználónak létezik, és a firestore.rules a szerveren is kikényszeríti.
 * Demó módban a beépített „Ellenőrző (csak demó)” használja – ott nincs szerver, ami ellenőrizhetne.
 */
export interface ReviewApi {
  readonly label: string;
  subscribePendingClaims(cb: (claims: OwnerClaim[]) => void): Unsubscribe;
  /** Igazolás megnyitható címe (éles: rövid életű letöltési URL, demó: előnézet). */
  documentUrl(doc: ClaimDocument): Promise<string | undefined>;
  reviewClaim(claimId: string, decision: ReviewDecision): Promise<void>;
  decidePromotion(promoId: string, decision: "activate" | "reject", note?: string): Promise<void>;
}

/**
 * Az adatréteg szerződése. Két megvalósítás van:
 *  - LocalRepo: demó mód, a böngészőben tárolva (nincs szerver).
 *  - FirebaseRepo: éles mód, Firestore + Storage – minden felhasználó ugyanazt látja.
 * A felület minden része csak ezen az interfészen keresztül ír/olvas.
 */
export interface Repo {
  readonly mode: "demo" | "firebase";
  subscribePlaces(cb: (places: Place[]) => void): Unsubscribe;
  subscribeReports(cb: (reports: Report[]) => void): Unsubscribe;
  /** Ellenőrzött helynél a kocsmáros-mezőket csak a kocsmáros módosíthatja (hibát dob). */
  savePlace(place: Place, by: AppUser): Promise<void>;
  addReport(report: Omit<Report, "id">): Promise<void>;
  voteReport(reportId: string, uid: string, vote: "confirm" | "deny"): Promise<void>;
  /** „Még mindig ennyi?” – a hely `confirmations` mezőjébe ír, az itallapot nem módosítja. */
  confirmDrinkPrice(placeId: string, drinkId: string, uid: string): Promise<void>;
  getProfile(uid: string): Promise<TasteProfile | undefined>;
  saveProfile(uid: string, profile: TasteProfile): Promise<void>;

  // ---- profilkép ----
  /** Saját profilkép és beállítás (users/{uid}.avatar). Hibás adatnál alapérték. */
  subscribeAvatar(uid: string, cb: (s: AvatarSettings) => void): Unsubscribe;
  /** Kép beállítása: a böngésző 256×256-ra kicsinyíti, az eredeti fájl nem kerül tárolásra. */
  setAvatar(uid: string, file: File): Promise<void>;
  clearAvatar(uid: string): Promise<void>;
  setAvatarPref(uid: string, pref: AvatarPref): Promise<void>;

  // ---- kocsmáros fiók és profil ----
  /** A felhasználó kocsmáros fiókja (users/{uid}.ownerAccount) – `undefined`, ha még nincs. */
  subscribeOwnerAccount(uid: string, cb: (account: OwnerAccount | undefined) => void): Unsubscribe;
  createOwnerAccount(account: OwnerAccount): Promise<void>;
  /** Új azonosító igényléshez / kiemeléshez (a feltöltések útvonalához előre kell). */
  newId(kind: "claims" | "promotions"): string;
  subscribeOwners(cb: (owners: OwnerIndex) => void): Unsubscribe;
  subscribeMyClaims(uid: string, cb: (claims: OwnerClaim[]) => void): Unsubscribe;
  uploadClaimDocument(uid: string, claimId: string, file: File, kind: ClaimDocKind): Promise<ClaimDocument>;
  /** Csak kocsmáros fiókkal (a szabályok is ellenőrzik). */
  submitClaim(claim: OwnerClaim): Promise<void>;
  withdrawClaim(claimId: string, uid: string): Promise<void>;
  /** Csak a hely ellenőrzött kocsmárosa. */
  uploadPlacePhoto(placeId: string, file: File, by: AppUser): Promise<PlacePhoto>;

  // ---- fizetős ital-kiemelés ----
  /** Az élő kiemelések mindenkinek, plusz a felhasználó saját kérései (adminnak minden). */
  subscribePromotions(user: AppUser, cb: (promos: DrinkPromotion[]) => void): Unsubscribe;
  /** Csak `requested` állapotú kérés küldhető; aktiválni csak elbíráló tud. */
  requestPromotion(promo: DrinkPromotion): Promise<void>;
  cancelPromotionRequest(promoId: string, uid: string): Promise<void>;

  /** Elbírálói felület – `undefined`, ha a felhasználó nem admin (éles módban). */
  reviewer(user: AppUser): ReviewApi | undefined;

  /** Csak demó módban: minden adat visszaállítása. */
  reset?(): Promise<void>;
}
