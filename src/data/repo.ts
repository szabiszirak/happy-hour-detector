import type { AppUser, Place, Report, TasteProfile } from "../domain/types";

export type Unsubscribe = () => void;

/**
 * Az adatréteg szerződése. Két megvalósítás van:
 *  - LocalRepo: demó mód, a böngészőben tárolva (nincs szerver).
 *  - FirebaseRepo: éles mód, Firestore – minden felhasználó ugyanazt látja.
 * A felület minden része csak ezen az interfészen keresztül ír/olvas.
 */
export interface Repo {
  readonly mode: "demo" | "firebase";
  subscribePlaces(cb: (places: Place[]) => void): Unsubscribe;
  subscribeReports(cb: (reports: Report[]) => void): Unsubscribe;
  savePlace(place: Place, by: AppUser): Promise<void>;
  addReport(report: Omit<Report, "id">): Promise<void>;
  voteReport(reportId: string, uid: string, vote: "confirm" | "deny"): Promise<void>;
  confirmDrinkPrice(placeId: string, drinkId: string, uid: string): Promise<void>;
  getProfile(uid: string): Promise<TasteProfile | undefined>;
  saveProfile(uid: string, profile: TasteProfile): Promise<void>;
  /** Csak demó módban: minden adat visszaállítása. */
  reset?(): Promise<void>;
}
