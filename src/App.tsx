import { useCallback, useEffect, useMemo, useState } from "react";
import { auth } from "./auth/auth";
import { createRepo } from "./data";
import type { Repo } from "./data/repo";
import { Ctx, type AppCtx } from "./context";
import { DEFAULT_POSITION, isInsidePolygon, MVP_POLYGON } from "./domain/geo";
import { DEFAULT_FILTER, searchDrinks, type DrinkFilter } from "./domain/search";
import { happyHourStatus } from "./domain/happyHour";
import { PRICE_BAND_LABELS, TASTE_LABELS, type AppUser, type LatLng, type Place, type Report, type TasteProfile } from "./domain/types";
import { LoginScreen, Onboarding } from "./components/Onboarding";
import { MapView, MARKER_COLORS } from "./components/MapView";
import { DrinksTab, HappyHourTab } from "./components/Lists";
import { PlaceSheet } from "./components/PlaceSheet";
import { PlaceEditor } from "./components/PlaceEditor";

type Tab = "hh" | "drinks";
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
  if (!user) return <LoginScreen mode={auth.mode} onLogin={(n) => auth.signInWithGoogle(n)} />;
  if (profile === undefined) return <div className="center muted">Betöltés…</div>;
  if (!profile || editProfile)
    return (
      <Onboarding
        name={user.displayName}
        onDone={async (p) => {
          await repo.saveProfile(user.uid, p);
          setProfile(p);
          setEditProfile(false);
        }}
      />
    );

  return <Main repo={repo} user={user} profile={profile} onEditProfile={() => setEditProfile(true)} />;
}

function Main({ repo, user, profile, onEditProfile }: { repo: Repo; user: AppUser; profile: TasteProfile; onEditProfile: () => void }) {
  const [places, setPlaces] = useState<Place[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [tab, setTab] = useState<Tab>("hh");
  const [filter, setFilter] = useState<DrinkFilter>(DEFAULT_FILTER);
  const [pos, setPos] = useState<LatLng>(DEFAULT_POSITION);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Place | null>(null);
  const [pick, setPick] = useState<PickPurpose>(null);
  const [sim, setSim] = useState<{ day: number; time: string } | null>(null);
  const [tick, setTick] = useState(0);
  const [menu, setMenu] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => repo.subscribePlaces(setPlaces), [repo]);
  useEffect(() => repo.subscribeReports(setReports), [repo]);
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

  const ctx: AppCtx = { repo, user, profile, places, reports, now, pos, setPos, openPlace, toast };

  const highlight = useMemo(() => {
    if (tab === "hh") return new Set(places.filter((p) => happyHourStatus(p, now).kind !== "none").map((p) => p.id));
    return new Set(searchDrinks(places, filter, pos, now, profile).map((o) => o.place.id));
  }, [tab, places, filter, pos, now, profile]);

  const locate = () => {
    if (!("geolocation" in navigator)) {
      setPick("position");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (g) => {
        setPos({ lat: g.coords.latitude, lng: g.coords.longitude });
        toast("Megvan a helyed.");
      },
      () => {
        setPick("position");
        toast("Nem érem el a helymeghatározást – koppints a térképre, hol vagy.");
      },
      { timeout: 6000 },
    );
  };

  const onPick = (lat: number, lng: number) => {
    if (pick === "position") {
      setPos({ lat, lng });
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
          <button className="avatar" onClick={() => setMenu((m) => !m)} aria-label="Menü">
            {user.displayName.slice(0, 1).toUpperCase()}
          </button>
          {menu && (
            <div className="menu" onMouseLeave={() => setMenu(false)}>
              <p>
                <strong>{user.displayName}</strong>
                <br />
                <span className="muted small">
                  Ízlés: {profile.categories.map((c) => TASTE_LABELS[c]).join(", ")} · {PRICE_BAND_LABELS[profile.priceBand]}
                </span>
              </p>
              <button onClick={onEditProfile}>Ízlésprofil módosítása</button>
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
              <button onClick={() => auth.signOut()}>Kijelentkezés</button>
            </div>
          )}
        </header>

        <div className="layout">
          <div className="map-col">
            <MapView highlightIds={highlight} pickMode={pick !== null} onPick={onPick} />
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
                <i style={{ background: MARKER_COLORS.upcoming }} /> hamarosan
              </span>
              <span>
                <i style={{ background: MARKER_COLORS.none }} /> nincs
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
            <nav className="tabs" role="tablist">
              <button role="tab" aria-selected={tab === "hh"} className={tab === "hh" ? "on" : ""} onClick={() => setTab("hh")}>
                🍻 Happy Hour
              </button>
              <button role="tab" aria-selected={tab === "drinks"} className={tab === "drinks" ? "on" : ""} onClick={() => setTab("drinks")}>
                🍺 Piák &amp; árak
              </button>
            </nav>
            {tab === "hh" ? <HappyHourTab /> : <DrinksTab filter={filter} setFilter={setFilter} />}
            {repo.mode === "demo" && (
              <p className="fine pad">
                Demó: a helyek és az árak kitaláltak, az adatok csak ebben a böngészőben tárolódnak.
              </p>
            )}
          </main>
        </div>

        {open && <PlaceSheet place={open} onClose={() => setOpenId(null)} />}
        {draft && <PlaceEditor place={draft} onClose={() => setDraft(null)} />}
        {toastMsg && <div className="toast">{toastMsg}</div>}
      </div>
    </Ctx.Provider>
  );
}
