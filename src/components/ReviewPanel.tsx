import { useEffect, useState } from "react";
import { useApp } from "../context";
import type { ReviewApi } from "../data/repo";
import { CLAIM_ROLE_LABELS, DOC_KIND_LABELS, type ClaimDocument, type OwnerClaim } from "../domain/ownership";
import { promotionEnded } from "../domain/pricing";
import { timeAgo } from "../domain/reports";

/**
 * Elbírálói felület: kocsmáros-igénylések és kiemelési kérések.
 * Éles módban csak `admin` jogú felhasználó látja (és a firestore.rules is csak neki enged írni).
 */
export function ReviewPanel({ api, onClose }: { api: ReviewApi; onClose: () => void }) {
  const { repo, promotions, places, toast } = useApp();
  const [claims, setClaims] = useState<OwnerClaim[]>([]);
  useEffect(() => api.subscribePendingClaims(setClaims), [api]);
  const now = Date.now();
  const requests = promotions.filter((p) => p.status === "requested" && !promotionEnded(p, now));
  const placeName = (id: string) => places.find((p) => p.id === id)?.name ?? id;

  const run = async (f: () => Promise<void>, ok: string) => {
    try {
      await f();
      toast(ok);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Nem sikerült.");
    }
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet review" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={api.label}>
        <div className="sheet-head">
          <div>
            <span className="muted small">{repo.mode === "demo" ? "Éles módban csak admin jogú felhasználó látja" : "Admin"}</span>
            <h2>{api.label}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Bezárás">
            ✕
          </button>
        </div>

        <section>
          <h3 className="sec">Függő kocsmáros-igénylések ({claims.length})</h3>
          {claims.length === 0 && <p className="empty">Nincs elbírálásra váró igénylés.</p>}
          {claims.map((c) => (
            <ClaimReview key={c.id} claim={c} api={api} run={run} now={now} />
          ))}
        </section>

        <section>
          <h3 className="sec">Kiemelési kérések ({requests.length})</h3>
          {requests.length === 0 && <p className="empty">Nincs függő kiemelési kérés.</p>}
          <ul className="promo-list">
            {requests.map((p) => (
              <li key={p.id}>
                <div>
                  <strong>
                    {placeName(p.placeId)} · {p.drinkName}
                  </strong>
                  {p.tagline && <span className="muted small"> · {p.tagline}</span>}
                  <span className="muted small block">
                    {Math.round((p.until - p.startsAt) / 86400000)} nap · kérve {timeAgo(p.requestedAt, now)}
                  </span>
                </div>
                <button className="mini ok" onClick={() => run(() => api.decidePromotion(p.id, "activate"), "Kiemelés aktiválva.")}>
                  Díj rendezve – aktiválás
                </button>
                <button className="mini" onClick={() => run(() => api.decidePromotion(p.id, "reject", "Nem felel meg a feltételeknek"), "Kérés elutasítva.")}>
                  Elutasítás
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function ClaimReview({
  claim: c,
  api,
  run,
  now,
}: {
  claim: OwnerClaim;
  api: ReviewApi;
  run: (f: () => Promise<void>, ok: string) => Promise<void>;
  now: number;
}) {
  const [note, setNote] = useState("");
  return (
    <article className="claim-row review-card">
      <div className="claim-row-head">
        <strong>{c.placeName}</strong>
        <span className="muted small">{timeAgo(c.createdAt, now)}</span>
      </div>
      <dl className="facts">
        <dt>Igénylő</dt>
        <dd>
          {c.userName} ({CLAIM_ROLE_LABELS[c.role]})
        </dd>
        <dt>Vállalkozás</dt>
        <dd>{c.businessName}</dd>
        <dt>Adószám</dt>
        <dd>{c.taxNumber}</dd>
        {c.companyReg && (
          <>
            <dt>Cégjegyzékszám</dt>
            <dd>{c.companyReg}</dd>
          </>
        )}
        <dt>Kapcsolattartó</dt>
        <dd>
          {c.contactName} · {c.phone}
        </dd>
      </dl>
      <ul className="doc-list">
        {c.documents.map((d) => (
          <DocPreview key={d.id} doc={d} api={api} />
        ))}
      </ul>
      <p className="fine">Ellenőrizd: a név és a cím egyezik-e a fotón / blokkon, és az adószám a NAV adószám-lekérdezőben a vállalkozáshoz tartozik-e.</p>
      <div className="review-actions">
        <button className="btn primary" onClick={() => run(() => api.reviewClaim(c.id, { action: "verify" }), "Kocsmáros hitelesítve.")}>
          ✓ Jóváhagyás
        </button>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Elutasítás oka" aria-label="Elutasítás oka" />
        <button className="btn" disabled={!note.trim()} onClick={() => run(() => api.reviewClaim(c.id, { action: "reject", note }), "Igénylés elutasítva.")}>
          Elutasítás
        </button>
      </div>
    </article>
  );
}

function DocPreview({ doc, api }: { doc: ClaimDocument; api: ReviewApi }) {
  const [url, setUrl] = useState<string | undefined>(doc.previewUrl);
  useEffect(() => {
    let live = true;
    if (!doc.previewUrl) api.documentUrl(doc).then((u) => live && setUrl(u)).catch(() => {});
    return () => {
      live = false;
    };
  }, [doc, api]);
  return (
    <li>
      {url && doc.mime.startsWith("image/") ? <img src={url} alt={DOC_KIND_LABELS[doc.kind]} /> : <span className="doc-icon">PDF</span>}
      <span className="doc-name">
        {DOC_KIND_LABELS[doc.kind]}
        <span className="muted small block">{doc.name}</span>
      </span>
      {url && (
        <a className="mini" href={url} target="_blank" rel="noreferrer">
          Megnyitás
        </a>
      )}
    </li>
  );
}
