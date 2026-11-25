import { createContext, useContext } from "react";
import type { AppUser, LatLng, Place, Report, TasteProfile } from "./domain/types";
import type { Repo } from "./data/repo";

export interface AppCtx {
  repo: Repo;
  user: AppUser;
  profile: TasteProfile;
  places: Place[];
  reports: Report[];
  now: Date;
  pos: LatLng;
  setPos: (p: LatLng) => void;
  openPlace: (id: string) => void;
  toast: (msg: string) => void;
  /** Keresési kör sugara méterben (a `pos` körül). */
  radiusM: number;
  setRadiusM: (m: number) => void;
  /** „Csak nyitva” – a `now` időpontra (most, vagy a fejlécben beállított nap/óra). */
  openOnly: boolean;
  setOpenOnly: (v: boolean) => void;
}

export const Ctx = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("AppCtx hiányzik");
  return c;
}
