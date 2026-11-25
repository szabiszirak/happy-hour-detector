import type { AppUser, Place, PlacePhoto, Report, TasteProfile } from "../domain/types";
import { applyVote } from "../domain/reports";
import { migrateProfile } from "../domain/tasteProfile";
import {
  addConfirmation,
  checkPlaceEdit,
  documentsExpired,
  isVerifiedOwner,
  reviewClaim,
  validateUpload,
  withdrawClaim,
  type ClaimDocKind,
  type ClaimDocument,
  type OwnerClaim,
  type OwnerIndex,
  type Reviewer,
} from "../domain/ownership";
import { decidePromotion, type DrinkPromotion } from "../domain/pricing";
import type { Repo, ReviewApi, Unsubscribe } from "./repo";
import { seedPlaces, seedReports } from "./seed";
import { imagePreview, randomId } from "./imagePreview";

const KEY = "hhd.demo.v2"; // v2: valódi helyek (v1 a kitalált demó volt)

interface State {
  places: Place[];
  reports: Report[];
  profiles: Record<string, TasteProfile>;
  claims: OwnerClaim[];
  owners: OwnerIndex;
  promotions: DrinkPromotion[];
}

/** A demó beépített elbírálója – éles módban nincs ilyen, ott a Firebase `admin` claim kell. */
const DEMO_REVIEWER: Reviewer = { uid: "demo-reviewer", isAdmin: true };

function load(): State | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<State>;
    const now = Date.now();
    return {
      places: s.places ?? seedPlaces(),
      reports: s.reports ?? [],
      profiles: s.profiles ?? {},
      owners: s.owners ?? {},
      promotions: s.promotions ?? [],
      // adatvédelem: a döntés után 30 nappal az igazolások előnézete törlődik
      claims: (s.claims ?? []).map((c) => (documentsExpired(c, now) ? { ...c, documents: c.documents.map(({ previewUrl: _p, ...d }) => d) } : c)),
    };
  } catch {
    return null;
  }
}

function persist(s: State) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* privát mód / tele a tároló: memóriában fut tovább */
  }
}

const fresh = (): State => ({ places: seedPlaces(), reports: seedReports(), profiles: {}, claims: [], owners: {}, promotions: [] });

/** Demó adatréteg: localStorage + memória, azonnali értesítéssel. A jogosultságokat a domain függvényei ellenőrzik. */
export class LocalRepo implements Repo {
  readonly mode = "demo" as const;
  private state: State = load() ?? fresh();
  private subs = new Set<() => void>();

  constructor() {
    persist(this.state);
  }

  private set(patch: Partial<State>) {
    this.state = { ...this.state, ...patch };
    persist(this.state);
    this.subs.forEach((f) => f());
  }

  private watch<T>(select: () => T, cb: (v: T) => void): Unsubscribe {
    let last: T | undefined;
    const run = () => {
      const v = select();
      if (v !== last) {
        last = v;
        cb(v);
      }
    };
    this.subs.add(run);
    run();
    return () => this.subs.delete(run);
  }

  subscribePlaces(cb: (p: Place[]) => void): Unsubscribe {
    return this.watch(() => this.state.places, cb);
  }

  subscribeReports(cb: (r: Report[]) => void): Unsubscribe {
    return this.watch(() => this.state.reports, cb);
  }

  async savePlace(place: Place, by: AppUser) {
    const i = this.state.places.findIndex((p) => p.id === place.id);
    const check = checkPlaceEdit(by.uid, i >= 0 ? this.state.places[i] : undefined, place, this.state.owners);
    if (!check.ok) throw new Error(check.reason);
    const stamped = { ...place, updatedAt: Date.now(), updatedBy: by.displayName };
    const places = [...this.state.places];
    if (i >= 0) places[i] = stamped;
    else places.push(stamped);
    this.set({ places });
  }

  async addReport(report: Omit<Report, "id">) {
    this.set({ reports: [{ ...report, id: randomId("r") }, ...this.state.reports] });
  }

  async voteReport(reportId: string, uid: string, vote: "confirm" | "deny") {
    this.set({ reports: this.state.reports.map((r) => (r.id === reportId ? applyVote(r, uid, vote) : r)) });
  }

  async confirmDrinkPrice(placeId: string, drinkId: string, _uid: string) {
    const now = Date.now();
    this.set({ places: this.state.places.map((p) => (p.id === placeId ? addConfirmation(p, drinkId, now) : p)) });
  }

  async getProfile(uid: string) {
    // régi (v1/v2) profilok automatikus átalakítása v3-ra
    return migrateProfile(this.state.profiles[uid]);
  }

  async saveProfile(uid: string, profile: TasteProfile) {
    this.set({ profiles: { ...this.state.profiles, [uid]: profile } });
  }

  // ---- kocsmáros profil ----

  newId(kind: "claims" | "promotions") {
    return randomId(kind === "claims" ? "c" : "pr");
  }

  subscribeOwners(cb: (o: OwnerIndex) => void): Unsubscribe {
    return this.watch(() => this.state.owners, cb);
  }

  subscribeMyClaims(uid: string, cb: (c: OwnerClaim[]) => void): Unsubscribe {
    let prev: OwnerClaim[] | undefined;
    let mine: OwnerClaim[] = [];
    return this.watch(
      () => {
        if (this.state.claims !== prev) {
          prev = this.state.claims;
          mine = this.state.claims.filter((c) => c.uid === uid);
        }
        return mine;
      },
      cb,
    );
  }

  async uploadClaimDocument(_uid: string, _claimId: string, file: File, kind: ClaimDocKind): Promise<ClaimDocument> {
    const err = validateUpload({ name: file.name, mime: file.type, size: file.size }, 0);
    if (err) throw new Error(err);
    // Demó: csak kicsinyített előnézet és metaadat kerül a böngészőbe, az eredeti fájl nem.
    const doc: ClaimDocument = { id: randomId("f"), kind, name: file.name, mime: file.type, size: file.size, uploadedAt: Date.now() };
    const previewUrl = await imagePreview(file, 480, 0.6);
    return previewUrl ? { ...doc, previewUrl } : doc;
  }

  async submitClaim(claim: OwnerClaim) {
    if (claim.status !== "pending" || claim.reviewedBy) throw new Error("Csak függő igénylés küldhető be.");
    if (this.state.owners[claim.placeId]) throw new Error("Ennek a helynek már van ellenőrzött kocsmárosa.");
    this.set({ claims: [claim, ...this.state.claims.filter((c) => c.id !== claim.id)] });
  }

  async withdrawClaim(claimId: string, uid: string) {
    const now = Date.now();
    this.set({ claims: this.state.claims.map((c) => (c.id === claimId ? withdrawClaim(c, uid, now) : c)) });
  }

  async uploadPlacePhoto(placeId: string, file: File, by: AppUser): Promise<PlacePhoto> {
    if (!isVerifiedOwner(by.uid, placeId, this.state.owners)) throw new Error("Fotót csak a hely ellenőrzött kocsmárosa tölthet fel.");
    if (!file.type.startsWith("image/")) throw new Error("Csak kép tölthető fel.");
    const url = await imagePreview(file, 800, 0.7);
    if (!url) throw new Error("Nem sikerült beolvasni a képet.");
    return { id: randomId("ph"), url, addedAt: Date.now() };
  }

  // ---- kiemelések ----

  subscribePromotions(_user: AppUser, cb: (p: DrinkPromotion[]) => void): Unsubscribe {
    return this.watch(() => this.state.promotions, cb);
  }

  async requestPromotion(promo: DrinkPromotion) {
    if (promo.status !== "requested" || promo.activatedBy) throw new Error("Kiemelést csak kérni lehet – aktiválni az elbíráló tud.");
    if (!isVerifiedOwner(promo.requestedBy, promo.placeId, this.state.owners)) throw new Error("Kiemelést csak a hely ellenőrzött kocsmárosa kérhet.");
    this.set({ promotions: [promo, ...this.state.promotions] });
  }

  async cancelPromotionRequest(promoId: string, uid: string) {
    const p = this.state.promotions.find((x) => x.id === promoId);
    if (!p || p.requestedBy !== uid || p.status !== "requested") throw new Error("Csak a saját, még el nem bírált kérésed vonhatod vissza.");
    this.set({ promotions: this.state.promotions.filter((x) => x.id !== promoId) });
  }

  reviewer(_user: AppUser): ReviewApi {
    return {
      label: "Ellenőrző (csak demó)",
      subscribePendingClaims: (cb) => this.watch(() => this.state.claims, (all) => cb(all.filter((c) => c.status === "pending"))),
      documentUrl: async (doc) => doc.previewUrl,
      reviewClaim: async (claimId, decision) => {
        const claim = this.state.claims.find((c) => c.id === claimId);
        if (!claim) throw new Error("Nincs ilyen igénylés.");
        const r = reviewClaim(claim, decision, DEMO_REVIEWER, this.state.owners, Date.now());
        this.set({
          claims: this.state.claims.map((c) => (c.id === claimId ? r.claim : c)),
          owners: r.owner ? { ...this.state.owners, [r.owner.placeId]: r.owner } : this.state.owners,
        });
      },
      decidePromotion: async (promoId, decision, note) => {
        this.set({
          promotions: this.state.promotions.map((p) => (p.id === promoId ? decidePromotion(p, decision, DEMO_REVIEWER, Date.now(), note) : p)),
        });
      },
    };
  }

  async reset() {
    const profiles = this.state.profiles;
    this.set({ ...fresh(), profiles });
  }
}
