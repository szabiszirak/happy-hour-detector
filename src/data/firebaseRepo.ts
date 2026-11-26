import {
  addDoc,
  deleteDoc,
  writeBatch,
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
import type { AppUser, Place, PlacePhoto, Report, TasteProfile } from "../domain/types";
import type { Repo, ReviewApi, Unsubscribe } from "./repo";
import { getFirebaseApp } from "./firebase";
import { migrateProfile } from "../domain/tasteProfile";
import {
  checkPlaceEdit,
  reviewClaim,
  validateUpload,
  withdrawClaim,
  type ClaimDocKind,
  type ClaimDocument,
  type OwnerClaim,
  type OwnerIndex,
  type PlaceOwner,
} from "../domain/ownership";
import { decidePromotion, type DrinkPromotion } from "../domain/pricing";
import { parseOwnerAccount, type OwnerAccount } from "../domain/account";
import { AVATAR_LIMITS, parseAvatarSettings, validateAvatarFile, type AvatarPref, type AvatarSettings } from "../domain/avatar";
import { dataUrlToBlob, squareAvatar } from "./imagePreview";

/** A Firestore nem fogad el `undefined` mezőt – kiszűrjük mentés előtt. */
const clean = <T,>(o: T): T => JSON.parse(JSON.stringify(o));

/**
 * Éles adatréteg Firestore-ral.
 * Gyűjtemények: places/{placeId}, reports/{reportId}, users/{uid},
 *   claims/{claimId}, owners/{placeId} (csak admin írja), promotions/{promoId}
 * Fájlok (Storage): claims/{uid}/{claimId}/… (privát igazolások), places/{placeId}/photos/… (nyilvános)
 * Jogosultságok: firestore.rules + storage.rules – a kliens itteni ellenőrzései csak a jó hibaüzenetért vannak.
 */
export class FirebaseRepo implements Repo {
  readonly mode = "firebase" as const;
  /** Az utolsó ismert kocsmáros-lista – csak a kliensoldali előellenőrzéshez. */
  private owners: OwnerIndex = {};
  private places = new Map<string, Place>();
  private constructor(private db: Firestore) {}

  static async create(): Promise<FirebaseRepo> {
    const app = await getFirebaseApp();
    return new FirebaseRepo(getFirestore(app));
  }

  subscribePlaces(cb: (p: Place[]) => void): Unsubscribe {
    return onSnapshot(collection(this.db, "places"), (snap) =>
      {
        const list = snap.docs.map((d) => ({ ...(d.data() as Omit<Place, "id">), id: d.id }));
        this.places = new Map(list.map((p) => [p.id, p]));
        cb(list);
      },
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
    const check = checkPlaceEdit(by.uid, this.places.get(place.id), place, this.owners);
    if (!check.ok) throw new Error(check.reason);
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
    // A megerősítés külön mezőbe megy (confirmations.<drinkId>), így ellenőrzött helynél sem írja az itallapot.
    const ref = doc(this.db, "places", placeId);
    await runTransaction(this.db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const place = { ...(snap.data() as Place), id: placeId };
      const drink = place.drinks.find((d) => d.id === drinkId);
      if (!drink) return;
      const prev = place.confirmations?.[drinkId];
      const stale = prev && drink.updatedAt !== undefined && drink.updatedAt > prev.lastAt;
      tx.update(ref, { [`confirmations.${drinkId}`]: { count: (stale || !prev ? 0 : prev.count) + 1, lastAt: Date.now() } });
    });
    // Statisztika a felhasználónak (jelvényekhez: „Árvadász”).
    await setDoc(doc(this.db, "users", uid), { priceConfirmations: increment(1) }, { merge: true });
  }

  async getProfile(uid: string) {
    const snap = await getDoc(doc(this.db, "users", uid));
    return snap.exists() ? migrateProfile(snap.data().profile) : undefined;
  }

  async saveProfile(uid: string, profile: TasteProfile) {
    await setDoc(doc(this.db, "users", uid), { profile }, { merge: true });
  }

  // ---- kocsmáros profil ----

  subscribeAvatar(uid: string, cb: (s: AvatarSettings) => void): Unsubscribe {
    return onSnapshot(doc(this.db, "users", uid), (snap) => cb(parseAvatarSettings(snap.data()?.avatar)));
  }

  private async currentAvatar(uid: string): Promise<AvatarSettings> {
    return parseAvatarSettings((await getDoc(doc(this.db, "users", uid))).data()?.avatar);
  }

  async setAvatar(uid: string, file: File) {
    const err = validateAvatarFile({ mime: file.type, size: file.size });
    if (err) throw new Error(err);
    const dataUrl = await squareAvatar(file, AVATAR_LIMITS.sizePx, 0.82);
    if (!dataUrl) throw new Error("Nem sikerült beolvasni a képet.");
    const blob = dataUrlToBlob(dataUrl);
    if (blob.size > AVATAR_LIMITS.maxStoredBytes) throw new Error("A kép túl nagy.");
    const { st, storage } = await this.storage();
    const path = `avatars/${uid}.jpg`;
    const r = st.ref(storage, path);
    await st.uploadBytes(r, blob, { contentType: "image/jpeg" });
    const url = await st.getDownloadURL(r);
    await setDoc(doc(this.db, "users", uid), { avatar: { pref: "auto", custom: { url, storagePath: path, updatedAt: Date.now() } } }, { mergeFields: ["avatar"] });
  }

  async clearAvatar(uid: string) {
    const cur = await this.currentAvatar(uid);
    if (cur.custom?.storagePath) {
      const { st, storage } = await this.storage();
      await st.deleteObject(st.ref(storage, cur.custom.storagePath)).catch(() => {});
    }
    await setDoc(doc(this.db, "users", uid), { avatar: { pref: cur.pref } }, { mergeFields: ["avatar"] });
  }

  async setAvatarPref(uid: string, pref: AvatarPref) {
    const cur = await this.currentAvatar(uid);
    await setDoc(doc(this.db, "users", uid), { avatar: { ...cur, pref } }, { mergeFields: ["avatar"] }); // a teljes avatar-mezőt cseréli
  }

  subscribeOwnerAccount(uid: string, cb: (a: OwnerAccount | undefined) => void): Unsubscribe {
    return onSnapshot(doc(this.db, "users", uid), (snap) => cb(parseOwnerAccount(snap.data()?.ownerAccount, uid)));
  }

  async createOwnerAccount(account: OwnerAccount) {
    const { uid, ...rest } = account;
    await setDoc(doc(this.db, "users", uid), { ownerAccount: rest }, { merge: true });
  }

  newId(kind: "claims" | "promotions") {
    return doc(collection(this.db, kind)).id;
  }

  subscribeOwners(cb: (o: OwnerIndex) => void): Unsubscribe {
    return onSnapshot(collection(this.db, "owners"), (snap) => {
      this.owners = Object.fromEntries(snap.docs.map((d) => [d.id, d.data() as PlaceOwner]));
      cb(this.owners);
    });
  }

  subscribeMyClaims(uid: string, cb: (c: OwnerClaim[]) => void): Unsubscribe {
    const q = query(collection(this.db, "claims"), where("uid", "==", uid));
    return onSnapshot(q, (snap) =>
      cb(snap.docs.map((d) => ({ ...(d.data() as OwnerClaim), id: d.id })).sort((a, b) => b.createdAt - a.createdAt)),
    );
  }

  private async storage() {
    const app = await getFirebaseApp();
    const st = await import("firebase/storage");
    return { st, storage: st.getStorage(app) };
  }

  async uploadClaimDocument(uid: string, claimId: string, file: File, kind: ClaimDocKind): Promise<ClaimDocument> {
    const err = validateUpload({ name: file.name, mime: file.type, size: file.size }, 0);
    if (err) throw new Error(err);
    const { st, storage } = await this.storage();
    const id = doc(collection(this.db, "claims")).id;
    const path = `claims/${uid}/${claimId}/${id}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
    await st.uploadBytes(st.ref(storage, path), file, { contentType: file.type });
    // Letöltési URL-t NEM tárolunk: az igazolást csak a feltöltő és az admin érheti el (storage.rules).
    return { id, kind, name: file.name, mime: file.type, size: file.size, storagePath: path, uploadedAt: Date.now() };
  }

  async submitClaim(claim: OwnerClaim) {
    const { id, ...rest } = claim;
    await setDoc(doc(this.db, "claims", id), clean(rest));
  }

  async withdrawClaim(claimId: string, uid: string) {
    const ref = doc(this.db, "claims", claimId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const next = withdrawClaim({ ...(snap.data() as OwnerClaim), id: claimId }, uid, Date.now());
    await updateDoc(ref, { status: next.status, reviewedAt: next.reviewedAt });
  }

  async uploadPlacePhoto(placeId: string, file: File, by: AppUser): Promise<PlacePhoto> {
    if (this.owners[placeId]?.uid !== by.uid) throw new Error("Fotót csak a hely ellenőrzött kocsmárosa tölthet fel.");
    const { st, storage } = await this.storage();
    const id = doc(collection(this.db, "places")).id;
    const path = `places/${placeId}/photos/${id}`;
    const r = st.ref(storage, path);
    await st.uploadBytes(r, file, { contentType: file.type });
    return { id, url: await st.getDownloadURL(r), storagePath: path, addedAt: Date.now() };
  }

  // ---- kiemelések ----

  subscribePromotions(user: AppUser, cb: (p: DrinkPromotion[]) => void): Unsubscribe {
    const col = collection(this.db, "promotions");
    const toList = (docs: { id: string; data: () => unknown }[]) => docs.map((d) => ({ ...(d.data() as DrinkPromotion), id: d.id }));
    if (user.isAdmin) return onSnapshot(col, (snap) => cb(toList(snap.docs)));
    // A szabályok miatt két lekérdezés: a mindenkinek látható aktívak + a saját kérések.
    let active: DrinkPromotion[] = [];
    let mine: DrinkPromotion[] = [];
    const emit = () => cb([...new Map([...active, ...mine].map((p) => [p.id, p])).values()]);
    const u1 = onSnapshot(query(col, where("status", "==", "active")), (s) => ((active = toList(s.docs)), emit()));
    const u2 = onSnapshot(query(col, where("requestedBy", "==", user.uid)), (s) => ((mine = toList(s.docs)), emit()));
    return () => {
      u1();
      u2();
    };
  }

  async requestPromotion(promo: DrinkPromotion) {
    const { id, ...rest } = promo;
    await setDoc(doc(this.db, "promotions", id), clean(rest));
  }

  async cancelPromotionRequest(promoId: string, _uid: string) {
    await deleteDoc(doc(this.db, "promotions", promoId));
  }

  reviewer(user: AppUser): ReviewApi | undefined {
    if (!user.isAdmin) return undefined;
    const me = { uid: user.uid, isAdmin: true };
    return {
      label: "Admin – ellenőrzés",
      subscribePendingClaims: (cb) =>
        onSnapshot(query(collection(this.db, "claims"), where("status", "==", "pending")), (snap) =>
          cb(snap.docs.map((d) => ({ ...(d.data() as OwnerClaim), id: d.id }))),
        ),
      documentUrl: async (d) => {
        if (!d.storagePath) return d.previewUrl;
        const { st, storage } = await this.storage();
        return st.getDownloadURL(st.ref(storage, d.storagePath));
      },
      reviewClaim: async (claimId, decision) => {
        const ref = doc(this.db, "claims", claimId);
        const snap = await getDoc(ref);
        if (!snap.exists()) throw new Error("Nincs ilyen igénylés.");
        const r = reviewClaim({ ...(snap.data() as OwnerClaim), id: claimId }, decision, me, this.owners, Date.now());
        const batch = writeBatch(this.db);
        batch.update(ref, clean({ status: r.claim.status, reviewedAt: r.claim.reviewedAt, reviewedBy: r.claim.reviewedBy, reviewNote: r.claim.reviewNote }));
        if (r.owner) batch.set(doc(this.db, "owners", r.owner.placeId), r.owner);
        await batch.commit();
      },
      decidePromotion: async (promoId, decision, note) => {
        const ref = doc(this.db, "promotions", promoId);
        const snap = await getDoc(ref);
        if (!snap.exists()) throw new Error("Nincs ilyen kérés.");
        const next = decidePromotion({ ...(snap.data() as DrinkPromotion), id: promoId }, decision, me, Date.now(), note);
        await updateDoc(ref, clean({ status: next.status, activatedAt: next.activatedAt, activatedBy: next.activatedBy, reviewNote: next.reviewNote }));
      },
    };
  }
}
