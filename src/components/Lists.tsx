import { useMemo, useState } from "react";
import { useApp } from "../context";
import { PlaceIconTile } from "./PlaceIcon";
import { RatingBadge } from "./Reviews";
import { iconOf } from "../data/placeIcons";
import { formatDistance, walkMinutes } from "../domain/geo";
import { describeDays, formatMinutes, happyHourStatus } from "../domain/happyHour";
import { cheapestBeer, formatFt, formatVolume, rankDrinkOffers } from "../domain/pricing";
import { withinBudget } from "../domain/priceBudget";
import { reportStatus, timeAgo } from "../domain/reports";
import { happyHourList, searchDrinks, type DrinkFilter, type SortKey } from "../domain/search";
import { matchScore } from "../domain/match";
import type { Place } from "../domain/types";
import { CategoryFilter, selectionLabel, BrandIcon } from "./DrinkFilters";
import { brandBadge, canonicalBrand } from "../domain/drinkCatalog";
import { openState, type OpenState } from "../domain/openingHours";
import { distanceM } from "../domain/geo";
import { filterForList } from "../domain/mapVisual";
import { formatRadius, stepRadius } from "../domain/searchArea";

function MatchBadge({ place }: { place: Place }) {
  const { profile, now } = useApp();
  const m = matchScore(place, profile, now);
  return <span className={`match ${m >= 80 ? "hi" : m >= 50 ? "mid" : "lo"}`}>{m}% ízlés</span>;
}

export function HappyHourTab() {
  const { places, now, pos, reports, openPlace } = useApp();
  const { radiusM } = useApp();
  const all = useMemo(() => happyHourList(places, pos, now), [places, pos, now]);
  const list = all.filter((e) => e.distance <= radiusM);
  const hhOutside = all.length - list.length;
  const real = Date.now(); // a bejelentések valós időben járnak le, az idő-szimulációtól függetlenül
  const live = reports.filter((r) => reportStatus(r, real) !== "expired").slice(0, 3);
  const active = list.filter((e) => e.status.kind === "active");
  const upcoming = list.filter((e) => e.status.kind === "upcoming");
  const anyHH = places.some((p) => p.happyHours.length > 0);

  return (
    <div className="tab-body">
      {!anyHH && (
        <div className="empty-card">
          <strong>Még egyetlen helynél sincs megadott happy hour.</strong>
          <span>
            Tudsz egyet? Nyisd meg a helyet a <b>Kocsmák</b> fülön vagy a térképen, és a <b>Szerkesztés</b> gombbal add meg. Ahogy
            bekerülnek az időpontok, itt látszik, hol zajlik most.
          </span>
        </div>
      )}
      {live.length > 0 && (
        <section>
          <h3 className="sec">📣 Friss a közösségtől</h3>
          {live.map((r) => {
            const p = places.find((x) => x.id === r.placeId);
            return (
              <button key={r.id} className="report-mini" onClick={() => p && openPlace(p.id)}>
                <span>
                  <span className="who">{r.userName}</span> · <strong>{p?.name ?? "?"}</strong>
                </span>
                <span className="txt">„{r.text}”</span>
                <span className="muted small">
                  {timeAgo(r.createdAt, real)} · 👍 {r.confirms.length}
                </span>
              </button>
            );
          })}
        </section>
      )}
      <section>
        <h3 className="sec">🍻 Most zajlik ({active.length})</h3>
        {anyHH && active.length === 0 && <p className="empty">Épp sehol nincs happy hour a környéken.</p>}
        {active.map((e) => (
          <HHCard key={e.place.id} place={e.place} distance={e.distance} status={e.status} />
        ))}
      </section>
      {upcoming.length > 0 && (
        <section>
          <h3 className="sec">⏳ Hamarosan indul</h3>
          {upcoming.map((e) => (
            <HHCard key={e.place.id} place={e.place} distance={e.distance} status={e.status} />
          ))}
        </section>
      )}
      {anyHH && <section>
        <h3 className="sec">📅 Összes happy hour a környéken</h3>
        <div className="schedule">
          {places
            .flatMap((p) => p.happyHours.map((h) => ({ p, h })))
            .sort((a, b) => a.h.start.localeCompare(b.h.start))
            .map(({ p, h }) => (
              <button key={h.id} className="sched-row" onClick={() => openPlace(p.id)}>
                <span className="when">
                  {describeDays(h.days)} {h.start}–{h.end}
                </span>
                <span className="where">
                  {p.name}
                  {h.isSynthetic && <span className="tag-synthetic">Becsült (nem valós adat)</span>}
                </span>
              </button>
            ))}
        </div>
      </section>}
      <OutsideHint count={hhOutside} />
    </div>
  );
}

function HHCard({
  place,
  distance,
  status,
}: {
  place: Place;
  distance: number;
  status: ReturnType<typeof happyHourList>[number]["status"];
}) {
  const { now, openPlace } = useApp();
  const beer = cheapestBeer(place, now);
  return (
    <button className={`card ${status.kind}`} onClick={() => openPlace(place.id)}>
      <div className="card-top">
        <PlaceIconTile place={place} size={32} hh={status.kind === "active"} />
        <strong>{place.name}</strong>
        <MatchBadge place={place} />
      </div>
      <div className="hh-note">
        {status.slot.isSynthetic && <span className="tag-synthetic">Becsült (nem valós adat)</span>}{" "}
        {status.slot.note}
      </div>
      <div className="card-meta">
        {status.kind === "active" ? (
          <span className="countdown">⏱ még {formatMinutes(status.minutesLeft)}</span>
        ) : (
          <span className="soon">{formatMinutes(status.minutesUntil)} múlva indul</span>
        )}
        {beer && (
          <span>
            🍺 {formatFt(beer.price)} <span className="muted">({beer.drink.name})</span>
          </span>
        )}
        <span className="muted">
          {formatDistance(distance)} · {walkMinutes(distance)} perc séta
        </span>
      </div>
    </button>
  );
}

const SORTS: { v: SortKey; l: string }[] = [
  { v: "perL", l: "Ft/liter" },
  { v: "price", l: "Ár" },
  { v: "distance", l: "Távolság" },
  { v: "match", l: "Ízlés" },
];

export function DrinksTab({ filter, setFilter }: { filter: DrinkFilter; setFilter: (f: DrinkFilter) => void }) {
  const { places, now, pos, profile, openPlace, radiusM, openOnly, livePromos } = useApp();
  // a közös szűrők (kör + „csak nyitva”) szerinti helyek; a tab saját szűrői ezen belül
  const eligible = useMemo(() => filterForList(places, { center: pos, radiusM, openOnly, now }).shown, [places, pos, radiusM, openOnly, now]);
  const res = useMemo(
    () => searchDrinks(eligible, { ...filter, maxDistanceM: undefined }, pos, now, profile),
    [eligible, filter, pos, now, profile],
  );
  // kiemelés: külön blokk a szűrésnek megfelelő, élő kiemelésekből – az organikus `res` változatlan marad
  const { sponsored } = useMemo(() => rankDrinkOffers(res, livePromos), [res, livePromos]);
  const anyPrice = places.some((p) => p.drinks.length > 0);
  const sel = selectionLabel(filter, places);

  return (
    <div className="tab-body">
      <div className="filters">
        <input
          className="search"
          placeholder="Márka vagy ital (pl. Arany Ászok, IPA…)"
          value={filter.brandQuery}
          onChange={(e) => setFilter({ ...filter, brandQuery: e.target.value })}
        />
        <CategoryFilter places={eligible} filter={filter} setFilter={setFilter} />
        <div className="filter-row">
          <label>
            Max. ár
            <select
              value={filter.maxPrice ?? ""}
              onChange={(e) => setFilter({ ...filter, maxPrice: e.target.value ? Number(e.target.value) : undefined })}
            >
              <option value="">mindegy</option>
              {[600, 800, 1000, 1200, 1500, 2000].map((v) => (
                <option key={v} value={v}>
                  {formatFt(v)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Rendezés
            <select value={filter.sort} onChange={(e) => setFilter({ ...filter, sort: e.target.value as SortKey })}>
              {SORTS.map((s) => (
                <option key={s.v} value={s.v}>
                  {s.l}
                </option>
              ))}
            </select>
          </label>
          <label className="check">
            <input type="checkbox" checked={filter.hhOnly} onChange={(e) => setFilter({ ...filter, hhOnly: e.target.checked })} />
            Csak happy hour
          </label>
        </div>
      </div>
      {sponsored.length > 0 && (
        <section className="sponsored-offers" aria-label="Szponzorált ajánlatok">
          {sponsored.map((o) => (
            <button key={o.promo.id} className="offer sponsored" onClick={() => openPlace(o.place.id)}>
              <span className="tag-sponsored">Szponzorált</span>
              <span className="offer-main">
                <strong>{o.drink.name}</strong>
                <span className="muted small">
                  {o.place.name} · {formatDistance(o.distance)}
                  {o.promo.tagline ? ` · ${o.promo.tagline}` : ""}
                </span>
              </span>
              <span className="offer-price">
                <strong className={o.isHH ? "hh-price" : ""}>{formatFt(o.price)}</strong>
                <span className="muted small">{formatVolume(o.drink.volumeL)}</span>
              </span>
            </button>
          ))}
        </section>
      )}
      <p className="muted small result-count">
        {res.length} találat · organikus sorrend, fizetéssel nem befolyásolható
      </p>
      {res.length === 0 && !anyPrice && (
        <div className="empty-card">
          <strong>Még nincsenek árak.</strong>
          <span>
            A helyek valódiak, az itallapjuk még üres. Ha tudod, mennyi egy korsó valahol, nyisd meg a helyet, és a{" "}
            <b>Szerkesztés</b> gombbal vidd fel – ettől kezdve itt kereshető.
          </span>
        </div>
      )}
      {res.length === 0 && anyPrice && (
        <p className="empty">
          {sel ? `Ebben a választásban (${sel}) még nincs ár, vagy a többi szűrő kizárja.` : "Nincs találat ezekkel a szűrőkkel."} Lazíts
          egy kicsit a feltételeken!
        </p>
      )}
      <ol className="offers">
        {res.slice(0, 60).map((o, i) => (
          <li key={`${o.place.id}-${o.drink.id}`}>
            <button className="offer" onClick={() => openPlace(o.place.id)}>
              <span className="rank">{i + 1}</span>
              {o.drink.brand && <BrandIcon badge={brandBadge(canonicalBrand(o.drink.brand))} size={28} />}
              <span className="offer-main">
                <strong>{o.drink.name}</strong>
                <span className="muted small">
                  {o.place.name} · {formatDistance(o.distance)} · {formatVolume(o.drink.volumeL)}
                </span>
                {withinBudget(o.drink, o.price, profile) && <span className="budget-ok">keretben</span>}
              </span>
              <span className="offer-price">
                <strong className={o.isHH ? "hh-price" : ""}>{formatFt(o.price)}</strong>
                <span className="muted small">{formatFt(o.perL)}/l</span>
                {o.isHH && <span className="tag-hh">HH</span>}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function OpenBadge({ state }: { state: OpenState }) {
  if (state.kind === "open")
    return <span className="open-badge open">Nyitva {state.closesAt}-ig</span>;
  if (state.kind === "closed")
    return <span className="open-badge closed">{state.opensToday && state.opensAt ? `Zárva · nyit ${state.opensAt}` : "Ma már zárva"}</span>;
  return <span className="open-badge unknown">Nyitvatartás ismeretlen</span>;
}


type PlaceSort = "distance" | "name";

/** „Kocsmák” fül: az összes hely az MVP-területen, távolság szerint. */
export function PlacesTab() {
  const { places, now, pos, openPlace, radiusM, openOnly, owners } = useApp();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<PlaceSort>("distance");
  const norm = (s: string) => s.toLocaleLowerCase("hu-HU").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const { rows, outsideCount } = useMemo(() => {
    const nq = norm(q.trim());
    const searched = places.filter((p) => !nq || norm(`${p.name} ${p.address}`).includes(nq));
    // a közös szűrők: keresési kör + „csak nyitva” a beállított időpontra
    const { shown, outsideCount } = filterForList(searched, { center: pos, radiusM, openOnly, now });
    const rows = shown
      .map((p) => ({ p, d: distanceM(pos, p.location), st: openState(p.info?.openingHours, now) }))
      .sort((a, b) => (sort === "name" ? a.p.name.localeCompare(b.p.name, "hu") : a.d - b.d));
    return { rows, outsideCount };
  }, [places, pos, now, q, openOnly, sort, radiusM]);

  return (
    <div className="tab-body">
      <div className="filters">
        <input className="search" placeholder="Hely vagy utca keresése…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="filter-row">
          <label>
            Rendezés
            <select value={sort} onChange={(e) => setSort(e.target.value as PlaceSort)}>
              <option value="distance">Távolság</option>
              <option value="name">Név</option>
            </select>
          </label>
        </div>
      </div>
      <p className="muted small result-count">
        {rows.length} hely a {formatRadius(radiusM)}-es körben{openOnly ? ", nyitva" : ""}
      </p>
      {rows.length === 0 && (
        <p className="empty">{openOnly ? "A körön belül ilyenkor semmi sincs nyitva." : "A körön belül nincs hely."}</p>
      )}
      <ul className="place-list">
        {rows.map(({ p, d, st }) => {
          const beer = cheapestBeer(p, now);
          const hh = happyHourStatus(p, now);
          return (
            <li key={p.id}>
              <button className={`place-row ${hh.kind === "active" ? "led-hh" : st.kind === "open" ? "led-open" : ""}`} onClick={() => openPlace(p.id)}>
                <PlaceIconTile place={p} size={40} hh={hh.kind === "active"} />
                <span className="place-main">
                  <strong>{p.name}</strong>
                  <span className="muted small">
                    {iconOf(p).label} · {p.address.replace(/^\d{4} Budapest, /, "").replace(/^Budapest, /, "")} · {formatDistance(d)}
                  </span>
                  <span className="place-tags">
                    <OpenBadge state={st} />
                    {hh.kind === "active" && <span className="tag-hh">HH most</span>}
                    <RatingBadge placeId={p.id} />
                    {owners[p.id] && <span className="tag-verified">✓ kocsmáros</span>}
                    {p.info?.checkNeeded && !owners[p.id] && <span className="tag-check">ellenőrizendő</span>}
                  </span>
                </span>
                <span className="place-side">
                  {beer ? (
                    <>
                      <strong>{formatFt(beer.price)}</strong>
                      <span className="muted small">{beer.drink.name}</span>
                    </>
                  ) : (
                    <span className="no-data">nincs még ár</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <OutsideHint count={outsideCount} />
    </div>
  );
}

/** „+N hely a körön kívül” – egy koppintással nagyobb kör. */
function OutsideHint({ count }: { count: number }) {
  const { radiusM, setRadiusM } = useApp();
  if (!count) return null;
  const next = stepRadius(radiusM, 1);
  return (
    <div className="outside-hint">
      <span>+{count} hely a körön kívül</span>
      {next !== radiusM && (
        <button className="mini" onClick={() => setRadiusM(next)}>
          Kör növelése: {formatRadius(next)}
        </button>
      )}
    </div>
  );
}
