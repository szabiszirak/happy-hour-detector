import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { auth } from "./auth/auth";
import { createRepo } from "./data";
import type { Repo } from "./data/repo";
import { Ctx, type AppCtx } from "./context";
import { DEFAULT_POSITION, formatDistance, isInsidePolygon, MVP_POLYGON } from "./domain/geo";
import { classifyError, classifyFix, type GeoStatus } from "./domain/location";
import { DEFAULT_FILTER, searchDrinks, type DrinkFilter } from "./domain/search";
import { happyHourStatus } from "./domain/happyHour";
import { describeProfile } from "./domain/tasteProfile";
import { describeBudgets } from "./domain/priceBudget";
import type { AppUser, LatLng, Place, Report, TasteProfile } from "./domain/types";
import type { OwnerClaim, OwnerIndex } from "./domain/ownership";
import { livePromotionIndex, type DrinkPromotion } from "./domain/pricing";
import { ClaimFlow } from "./components/ClaimFlow";
import { OwnerDashboard } from "./components/OwnerDashboard";
import { ReviewPanel } from "./components/ReviewPanel";
import { Avatar, AvatarPicker, useAvatarSettings } from "./components/Avatar";
import { capabilities, type AccountMode, type OwnerAccount } from "./domain/account";
import type { Review } from "./domain/reviews";
import { clearAccountMode, loadAccountMode, saveAccountMode } from "./auth/accountMode";

/** Kocsmáros fiókban nincs ízlésprofil-kérdés – semleges profil a listák számításához. */
const NEUTRAL_PROFILE: TasteProfile = { version: 3, categories: [], prefs: {}, budgets: {}, completedAt: 0 };
import { LoginScreen, Onboarding } from "./components/Onboarding";
import { MapView, MARKER_COLORS } from "./components/MapView";
import { DrinksTab, HappyHourTab, PlacesTab } from "./components/Lists";
import { FilterBar } from "./components/FilterBar";
import { DEFAULT_RADIUS_M } from "./domain/searchArea";
import { PlaceSheet } from "./components/PlaceSheet";
import { PlaceEditor } from "./components/PlaceEditor";

type Tab = "places" | "hh" | "drinks";
type PickPurpose = "position" | "newPlace" | null;

const DAY_NAMES = ["Hétfő", "Kedd", "Szerda", "Csütörtök", "Péntek", "Szombat", "Vasárnap"];

/** Idő-szimuláció a demóhoz: „mi lenne péntek 17:30-kor?” */
function simulatedDate(sim: { day: number; time: string } | null): Date {
  const real = new Date();
  if (!sim) return real;
  const d = new Date(real);
  const curIso = ((real.getDay() + 6) % 7) + 1;
  d.setDate(real.getDate() + (sim.day - curIso));
  const [h, m] = sim.time.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

export default function App() {
  const [repo, setRepo] = useState<Repo | null>(null);
  const [user, setUser] = useState<AppUser | null | undefined>(undefined);
  const [profile, setProfile] = useState<TasteProfile | null | undefined>(undefined);
  const [editProfile, setEditProfile] = useState(false);
  const [initErr, setInitErr] = useState<string | null>(null);
  const [accountMode, setAccountModeState] = useState<AccountMode>(loadAccountMode);
  const [freshLogin, setFreshLogin] = useState(false);
  const setAccountMode = useCallback((m: AccountMode) => {
    saveAccountMode(m);
    setAccountModeState(m);
  }, []);

  useEffect(() => {
    createRepo().then(setRepo).catch((e) => {
      console.error(e);
      setInitErr("Nem sikerült csatlakozni az adatbázishoz.");
    });
    return auth.onChange(setUser);
  }, []);

  useEffect(() => {
    if (!repo || !user) {
      setProfile(user === null ? null : undefined);
      return;
    }
    let live = true;
    repo.getProfile(user.uid).then((p) => live && setProfile(p ?? null));
    return () => {
      live = false;
    };
  }, [repo, user]);

  if (initErr) return <div className="center error">{initErr}</div>;
  if (!repo || user === undefined) return <div className="center muted">Betöltés…</div>;
  if (!user)
    return (
      <LoginScreen
        mode={auth.mode}
        onLogin={async (n, m) => {
          // előbb a fiók, hogy kocsmárosként ne villanjon fel az ízlésprofil-kérdés
          setAccountMode(m);
          setFreshLogin(true);
          await auth.signInWithGoogle(n);
        }}
      />
    );
  if (profile === undefined) return <div className="center muted">Betöltés…</div>;
  const saveProfile = async (p: TasteProfile) => {
    await repo.saveProfile(user.uid, p);
    setProfile(p);
    setEditProfile(false);
  };
  // vendég fiókban az első belépéskor ízlésprofil-kérdések; kocsmáros fiókban nincs rá szükség
  if (!profile && accountMode === "guest")
    return <Onboarding name={user.displayName} onDone={saveProfile} avatarSlot={<AvatarPicker repo={repo} user={user} />} />;

  return (
    <>
      <Main
        repo={repo}
        user={user}
        profile={profile ?? NEUTRAL_PROFILE}
        onEditProfile={() => setEditProfile(true)}
        accountMode={accountMode}
        setAccountMode={setAccountMode}
        openOwnerOnStart={freshLogin && accountMode === "owner"}
        onSignOut={async () => {
          clearAccountMode();
          setAccountModeState("guest");
          setFreshLogin(false);
          await auth.signOut();
        }}
      />
      {/* módosítás: ablakként a főképernyő fölött, hogy a kör, az időpont és a szűrők megmaradjanak */}
      {editProfile && profile && (
        <div className="onb-overlay" role="dialog" aria-label="Ízlésprofil módosítása">
          <Onboarding name={user.displayName} initial={profile} onCancel={() => setEditProfile(false)} onDone={saveProfile} />
        </div>
      )}
    </>
  );
}

function Main({
  repo,
  user,
  profile,
  onEditProfile,
  accountMode,
  setAccountMode,
  openOwnerOnStart,
  onSignOut,
}: {
  repo: Repo;
  user: AppUser;
  profile: TasteProfile;
  onEditProfile: () => void;
  accountMode: AccountMode;
  setAccountMode: (m: AccountMode) => void;
  openOwnerOnStart: boolean;
  onSignOut: () => Promise<void>;
}) {
  const [places, setPlaces] = useState<Place[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [tab, setTab] = useState<Tab>("places");
  const [filter, setFilter] = useState<DrinkFilter>(DEFAULT_FILTER);
  const [pos, setPos] = useState<LatLng>(DEFAULT_POSITION);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Place | null>(null);
  const [pick, setPick] = useState<PickPurpose>(null);
  const [sim, setSim] = useState<{ day: number; time: string } | null>(null);
  const [tick, setTick] = useState(0);
  const [menu, setMenu] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [geo, setGeo] = useState<GeoStatus>({ kind: "idle" });
  const [radiusM, setRadiusM] = useState<number>(DEFAULT_RADIUS_M);
  const [openOnly, setOpenOnly] = useState(false);
  const [recenterKey, setRecenterKey] = useState(0);
  const [owners, setOwners] = useState<OwnerIndex>({});
  const [promotions, setPromotions] = useState<DrinkPromotion[]>([]);
  const [myClaims, setMyClaims] = useState<OwnerClaim[]>([]);
  const [claimPlaceId, setClaimPlaceId] = useState<string | null>(null);
  const [ownerOpen, setOwnerOpen] = useState(openOwnerOnStart);
  const [ownerAccount, setOwnerAccount] = useState<OwnerAccount | undefined>(undefined);
  /** „Válaszd ki a helyed” sáv a kocsmáros felületről indítva. */
  const [pickClaim, setPickClaim] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarSettings = useAvatarSettings(repo, user.uid);
  const [reviewOpen, setReviewOpen] = useState(false);
  const reviewer = useMemo(() => repo.reviewer(user), [repo, user]);
  const followRef = useRef(true); // kézi megadás után nem írjuk felül a GPS-szel
  const watchRef = useRef<number | null>(null);
  const firstFixRef = useRef(true);

  useEffect(() => repo.subscribePlaces(setPlaces), [repo]);
  useEffect(() => repo.subscribeReports(setReports), [repo]);
  useEffect(() => repo.subscribeOwners(setOwners), [repo]);
  useEffect(() => repo.subscribePromotions(user, setPromotions), [repo, user]);
  useEffect(() => repo.subscribeMyClaims(user.uid, setMyClaims), [repo, user.uid]);
  useEffect(() => repo.subscribeOwnerAccount(user.uid, setOwnerAccount), [repo, user.uid]);
  const [reviews, setReviews] = useState<Review[]>([]);
  useEffect(() => repo.subscribeReviews(setReviews), [repo]);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const now = useMemo(() => simulatedDate(sim), [sim, tick]);
  const toast = useCallback((m: string) => {
    setToastMsg(m);
    setTimeout(() => setToastMsg(null), 2600);
  }, []);
  const openPlace = useCallback((id: string) => setOpenId(id), []);
  const openClaim = useCallback((id: string) => {
    setOpenId(null);
    setPickClaim(false);
    setClaimPlaceId(id);
  }, []);
  const openOwnerDashboard = useCallback(() => {
    setOpenId(null);
    setOwnerOpen(true);
  }, []);
  const caps = useMemo(() => capabilities(accountMode, user.uid, ownerAccount, owners), [accountMode, user.uid, ownerAccount, owners]);
  const switchMode = (m: AccountMode) => {
    setMenu(false);
    setPickClaim(false);
    setOwnerOpen(m === "owner");
    setAccountMode(m);
    toast(m === "owner" ? "Kocsmáros fiókra váltottál." : "Vendég fiókra váltottál.");
  };
  // A fizetett kiemelési időszak valós időhöz kötött (az időpont-szimuláció nem hosszabbítja / indítja el).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const livePromos = useMemo(() => livePromotionIndex(promotions, places, owners, Date.now()), [promotions, places, owners, tick]);

  const ctx: AppCtx = {
    repo, user, profile, places, reports, now, pos, setPos, openPlace, toast, radiusM, setRadiusM, openOnly, setOpenOnly,
    owners, promotions, livePromos, myClaims, openClaim, accountMode, ownerAccount, caps, openOwnerDashboard, reviews,
  };
  const timeLabel = sim ? `${DAY_NAMES[sim.day - 1]} ${sim.time}` : null;

  const highlight = useMemo(() => {
    if (tab === "places") return undefined;
    if (tab === "hh") return new Set(places.filter((p) => happyHourStatus(p, now).kind !== "none").map((p) => p.id));
    return new Set(searchDrinks(places, { ...filter, maxDistanceM: radiusM }, pos, now, profile).map((o) => o.place.id));
  }, [tab, places, filter, pos, now, profile, radiusM]);

  /** Helymeghatározás indítása: a böngésző ilyenkor kér engedélyt (első alkalommal). */
  const startWatch = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setGeo({ kind: "unavailable" });
      return;
    }
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    setGeo({ kind: "asking" });
    firstFixRef.current = true;
    try {
      watchRef.current = navigator.geolocation.watchPosition(
        (g) => {
          const fix = { lat: g.coords.latitude, lng: g.coords.longitude };
          const { usePosition, status } = classifyFix(fix, Math.round(g.coords.accuracy));
          if (!followRef.current) return; // kézzel megadott hely marad
          setGeo(status);
          if (usePosition) {
            setPos(fix);
            if (firstFixRef.current) setRecenterKey((k) => k + 1); // első találatnál a térkép odaugrik
          }
          firstFixRef.current = false;
        },
        (err) => setGeo(classifyError(err.code)),
        { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 },
      );
    } catch {
      setGeo({ kind: "unavailable" });
    }
  }, []);

  // Megnyitáskor elkérjük a helyet, és séta közben követjük.
  useEffect(() => {
    startWatch();
    return () => {
      if (watchRef.current !== null) navigator.geolocation?.clearWatch(watchRef.current);
    };
  }, [startWatch]);

  /** 📍 gomb: követés vissza + a térkép a helyedre ugrik; letiltás esetén kézi megadás. */
  const locate = () => {
    if (geo.kind === "denied") {
      toast("A helyhozzáférés le van tiltva. A böngésző címsorában (🔒) engedélyezheted – addig koppints a térképre, hol vagy.");
      setPick("position");
      return;
    }
    if (geo.kind === "unavailable") {
      followRef.current = true;
      startWatch();
      setPick("position");
      return;
    }
    followRef.current = true;
    if (geo.kind === "tracking") setRecenterKey((k) => k + 1);
    else startWatch();
  };

  const onPick = (lat: number, lng: number) => {
    if (pick === "position") {
      followRef.current = false;
      setPos({ lat, lng });
      setGeo({ kind: "manual" });
      toast("Helyed beállítva.");
    } else if (pick === "newPlace") {
      if (!isInsidePolygon({ lat, lng }, MVP_POLYGON)) {
        toast("Az MVP egyelőre csak a jelölt négyszögön belüli helyeket kezeli.");
        return;
      }
      setDraft({
        id: `p${Date.now().toString(36)}`,
        name: "",
        address: "",
        location: { lat: +lat.toFixed(6), lng: +lng.toFixed(6) },
        vibes: [],
        drinks: [],
        happyHours: [],
      });
    }
    setPick(null);
  };

  const open = places.find((p) => p.id === openId);

  return (
    <Ctx.Provider value={ctx}>
      <div className="app">
        <header className="top">
          <div className="brand">
            <span className="logo">🍺</span>
            <div>
              <strong>Happy Hour Detector</strong>
              <span className="muted small">Fővám – Kálvin – Corvin – Boráros</span>
            </div>
          </div>
          {repo.mode === "demo" && <span className="demo-badge">DEMÓ</span>}
          {accountMode === "owner" && (
            <button className="mode-chip" onClick={() => setOwnerOpen(true)} title="Kocsmáros felület">
              🏪 Kocsmáros<span className="mode-chip-long"> fiók</span>
            </button>
          )}
          <button className="avatar" onClick={() => setMenu((m) => !m)} aria-label="Menü">
            <Avatar user={user} settings={avatarSettings} size={34} />
          </button>
          {menu && (
            <div className="menu" onMouseLeave={() => setMenu(false)}>
              <div className="menu-head">
                <Avatar user={user} settings={avatarSettings} size={40} />
                <strong>{user.displayName}</strong>
              </div>
              <p>
                <span className={`mode-label ${accountMode}`}>{accountMode === "owner" ? "🏪 Kocsmáros fiók" : "🍺 Vendég fiók"}</span>
                <br />
                {accountMode === "guest" ? (
                  <span className="muted small">
                    Ízlés: {describeProfile(profile)}
                    {describeBudgets(profile) && (
                      <>
                        <br />
                        Keret: {describeBudgets(profile)}
                      </>
                    )}
                  </span>
                ) : (
                  <span className="muted small">{ownerAccount ? ownerAccount.contactEmail : "A kocsmáros fiók még nincs létrehozva"}</span>
                )}
              </p>
              {accountMode === "guest" ? (
                <>
                  <button onClick={onEditProfile}>Ízlésprofil módosítása</button>
                  <button onClick={() => switchMode("owner")}>🏪 Váltás kocsmáros fiókra</button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setMenu(false);
                      setOwnerOpen(true);
                    }}
                  >
                    🏪 Kocsmáros felület{caps.managedPlaceIds.length ? " ✓" : myClaims.some((c) => c.status === "pending") ? " · függőben" : ""}
                  </button>
                  <button onClick={() => switchMode("guest")}>🍺 Váltás vendég fiókra</button>
                </>
              )}
              {reviewer && (
                <button
                  onClick={() => {
                    setMenu(false);
                    setReviewOpen(true);
                  }}
                >
                  🛡️ {reviewer.label}
                </button>
              )}
              {repo.reset && (
                <button
                  onClick={async () => {
                    await repo.reset!();
                    setMenu(false);
                    toast("Demó adatok visszaállítva.");
                  }}
                >
                  Demó adatok visszaállítása
                </button>
              )}
              <button
                onClick={() => {
                  setMenu(false);
                  setAvatarOpen(true);
                }}
              >
                📷 Profilkép
              </button>
              <button onClick={onSignOut}>Kijelentkezés</button>
            </div>
          )}
        </header>

        <div className="layout">
          <div className="map-col">
            <MapView
              highlightIds={highlight}
              pickMode={pick !== null}
              onPick={onPick}
              accuracy={geo.kind === "tracking" ? geo.accuracy : undefined}
              radiusM={radiusM}
              openOnly={openOnly}
              recenterKey={recenterKey}
            />
            <GeoChip geo={geo} onClick={locate} />
            {pick && (
              <div className="pick-banner">
                {pick === "position" ? "Koppints oda, ahol most vagy" : "Koppints a térképen az új hely helyére"}
                <button className="mini" onClick={() => setPick(null)}>
                  Mégse
                </button>
              </div>
            )}
            <div className="map-tools">
              <button className="fab" onClick={locate} title="Saját hely">
                📍
              </button>
              <button className="fab" onClick={() => setPick("newPlace")} title="Új hely beküldése">
                ＋
              </button>
            </div>
            <div className="legend">
              <span>
                <i style={{ background: MARKER_COLORS.active }} /> HH most
              </span>
              <span>
                <i style={{ background: MARKER_COLORS.open }} /> nyitva
              </span>
              <span>
                <i style={{ background: MARKER_COLORS.closed }} /> zárva / ismeretlen
              </span>
              <span>
                <i className="legend-faded" /> körön kívül
              </span>
            </div>
          </div>

          <main className="panel">
            <div className="timebar">
              <span>🕒</span>
              <select
                value={sim ? sim.day : 0}
                onChange={(e) => {
                  const day = Number(e.target.value);
                  setSim(day === 0 ? null : { day, time: sim?.time ?? "17:30" });
                }}
              >
                <option value={0}>Most ({now.toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit" })})</option>
                {DAY_NAMES.map((n, i) => (
                  <option key={n} value={i + 1}>
                    {n}
                  </option>
                ))}
              </select>
              {sim && <input type="time" value={sim.time} onChange={(e) => e.target.value && setSim({ ...sim, time: e.target.value })} />}
              {sim && <span className="muted small">szimulált időpont</span>}
            </div>
            {pickClaim && accountMode === "owner" && (
              <div className="claim-pick-banner" role="status">
                <span>
                  🏪 <strong>Válaszd ki a helyed</strong> a térképen vagy a Kocsmák listában, majd az adatlapján koppints az{" "}
                  <b>Ez az én helyem</b> gombra.
                </span>
                <button className="mini" onClick={() => setPickClaim(false)}>
                  Mégse
                </button>
              </div>
            )}
            <FilterBar farAway={geo.kind === "faraway"} timeLabel={timeLabel} />
            <nav className="tabs" role="tablist">
              <button role="tab" aria-selected={tab === "places"} className={tab === "places" ? "on" : ""} onClick={() => setTab("places")}>
                📍 Kocsmák
              </button>
              <button role="tab" aria-selected={tab === "hh"} className={tab === "hh" ? "on" : ""} onClick={() => setTab("hh")}>
                🍻 Happy Hour
              </button>
              <button role="tab" aria-selected={tab === "drinks"} className={tab === "drinks" ? "on" : ""} onClick={() => setTab("drinks")}>
                🍺 Piák &amp; árak
              </button>
            </nav>
            {tab === "places" ? <PlacesTab /> : tab === "hh" ? <HappyHourTab /> : <DrinksTab filter={filter} setFilter={setFilter} />}
            {repo.mode === "demo" && (
              <p className="fine pad">
                A helyek valódiak (© OpenStreetMap közreműködők + webes források), árak és happy hour időpontok még nincsenek.
                Demó mód: amit felviszel, csak ebben a böngészőben tárolódik.
              </p>
            )}
          </main>
        </div>

        {open && <PlaceSheet place={open} onClose={() => setOpenId(null)} />}
        {draft && <PlaceEditor place={draft} onClose={() => setDraft(null)} />}
        {claimPlaceId && caps.canClaim && places.find((p) => p.id === claimPlaceId) && (
          <ClaimFlow place={places.find((p) => p.id === claimPlaceId)!} myClaims={myClaims} onClose={() => setClaimPlaceId(null)} />
        )}
        {ownerOpen && accountMode === "owner" && (
          <OwnerDashboard
            myClaims={myClaims}
            onClose={() => setOwnerOpen(false)}
            onPickPlace={() => {
              setOwnerOpen(false);
              setTab("places");
              setPickClaim(true);
            }}
          />
        )}
        {reviewOpen && reviewer && <ReviewPanel api={reviewer} onClose={() => setReviewOpen(false)} />}
        {avatarOpen && (
          <div className="sheet-backdrop" onClick={() => setAvatarOpen(false)}>
            <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Profilkép">
              <div className="sheet-head">
                <div className="sheet-title">
                  <h2>Profilkép</h2>
                  <p className="muted small">Ha nem állítasz be képet, a neved kezdőbetűje látszik.</p>
                </div>
                <button className="icon-btn" onClick={() => setAvatarOpen(false)} aria-label="Bezárás">
                  ✕
                </button>
              </div>
              <AvatarPicker repo={repo} user={user} onMessage={toast} />
            </div>
          </div>
        )}
        {toastMsg && <div className="toast">{toastMsg}</div>}
      </div>
    </Ctx.Provider>
  );
}

/** Állapotjelző a térkép tetején: hol tart a helymeghatározás. */
function GeoChip({ geo, onClick }: { geo: GeoStatus; onClick: () => void }) {
  let text: string | null = null;
  let tone = "";
  switch (geo.kind) {
    case "asking":
      text = "📍 Helyed meghatározása…";
      break;
    case "tracking":
      text = `📍 Követünk · ±${geo.accuracy} m`;
      tone = "ok";
      break;
    case "faraway":
      text = `Messze vagy (${formatDistance(geo.distance)}) · a Kálvin térhez mérünk`;
      tone = "warn";
      break;
    case "manual":
      text = "📍 Kézzel megadott hely · követés bekapcsolása";
      break;
    case "denied":
      text = "Helyhozzáférés letiltva – koppints ide";
      tone = "warn";
      break;
    case "unavailable":
      text = "Nem érem el a helyed – koppints ide";
      tone = "warn";
      break;
  }
  if (!text) return null;
  return (
    <button className={`geo-chip ${tone}`} onClick={onClick}>
      {text}
    </button>
  );
}
