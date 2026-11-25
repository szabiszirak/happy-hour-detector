import type { AppUser, Place, Report, TasteProfile } from "../domain/types";
import { applyVote } from "../domain/reports";
import { migrateProfile } from "../domain/tasteProfile";
import type { Repo, Unsubscribe } from "./repo";
import { seedPlaces, seedReports } from "./seed";

const KEY = "hhd.demo.v2"; // v2: valódi helyek (v1 a kitalált demó volt)

interface State {
  places: Place[];
  reports: Report[];
  profiles: Record<string, TasteProfile>;
}

function load(): State | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as State) : null;
  } catch {
    return null;
  }
}

function persist(s: State) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* privát mód / tiltott tároló: memóriában fut tovább */
  }
}

const fresh = (): State => ({ places: seedPlaces(), reports: seedReports(), profiles: {} });

/** Demó adatréteg: localStorage + memória, azonnali értesítéssel. */
export class LocalRepo implements Repo {
  readonly mode = "demo" as const;
  private state: State = load() ?? fresh();
  private placeSubs = new Set<(p: Place[]) => void>();
  private reportSubs = new Set<(r: Report[]) => void>();

  constructor() {
    persist(this.state);
  }

  private emit() {
    persist(this.state);
    this.placeSubs.forEach((cb) => cb(this.state.places));
    this.reportSubs.forEach((cb) => cb(this.state.reports));
  }

  subscribePlaces(cb: (p: Place[]) => void): Unsubscribe {
    this.placeSubs.add(cb);
    cb(this.state.places);
    return () => this.placeSubs.delete(cb);
  }

  subscribeReports(cb: (r: Report[]) => void): Unsubscribe {
    this.reportSubs.add(cb);
    cb(this.state.reports);
    return () => this.reportSubs.delete(cb);
  }

  async savePlace(place: Place, by: AppUser) {
    const stamped = { ...place, updatedAt: Date.now(), updatedBy: by.displayName };
    const i = this.state.places.findIndex((p) => p.id === place.id);
    const places = [...this.state.places];
    if (i >= 0) places[i] = stamped;
    else places.push(stamped);
    this.state = { ...this.state, places };
    this.emit();
  }

  async addReport(report: Omit<Report, "id">) {
    const r: Report = { ...report, id: `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` };
    this.state = { ...this.state, reports: [r, ...this.state.reports] };
    this.emit();
  }

  async voteReport(reportId: string, uid: string, vote: "confirm" | "deny") {
    this.state = {
      ...this.state,
      reports: this.state.reports.map((r) => (r.id === reportId ? applyVote(r, uid, vote) : r)),
    };
    this.emit();
  }

  async confirmDrinkPrice(placeId: string, drinkId: string, _uid: string) {
    this.state = {
      ...this.state,
      places: this.state.places.map((p) =>
        p.id !== placeId
          ? p
          : {
              ...p,
              drinks: p.drinks.map((d) =>
                d.id === drinkId ? { ...d, lastConfirmedAt: Date.now(), confirmCount: (d.confirmCount ?? 0) + 1 } : d,
              ),
            },
      ),
    };
    this.emit();
  }

  async getProfile(uid: string) {
    // régi (v1) profilok automatikus átalakítása v2-re
    return migrateProfile(this.state.profiles[uid]);
  }

  async saveProfile(uid: string, profile: TasteProfile) {
    this.state = { ...this.state, profiles: { ...this.state.profiles, [uid]: profile } };
    this.emit();
  }

  async reset() {
    const profiles = this.state.profiles;
    this.state = { ...fresh(), profiles };
    this.emit();
  }
}
