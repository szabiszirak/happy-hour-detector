import { useState } from "react";
import { useApp } from "../context";
import { distanceM, formatDistance, walkMinutes } from "../domain/geo";
import { describeDays, formatMinutes, happyHourStatus, slotMinutesLeft } from "../domain/happyHour";
import { currentPrice, formatFt, formatVolume, pricePerLiter } from "../domain/pricing";
import { extractPrice, REPORT_STATUS_LABELS, REPORT_TTL_MS, reportStatus, timeAgo } from "../domain/reports";
import { matchScore } from "../domain/match";
import { STYLE_LABELS, VIBE_LABELS, type Place } from "../domain/types";
import { PlaceEditor } from "./PlaceEditor";
import { formatOpeningHours, openState } from "../domain/openingHours";
import { kindLabel, OpenBadge } from "./Lists";

export function PlaceSheet({ place, onClose }: { place: Place; onClose: () => void }) {
  const { repo, user, profile, reports, now, pos, toast } = useApp();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [drinkId, setDrinkId] = useState("");
  const st = happyHourStatus(place, now);
  const dist = distanceM(pos, place.location);
  const match = matchScore(place, profile, now);
  const t = Date.now(); // bejelentések, megerősítések: valós idő
  const placeReports = reports.filter((r) => r.placeId === place.id).sort((a, b) => b.createdAt - a.createdAt);
  const sponsored = place.sponsored && place.sponsored.until > now.getTime();
  const mapsUrl = place.googlePlaceId
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&query_place_id=${place.googlePlaceId}`
    : `https://www.google.com/maps/search/?api=1&query=${place.location.lat},${place.location.lng}`;

  if (editing) return <PlaceEditor place={place} onClose={() => setEditing(false)} />;

  const submitReport = async () => {
    const clean = text.trim();
    if (clean.length < 3) return;
    const drink = place.drinks.find((d) => d.id === drinkId);
    await repo.addReport({
      placeId: place.id,
      userId: user.uid,
      userName: user.displayName.split(" ")[0],
      text: clean.slice(0, 280),
      drinkName: drink?.name,
      price: extractPrice(clean),
      createdAt: Date.now(),
      expiresAt: Date.now() + REPORT_TTL_MS,
      confirms: [],
      denies: [],
    });
    setText("");
    setDrinkId("");
    toast("Bejelentés elküldve – 12 óráig látható.");
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={place.name}>
        <div className="sheet-head">
          <div>
            {sponsored && <span className="tag-sponsored">Szponzorált</span>}
            <h2>{place.name}</h2>
            <p className="muted small">
              {place.address} · {formatDistance(dist)} · {walkMinutes(dist)} perc séta
            </p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Bezárás">
            ✕
          </button>
        </div>

        <div className="sheet-badges">
          <OpenBadge state={openState(place.info?.openingHours, now)} />
          {place.info?.kind && <span className="vibe">{kindLabel(place.info.kind)}</span>}
          {place.drinks.length > 0 && (
            <span className={`match ${match >= 80 ? "hi" : match >= 50 ? "mid" : "lo"}`}>{match}%-ban passzol az ízlésedhez</span>
          )}
          {place.vibes.map((v) => (
            <span key={v} className="vibe">
              {VIBE_LABELS[v]}
            </span>
          ))}
        </div>
        {sponsored && <p className="sponsored-line">{place.sponsored!.tagline}</p>}

        <dl className="facts">
          {place.info?.openingHours && (
            <>
              <dt>Nyitvatartás</dt>
              <dd>{formatOpeningHours(place.info.openingHours)}</dd>
            </>
          )}
          {place.info?.website && (
            <>
              <dt>Weboldal</dt>
              <dd>
                <a href={place.info.website} target="_blank" rel="noreferrer">
                  {place.info.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                </a>
              </dd>
            </>
          )}
          {place.info?.phone && (
            <>
              <dt>Telefon</dt>
              <dd>{place.info.phone}</dd>
            </>
          )}
          <dt>Forrás</dt>
          <dd>
            {place.osmId ? (
              <a href={`https://www.openstreetmap.org/${place.osmId}`} target="_blank" rel="noreferrer">
                © OpenStreetMap közreműködők
              </a>
            ) : (
              place.info?.source?.replace(/^web: /, "web: ") ?? "felhasználói beküldés"
            )}
          </dd>
        </dl>
        {place.info?.checkNeeded && (
          <p className="check-note">
            ⚠️ Ellenőrizendő: webes forrásból vagy étterem/kávézóként van nyilvántartva. Ha jártál itt, erősítsd meg, hogy kocsmaként működik!
          </p>
        )}

        <section>
          <h3 className="sec">Happy Hour</h3>
          {st.kind === "active" && <div className="hh-live">🍻 Most zajlik · még {formatMinutes(st.minutesLeft)}</div>}
          {st.kind === "upcoming" && <div className="hh-soon">⏳ {formatMinutes(st.minutesUntil)} múlva indul</div>}
          {place.happyHours.length === 0 && <p className="empty">Nincs megadott happy hour. Tudsz róla? Szerkeszd!</p>}
          <ul className="slots">
            {place.happyHours.map((h) => (
              <li key={h.id} className={slotMinutesLeft(h, now) !== null ? "live" : ""}>
                <strong>
                  {describeDays(h.days)} {h.start}–{h.end}
                </strong>
                <span>{h.note}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="sec">Itallap</h3>
          {place.drinks.length === 0 && (
            <p className="empty">Még nincs itt ár. Tudod, mennyi egy korsó? A Szerkesztés gombbal felviheted.</p>
          )}
          <table className="drinks">
            <tbody>
              {place.drinks.map((d) => {
                const cp = currentPrice(d, place, now);
                return (
                  <tr key={d.id}>
                    <td>
                      <strong>{d.name}</strong>
                      <span className="muted small">
                        {STYLE_LABELS[d.style]} · {formatVolume(d.volumeL)}
                        {d.lastConfirmedAt ? ` · ✔ ${timeAgo(d.lastConfirmedAt, t)} megerősítve` : ""}
                      </span>
                    </td>
                    <td className="num">
                      <strong className={cp.isHH ? "hh-price" : ""}>{formatFt(cp.price)}</strong>
                      {cp.isHH && <s className="muted small">{formatFt(d.price)}</s>}
                      {!cp.isHH && d.hhPrice !== undefined && <span className="muted small">HH: {formatFt(d.hhPrice)}</span>}
                      <span className="muted small">{formatFt(pricePerLiter(cp.price, d.volumeL))}/l</span>
                    </td>
                    <td>
                      <button
                        className="mini"
                        title="Még mindig ennyi?"
                        onClick={async () => {
                          await repo.confirmDrinkPrice(place.id, d.id, user.uid);
                          toast("Köszi! Az ár megerősítve. 🎖️");
                        }}
                      >
                        ✔ Stimmel
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="muted small">Változott az ár vagy hiányzik egy ital? A Szerkesztés gombbal bárki javíthatja.</p>
        </section>

        <section>
          <h3 className="sec">Közösségi bejelentések</h3>
          <div className="composer">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="pl. Gyertek ide, ma csak 700 Ft az Arany Ászok!"
              maxLength={280}
              rows={2}
            />
            <div className="composer-row">
              <select value={drinkId} onChange={(e) => setDrinkId(e.target.value)}>
                <option value="">Ital (nem kötelező)</option>
                {place.drinks.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <button className="btn primary" disabled={text.trim().length < 3} onClick={submitReport}>
                Bejelentem
              </button>
            </div>
          </div>
          {placeReports.length === 0 && <p className="empty">Még nincs bejelentés. Légy az első!</p>}
          <ul className="reports">
            {placeReports.map((r) => {
              const status = reportStatus(r, t);
              const mine = r.userId === user.uid;
              return (
                <li key={r.id} className={`report ${status}`}>
                  <div className="report-top">
                    <strong>{r.userName}</strong>
                    <span className={`rstatus ${status}`}>{REPORT_STATUS_LABELS[status]}</span>
                    <span className="muted small">{timeAgo(r.createdAt, t)}</span>
                  </div>
                  <p>„{r.text}”</p>
                  {status !== "expired" && (
                    <div className="votes">
                      <button
                        className={`mini ${r.confirms.includes(user.uid) ? "on" : ""}`}
                        disabled={mine}
                        onClick={() => repo.voteReport(r.id, user.uid, "confirm")}
                      >
                        👍 Igaz ({r.confirms.length})
                      </button>
                      <button
                        className={`mini ${r.denies.includes(user.uid) ? "on" : ""}`}
                        disabled={mine}
                        onClick={() => repo.voteReport(r.id, user.uid, "deny")}
                      >
                        👎 Már nem ({r.denies.length})
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <div className="sheet-actions">
          <button className="btn" onClick={() => setEditing(true)}>
            ✏️ Szerkesztés
          </button>
          <a className="btn ghost" href={mapsUrl} target="_blank" rel="noreferrer">
            Útvonal (Google Térkép)
          </a>
        </div>
        {place.updatedAt && (
          <p className="muted small">
            Utoljára módosította: {place.updatedBy ?? "?"}, {timeAgo(place.updatedAt, t)}
          </p>
        )}
      </div>
    </div>
  );
}
