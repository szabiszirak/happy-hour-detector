import { useMemo } from "react";
import { useApp } from "../context";
import { formatDistance, walkMinutes } from "../domain/geo";
import { describeDays, formatMinutes } from "../domain/happyHour";
import { cheapestBeer, formatFt, formatVolume } from "../domain/pricing";
import { reportStatus, timeAgo } from "../domain/reports";
import { activeSponsored, happyHourList, searchDrinks, type DrinkFilter, type SortKey } from "../domain/search";
import { matchScore } from "../domain/match";
import { STYLE_LABELS, type DrinkStyle, type Place } from "../domain/types";

export function SponsoredBlock() {
  const { places, now, openPlace } = useApp();
  const sp = activeSponsored(places, now);
  if (!sp.length) return null;
  return (
    <div className="sponsored-block">
      {sp.map((p) => (
        <button key={p.id} className="sponsored-card" onClick={() => openPlace(p.id)}>
          <span className="tag-sponsored">Szponzorált</span>
          <strong>{p.name}</strong>
          <span className="muted small">{p.sponsored!.tagline}</span>
        </button>
      ))}
    </div>
  );
}

function MatchBadge({ place }: { place: Place }) {
  const { profile, now } = useApp();
  const m = matchScore(place, profile, now);
  return <span className={`match ${m >= 80 ? "hi" : m >= 50 ? "mid" : "lo"}`}>{m}% ízlés</span>;
}

export function HappyHourTab() {
  const { places, now, pos, reports, openPlace } = useApp();
  const list = useMemo(() => happyHourList(places, pos, now), [places, pos, now]);
  const real = Date.now(); // a bejelentések valós időben járnak le, az idő-szimulációtól függetlenül
  const live = reports.filter((r) => reportStatus(r, real) !== "expired").slice(0, 3);
  const active = list.filter((e) => e.status.kind === "active");
  const upcoming = list.filter((e) => e.status.kind === "upcoming");

  return (
    <div className="tab-body">
      <SponsoredBlock />
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
        {active.length === 0 && <p className="empty">Épp sehol nincs happy hour a környéken.</p>}
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
      <section>
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
                <span className="where">{p.name}</span>
              </button>
            ))}
        </div>
      </section>
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
        <strong>{place.name}</strong>
        <MatchBadge place={place} />
      </div>
      <div className="hh-note">{status.slot.note}</div>
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

const STYLE_CHIPS: DrinkStyle[] = ["pilsner", "lager", "ipa", "wheat", "dark", "spritzer", "wine", "longdrink", "shot", "nonalcoholic"];
const DIST_OPTIONS = [
  { v: 500, l: "500 m" },
  { v: 1000, l: "1 km" },
  { v: 2000, l: "2 km" },
  { v: undefined, l: "Bárhol" },
];
const SORTS: { v: SortKey; l: string }[] = [
  { v: "perL", l: "Ft/liter" },
  { v: "price", l: "Ár" },
  { v: "distance", l: "Távolság" },
  { v: "match", l: "Ízlés" },
];

export function DrinksTab({ filter, setFilter }: { filter: DrinkFilter; setFilter: (f: DrinkFilter) => void }) {
  const { places, now, pos, profile, openPlace } = useApp();
  const res = useMemo(() => searchDrinks(places, filter, pos, now, profile), [places, filter, pos, now, profile]);
  const toggleStyle = (s: DrinkStyle) =>
    setFilter({ ...filter, styles: filter.styles.includes(s) ? filter.styles.filter((x) => x !== s) : [...filter.styles, s] });

  return (
    <div className="tab-body">
      <div className="filters">
        <input
          className="search"
          placeholder="Márka vagy ital (pl. Arany Ászok, IPA…)"
          value={filter.brandQuery}
          onChange={(e) => setFilter({ ...filter, brandQuery: e.target.value })}
        />
        <div className="chips scroll">
          {STYLE_CHIPS.map((s) => (
            <button key={s} className={`chip ${filter.styles.includes(s) ? "on" : ""}`} onClick={() => toggleStyle(s)}>
              {STYLE_LABELS[s]}
            </button>
          ))}
        </div>
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
            Távolság
            <select
              value={filter.maxDistanceM ?? ""}
              onChange={(e) => setFilter({ ...filter, maxDistanceM: e.target.value ? Number(e.target.value) : undefined })}
            >
              {DIST_OPTIONS.map((o) => (
                <option key={o.l} value={o.v ?? ""}>
                  {o.l}
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
      <SponsoredBlock />
      <p className="muted small result-count">
        {res.length} találat · organikus sorrend, fizetéssel nem befolyásolható
      </p>
      {res.length === 0 && <p className="empty">Nincs találat ezekkel a szűrőkkel. Lazíts egy kicsit a feltételeken!</p>}
      <ol className="offers">
        {res.slice(0, 60).map((o, i) => (
          <li key={`${o.place.id}-${o.drink.id}`}>
            <button className="offer" onClick={() => openPlace(o.place.id)}>
              <span className="rank">{i + 1}</span>
              <span className="offer-main">
                <strong>{o.drink.name}</strong>
                <span className="muted small">
                  {o.place.name} · {formatDistance(o.distance)} · {formatVolume(o.drink.volumeL)}
                </span>
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
