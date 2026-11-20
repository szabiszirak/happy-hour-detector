import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getFirestore,
  increment,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  type Firestore,
} from "firebase/firestore";
import type { AppUser, Place, Report, TasteProfile } from "../domain/types";
import type { Repo, Unsubscribe } from "./repo";
import { getFirebaseApp } from "./firebase";

/** A Firestore nem fogad el `undefined` mezőt – kiszűrjük mentés előtt. */
const clean = <T,>(o: T): T => JSON.parse(JSON.stringify(o));

/**
 * Éles adatréteg Firestore-ral.
 * Gyűjtemények: places/{placeId}, reports/{reportId}, users/{uid}
 * Jogosultságok: firestore.rules
 */
export class FirebaseRepo implements Repo {
  readonly mode = "firebase" as const;
  private constructor(private db: Firestore) {}

  static async create(): Promise<FirebaseRepo> {
    const app = await getFirebaseApp();
    return new FirebaseRepo(getFirestore(app));
  }

  subscribePlaces(cb: (p: Place[]) => void): Unsubscribe {
    return onSnapshot(collection(this.db, "places"), (snap) =>
      cb(snap.docs.map((d) => ({ ...(d.data() as Omit<Place, "id">), id: d.id }))),
    );
  }

  subscribeReports(cb: (r: Report[]) => void): Unsubscribe {
    // Csak az elmúlt 24 óra bejelentései – a régiek úgyis lejártak.
    const since = Date.now() - 24 * 3600 * 1000;
    const q = query(collection(this.db, "reports"), where("createdAt", ">=", since));
    return onSnapshot(q, (snap) =>
      cb(
        snap.docs
          .map((d) => ({ ...(d.data() as Omit<Report, "id">), id: d.id }))
          .sort((a, b) => b.createdAt - a.createdAt),
      ),
    );
  }

  async savePlace(place: Place, by: AppUser) {
    const { id, ...rest } = place;
    await setDoc(doc(this.db, "places", id), clean({ ...rest, updatedAt: Date.now(), updatedBy: by.uid }));
  }

  async addReport(report: Omit<Report, "id">) {
    await addDoc(collection(this.db, "reports"), clean(report));
  }

  async voteReport(reportId: string, uid: string, vote: "confirm" | "deny") {
    const ref = doc(this.db, "reports", reportId);
    await updateDoc(
      ref,
      vote === "confirm"
        ? { confirms: arrayUnion(uid), denies: arrayRemove(uid) }
        : { denies: arrayUnion(uid), confirms: arrayRemove(uid) },
    );
  }

  async confirmDrinkPrice(placeId: string, drinkId: string, uid: string) {
    const ref = doc(this.db, "places", placeId);
    await runTransaction(this.db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const place = snap.data() as Place;
      const drinks = place.drinks.map((d) =>
        d.id === drinkId ? { ...d, lastConfirmedAt: Date.now(), confirmCount: (d.confirmCount ?? 0) + 1 } : d,
      );
      tx.update(ref, { drinks: clean(drinks), updatedAt: Date.now(), updatedBy: uid });
    });
    // Statisztika a felhasználónak (jelvényekhez: „Árvadász”).
    await setDoc(doc(this.db, "users", uid), { priceConfirmations: increment(1) }, { merge: true });
  }

  async getProfile(uid: string) {
    const snap = await getDoc(doc(this.db, "users", uid));
    return snap.exists() ? (snap.data().profile as TasteProfile | undefined) : undefined;
  }

  async saveProfile(uid: string, profile: TasteProfile) {
    await setDoc(doc(this.db, "users", uid), { profile }, { merge: true });
  }
}
