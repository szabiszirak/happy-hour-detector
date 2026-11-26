import { useState } from "react";
import { useApp } from "../context";
import { distanceM, formatDistance, walkMinutes } from "../domain/geo";
import { describeDays, formatMinutes, happyHourStatus, slotMinutesLeft } from "../domain/happyHour";
import { currentPrice, formatFt, formatVolume, orderPlaceMenu, pricePerLiter } from "../domain/pricing";
import { drinkConfirmation } from "../domain/ownership";
import { canEditPlaceAs, canManagePlace, claimButtonState, type ClaimButtonState } from "../domain/account";
import { withinBudget } from "../domain/priceBudget";
import { extractPrice, REPORT_STATUS_LABELS, REPORT_TTL_MS, reportStatus, timeAgo } from "../domain/reports";
import { matchScore } from "../domain/match";
import { STYLE_LABELS, VIBE_LABELS, type Place } from "../domain/types";
import { PlaceEditor } from "./PlaceEditor";
import { formatOpeningHours, openState } from "../domain/openingHours";
import { OpenBadge } from "./Lists";
import { ReviewsSection, RatingBadge } from "./Reviews";
import { googleMapsUrl } from "../domain/links";
import { PlaceIconTile } from "./PlaceIcon";
import { iconOf } from "../data/placeIcons";

export function PlaceSheet({ place, onClose }: { place: Place; onClose: () => void }) {
  const { repo, user, profile, reports, now, pos, toast, owners, livePromos, myClaims, openClaim, accountMode, ownerAccount, openOwnerDashboard } = useApp();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [drinkId, setDrinkId] = useState("");
  const st = happyHourStatus(place, now);
  const dist = distanceM(pos, place.location);
  const match = matchScore(place, profile, now);
  const t = Date.now(); // bejelentések, megerősítések: valós idő
  const placeReports = reports.filter((r) => r.placeId === place.id).sort((a, b) => b.createdAt - a.createdAt);
  const owner = owners[place.id];
  // kocsmáros jogok csak kocsmáros fiókban és csak igazolás után (domain/account.ts)
  const iAmOwner = canManagePlace(accountMode, user.uid, place.id, owners);
  const canEdit = canEditPlaceAs(accountMode, user.uid, place.id, owners);
  const claimState = claimButtonState(accountMode, user.uid, ownerAccount, place.id, myClaims, owners);
  const menu = orderPlaceMenu(place, livePromos);
  const icon = iconOf(place);
  const mapsUrl = googleMapsUrl(place);

  if (editing) return <PlaceEditor place={place} ownerMode={iAmOwner} onClose={() => setEditing(false)} />;

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
          <PlaceIconTile place={place} size={52} hh={happyHourStatus(place, now).kind === "active"} />
          <div className="sheet-title">
            {owner && <span className="verified-badge">✓ Kocsmáros által ellenőrzött</span>}
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
          <RatingBadge placeId={place.id} />
          <span className={`vibe kind-chip ${icon.uncertain ? "uncertain" : ""}`}>
            {icon.label}
            {icon.uncertain ? " · típus ellenőrizendő" : ""}
          </span>
          {place.drinks.length > 0 && (
            <span className={`match ${match >= 80 ? "hi" : match >= 50 ? "mid" : "lo"}`}>{match}%-ban passzol az ízlésedhez</span>
          )}
          {place.vibes.map((v) => (
            <span key={v} className="vibe">
              {VIBE_LABELS[v]}
            </span>
          ))}
        </div>
        {place.description && <p className="place-desc">{place.description}</p>}
        {place.photos && place.photos.length > 0 && (
          <div className="photo-strip">
            {place.photos.map((ph) => (
              <img key={ph.id} src={ph.url} alt={`${place.name} – fotó`} loading="lazy" />
            ))}
          </div>
        )}

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
        {place.info?.checkNeeded && !owner && (
          <p className="check-note">
            ⚠️ Ellenőrizendő: webes forrásból vagy étterem/kávézóként van nyilvántartva. Ha jártál itt, erősítsd meg, hogy kocsmaként működik!
          </p>
        )}

        <section>
          <h3 className="sec">Happy Hour</h3>
          {st.kind === "active" && <div className="hh-live">🍻 Most zajlik · még {formatMinutes(st.minutesLeft)}</div>}
          {st.kind === "upcoming" && <div className="hh-soon">⏳ {formatMinutes(st.minutesUntil)} múlva indul</div>}
          {place.happyHours.length === 0 && (
            <p className="empty">
              {owner ? (iAmOwner ? "Még nem adtál meg happy hourt – a Szerkesztés gombbal felviheted." : "A kocsmáros még nem adott meg happy hourt.") : "Nincs megadott happy hour. Tudsz róla? Szerkeszd!"}
            </p>
          )}
          <ul className="slots">
            {place.happyHours.map((h) => (
              <li key={h.id} className={slotMinutesLeft(h, now) !== null ? "live" : ""}>
                <strong>
                  {describeDays(h.days)} {h.start}–{h.end}
                  {h.isSynthetic && <span className="tag-synthetic">Becsült (nem valós adat)</span>}
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
              {menu.map(({ drink: d, promo }) => {
                const cp = currentPrice(d, place, now);
                const conf = drinkConfirmation(place, d);
                const fits = withinBudget(d, cp.price, profile);
                return (
                  <tr key={d.id} className={promo ? "promoted" : ""}>
                    <td>
                      {promo && <span className="tag-sponsored">Szponzorált</span>}
                      <strong>{d.name}</strong>
                      {promo?.tagline && <span className="promo-tagline">{promo.tagline}</span>}
                      <span className="muted small">
                        {STYLE_LABELS[d.style]} · {formatVolume(d.volumeL)}
                        {conf.lastAt ? ` · ✔ ${timeAgo(conf.lastAt, t)} megerősítve` : ""}
                      </span>
                      {fits === true && <span className="budget-ok">keretben</span>}
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
          <p className="muted small">
            {owner
              ? iAmOwner
                ? "A te helyed: az itallapot a Szerkesztés gombbal frissítheted."
                : "Az itallapot a kocsmáros kezeli. Változott az ár? Jelezd bejelentéssel, vagy erősítsd meg, ha stimmel."
              : "Változott az ár vagy hiányzik egy ital? A Szerkesztés gombbal bárki javíthatja."}
          </p>
        </section>

        <ReviewsSection place={place} />

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
          {canEdit && (
            <button className="btn" onClick={() => setEditing(true)}>
              ✏️ Szerkesztés
            </button>
          )}
          <ClaimButton state={claimState} onClaim={() => openClaim(place.id)} onDashboard={openOwnerDashboard} />
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

/** „Ez az én helyem” – csak kocsmáros fiókban (vendég fiókban nem jelenik meg). */
function ClaimButton({ state, onClaim, onDashboard }: { state: ClaimButtonState; onClaim: () => void; onDashboard: () => void }) {
  switch (state) {
    case "hidden":
      return null;
    case "claim":
    case "retry":
      return (
        <button className="btn claim-btn" onClick={onClaim}>
          🏪 Ez az én helyem{state === "retry" ? " – újra" : ""}
        </button>
      );
    case "needs-account":
      return (
        <button className="btn claim-btn" onClick={onDashboard}>
          🏪 Ez az én helyem
        </button>
      );
    case "pending":
      return (
        <button className="btn ghost" onClick={onDashboard}>
          🏪 Igénylésed függőben
        </button>
      );
    case "mine":
      return (
        <button className="btn ghost" onClick={onDashboard}>
          ✓ A te helyed – Kocsmáros felület
        </button>
      );
    case "taken":
      return <span className="muted small taken-note">Ennek a helynek már van ellenőrzött kocsmárosa.</span>;
  }
}
