import { useState } from "react";
import { useApp } from "../context";
import type { Place } from "../domain/types";
import { CLAIM_ROLE_LABELS, CLAIM_STATUS_LABELS, DOC_KIND_LABELS, DOC_RETENTION_DAYS, type ClaimStatus, type OwnerClaim } from "../domain/ownership";
import {
  buildPromotionRequest,
  formatFt,
  PROMO_LIMITS,
  promotionEnded,
  promotionStateLabel,
  type DrinkPromotion,
} from "../domain/pricing";
import { timeAgo } from "../domain/reports";
import { buildOwnerAccount, ownerDashboardState, validateOwnerAccountDraft } from "../domain/account";
import { PlaceEditor } from "./PlaceEditor";

export function ClaimStatusBadge({ status }: { status: ClaimStatus }) {
  return <span className={`claim-status ${status}`}>{CLAIM_STATUS_LABELS[status]}</span>;
}

/** Kocsmáros felület: igénylések állapota, ellenőrzött helyek kezelése, kiemelések. */
export function OwnerDashboard({ myClaims, onClose, onPickPlace }: { myClaims: OwnerClaim[]; onClose: () => void; onPickPlace: () => void }) {
  const { user, owners, places, promotions, openPlace, ownerAccount, caps } = useApp();
  const [editing, setEditing] = useState<Place | null>(null);
  // csak kocsmáros fiókban kezelhető helyek (domain/account.ts capabilities)
  const mine = places.filter((p) => caps.managedPlaceIds.includes(p.id));
  const state = ownerDashboardState(user.uid, ownerAccount, myClaims, owners);
  const t = Date.now();

  if (editing) return <PlaceEditor place={editing} ownerMode onClose={() => setEditing(null)} />;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet owner" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Kocsmáros felület">
        <div className="sheet-head">
          <div>
            <span className="muted small">{user.displayName}</span>
            <h2>Kocsmáros felület</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Bezárás">
            ✕
          </button>
        </div>

        {state === "no-account" && <OwnerAccountCard />}

        {state !== "no-account" && (
          <ol className="owner-steps" aria-label="A kocsmáros profil lépései">
            <li className="done">
              <span>✓</span>Kocsmáros fiók
            </li>
            <li className={state === "pick-place" ? "on" : "done"}>
              <span>{state === "pick-place" ? "2" : "✓"}</span>Hely kiválasztása és igénylése
            </li>
            <li className={state === "active" ? "done" : state === "pending" ? "on" : ""}>
              <span>{state === "active" ? "✓" : "3"}</span>Igazolás
            </li>
          </ol>
        )}

        {state === "pick-place" && (
          <section className="pick-guide">
            <h3>Válaszd ki a helyed</h3>
            <p>
              Keresd meg a kocsmádat a <b>térképen</b> vagy a <b>Kocsmák</b> listában, nyisd meg az adatlapját, és koppints az{" "}
              <b>„Ez az én helyem”</b> gombra. Utána 3 lépésben igazolod: vállalkozás adatai → igazolások → beküldés.
            </p>
            <button className="btn primary" onClick={onPickPlace}>
              📍 Hely kiválasztása a térképen / listában
            </button>
          </section>
        )}

        {state === "pending" && (
          <section className="pick-guide">
            <h3>Igazolás folyamatban</h3>
            <p>Az igénylésedet ellenőrizzük. Amíg nincs döntés, a hely adatait még nem szerkesztheted és kiemelést sem kérhetsz.</p>
            <button className="btn ghost" onClick={onPickPlace}>
              Másik hely igénylése
            </button>
          </section>
        )}

        {mine.map((p) => (
          <section key={p.id} className="owner-card">
            <div className="owner-card-head">
              <div>
                <h3>{p.name}</h3>
                <span className="muted small">{p.address}</span>
              </div>
              <span className="verified-badge">✓ Ellenőrzött kocsmáros</span>
            </div>
            <p className="muted small">
              {p.drinks.length} ital · {p.happyHours.length} happy hour sáv · {p.photos?.length ?? 0} fotó
              {p.info?.openingHours ? " · nyitvatartás megadva" : " · nyitvatartás hiányzik"}
            </p>
            <div className="owner-actions">
              <button className="btn" onClick={() => setEditing(p)}>
                ✏️ Adatok, nyitvatartás, HH, képek, itallap
              </button>
              <button
                className="btn ghost"
                onClick={() => {
                  onClose();
                  openPlace(p.id);
                }}
              >
                Adatlap megtekintése
              </button>
            </div>
            <PromotionManager place={p} promos={promotions.filter((x) => x.placeId === p.id)} />
          </section>
        ))}

        {myClaims.length > 0 && (
          <section>
            <h3 className="sec">Igényléseid</h3>
            <ul className="claim-list">
              {myClaims.map((c) => (
                <ClaimRow key={c.id} claim={c} t={t} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function ClaimRow({ claim: c, t }: { claim: OwnerClaim; t: number }) {
  const { repo, user, toast } = useApp();
  return (
    <li className="claim-row">
      <div className="claim-row-head">
        <strong>{c.placeName}</strong>
        <ClaimStatusBadge status={c.status} />
      </div>
      <span className="muted small">
        {CLAIM_ROLE_LABELS[c.role]} · {c.businessName} · {c.taxNumber} · beküldve {timeAgo(c.createdAt, t)}
      </span>
      <ul className="doc-list compact">
        {c.documents.map((d) => (
          <li key={d.id}>
            {d.previewUrl ? <img src={d.previewUrl} alt="" /> : <span className="doc-icon">{d.mime === "application/pdf" ? "PDF" : "IMG"}</span>}
            <span className="doc-name">{DOC_KIND_LABELS[d.kind]}</span>
            <ClaimStatusBadge status={c.status} />
          </li>
        ))}
      </ul>
      {c.status === "pending" && (
        <>
          <p className="fine">Az ellenőrzés általában 1–2 munkanap. Ha kell, telefonon keresünk.</p>
          <button
            className="mini"
            onClick={async () => {
              await repo.withdrawClaim(c.id, user.uid);
              toast("Igénylés visszavonva.");
            }}
          >
            Visszavonás
          </button>
        </>
      )}
      {c.status === "rejected" && <p className="check-note">Elutasítás oka: {c.reviewNote}. Új igénylést küldhetsz jobb igazolással.</p>}
      {c.status === "verified" && <p className="fine">Az igazolásaidat a döntés után {DOC_RETENTION_DAYS} nappal töröljük.</p>}
    </li>
  );
}

const DAY_OPTIONS = [1, 3, 7, 14, 30];

/** Fizetős ital-kiemelés kérése és állapota egy ellenőrzött helyhez. */
function PromotionManager({ place, promos }: { place: Place; promos: DrinkPromotion[] }) {
  const { repo, user, toast } = useApp();
  const [drinkId, setDrinkId] = useState("");
  const [tagline, setTagline] = useState("");
  const [days, setDays] = useState(7);
  const [err, setErr] = useState<string | null>(null);
  const now = Date.now();
  const sorted = [...promos].sort((a, b) => b.requestedAt - a.requestedAt);

  const request = async () => {
    setErr(null);
    try {
      const promo = buildPromotionRequest({ placeId: place.id, drinkId, tagline, days, startsAt: Date.now() }, place, true, user.uid, promos, repo.newId("promotions"), Date.now());
      await repo.requestPromotion(promo);
      setDrinkId("");
      setTagline("");
      toast("Kiemelés kérve – a díj egyeztetése után aktiváljuk.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Nem sikerült.");
    }
  };

  return (
    <div className="promo-box">
      <h4>
        <span className="tag-sponsored">Szponzorált</span> Ital-kiemelés
      </h4>
      <p className="fine">
        A kiemelt italod „Szponzorált” címkével a Piák &amp; árak lista tetején (legfeljebb {PROMO_LIMITS.maxSponsoredSlots} kiemelt hely, csak
        ha megfelel a felhasználó szűrésének) és a helyed itallapján felül jelenik meg. A kocsmák sorrendjét nem befolyásolja. Aktiválás a
        díj egyeztetése után.
      </p>
      {sorted.length > 0 && (
        <ul className="promo-list">
          {sorted.map((p) => (
            <li key={p.id} className={promotionEnded(p, now) ? "ended" : ""}>
              <div>
                <strong>{p.drinkName}</strong>
                {p.tagline && <span className="muted small"> · {p.tagline}</span>}
                <span className="muted small block">
                  {new Date(p.startsAt).toLocaleDateString("hu-HU")} – {new Date(p.until).toLocaleDateString("hu-HU")}
                </span>
              </div>
              <span className={`promo-state ${p.status}`}>{promotionStateLabel(p, now)}</span>
              {p.status === "requested" && (
                <button className="mini" onClick={() => repo.cancelPromotionRequest(p.id, user.uid)}>
                  Visszavonás
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {place.drinks.length === 0 ? (
        <p className="muted small">Kiemelni a helyed itallapján szereplő italt lehet – előbb vidd fel az itallapot.</p>
      ) : (
        <div className="promo-form">
          <select value={drinkId} onChange={(e) => setDrinkId(e.target.value)} aria-label="Kiemelendő ital">
            <option value="">Melyik italt emeljük ki?</option>
            {place.drinks.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} – {formatFt(d.price)}
              </option>
            ))}
          </select>
          <input value={tagline} maxLength={PROMO_LIMITS.taglineMax} onChange={(e) => setTagline(e.target.value)} placeholder="Rövid ajánló (nem kötelező)" aria-label="Ajánlószöveg" />
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Futamidő">
            {DAY_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} nap
              </option>
            ))}
          </select>
          <button className="btn primary" disabled={!drinkId} onClick={request}>
            Kiemelés kérése
          </button>
        </div>
      )}
      {err && <p className="field-err">{err}</p>}
    </div>
  );
}

/** Kocsmáros fiók létrehozása (egyszer). A fiók önmagában nem ad jogot egy helyhez sem. */
function OwnerAccountCard() {
  const { repo, user, toast } = useApp();
  const [email, setEmail] = useState(user.email ?? "");
  const [terms, setTerms] = useState(false);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const errors = validateOwnerAccountDraft({ contactEmail: email, acceptTerms: terms });

  const create = async () => {
    setTried(true);
    if (Object.keys(errors).length) return;
    setBusy(true);
    try {
      await repo.createOwnerAccount(buildOwnerAccount({ contactEmail: email, acceptTerms: terms }, user.uid, Date.now()));
      toast("Kocsmáros fiók létrehozva. Most válaszd ki a helyed!");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Nem sikerült.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="owner-card account-card">
      <h3>Kocsmáros fiók létrehozása</h3>
      <p className="muted small">
        Egyszer kell beállítani. Utána kiválaszthatod a helyed, és igényelheted („Ez az én helyem”). A hely adatait és a kiemeléseket csak az
        igazolás után kezelheted.
      </p>
      <label className={`field ${tried && errors.contactEmail ? "invalid" : ""}`}>
        <span>Kapcsolattartó e-mail</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="kocsma@pelda.hu" />
        {tried && errors.contactEmail && <em className="field-err">{errors.contactEmail}</em>}
      </label>
      <label className="consent">
        <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
        <span>
          Elfogadom a kocsmárosi feltételeket: csak valós adatot adok meg a helyemről, a fizetős kiemelés „Szponzorált” jelöléssel jelenik
          meg, és a kocsmák sorrendjét nem befolyásolja.
        </span>
      </label>
      {tried && errors.acceptTerms && <p className="field-err">{errors.acceptTerms}</p>}
      <button className="btn primary" disabled={busy} onClick={create}>
        {busy ? "Létrehozás…" : "Kocsmáros fiók létrehozása"}
      </button>
    </section>
  );
}
