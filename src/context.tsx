import { createContext, useContext } from "react";
import type { AppUser, LatLng, Place, Report, TasteProfile } from "./domain/types";
import type { Repo } from "./data/repo";
import type { OwnerClaim, OwnerIndex } from "./domain/ownership";
import type { DrinkPromotion } from "./domain/pricing";
import type { AccountMode, Capabilities, OwnerAccount } from "./domain/account";
import type { Review } from "./domain/reviews";

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
  /** Ellenőrzött kocsmárosok helyenként (owners/{placeId}). */
  owners: OwnerIndex;
  /** Látható kiemelések: az élők + a felhasználó saját kérései. */
  promotions: DrinkPromotion[];
  /** A most élő kiemelések `placeId/drinkId` kulccsal (pricing.livePromotionIndex). */
  livePromos: Map<string, DrinkPromotion>;
  myClaims: OwnerClaim[];
  /** „Ez az én helyem” folyamat megnyitása (csak kocsmáros fiókkal). */
  openClaim: (placeId: string) => void;
  /** Aktív fiók: vendég / kocsmáros (fiókváltással). */
  accountMode: AccountMode;
  ownerAccount: OwnerAccount | undefined;
  /** Mit tehet a felhasználó az aktív fiókjával (domain/account.ts). */
  caps: Capabilities;
  openOwnerDashboard: () => void;
  /** Saját (appbeli) értékelések – Google-értékeléseket nem tárolunk. */
  reviews: Review[];
}

export const Ctx = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("AppCtx hiányzik");
  return c;
}
