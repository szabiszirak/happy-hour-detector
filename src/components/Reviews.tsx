import { useState } from "react";
import { useApp } from "../context";
import type { Place } from "../domain/types";
import {
  buildReview,
  canReview,
  formatRating,
  REVIEW_TEXT_MAX,
  reviewsFor,
  summarizeReviews,
  validateReviewDraft,
  type Review,
} from "../domain/reviews";
import { googleMapsUrl } from "../domain/links";
import { timeAgo } from "../domain/reports";

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="stars" style={{ fontSize: size }} aria-label={`${formatRating(value)} csillag`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= Math.round(value) ? "on" : ""} aria-hidden="true">
          ★
        </span>
      ))}
    </span>
  );
}

/** Rövid csillagos összegzés a listában („★ 4,6 (3)”). */
export function RatingBadge({ placeId }: { placeId: string }) {
  const { reviews } = useApp();
  const s = summarizeReviews(reviews.filter((r) => r.placeId === placeId));
  if (!s.count) return null;
  return (
    <span className="rating-badge" title={`${s.count} értékelés az appban`}>
      ★ {formatRating(s.average)} <span className="muted">({s.count})</span>
    </span>
  );
}

/** Az adatlap „Értékelések” része: saját értékelések az appból + link a Google Térképre. */
export function ReviewsSection({ place }: { place: Place }) {
  const { repo, user, reviews, owners, now, toast } = useApp();
  const list = reviewsFor(reviews, place.id, user.uid);
  const mine = list.find((r) => r.uid === user.uid);
  const summary = summarizeReviews(list);
  const allowed = canReview(user.uid, place.id, owners);
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(mine?.rating ?? 0);
  const [text, setText] = useState(mine?.text ?? "");
  const [err, setErr] = useState<string | null>(null);
  const t = now.getTime();

  const open = () => {
    setRating(mine?.rating ?? 0);
    setText(mine?.text ?? "");
    setErr(null);
    setEditing(true);
  };
  const save = async () => {
    const e = validateReviewDraft({ rating, text });
    if (Object.keys(e).length) return setErr(Object.values(e)[0]!);
    try {
      await repo.saveReview(buildReview({ rating, text }, user, place.id, Date.now(), mine), user);
      setEditing(false);
      toast(mine ? "Értékelés módosítva." : "Köszi az értékelést!");
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Nem sikerült menteni.");
    }
  };

  return (
    <section className="reviews">
      <h3 className="sec">Értékelések</h3>
      {summary.count > 0 ? (
        <div className="review-summary">
          <div className="review-avg">
            <strong>{formatRating(summary.average)}</strong>
            <Stars value={summary.average} size={16} />
            <span className="muted small">{summary.count} értékelés az appban</span>
          </div>
          <div className="review-bars" aria-hidden="true">
            {[5, 4, 3, 2, 1].map((s) => (
              <div key={s} className="review-bar">
                <span>{s}</span>
                <i style={{ width: `${(summary.distribution[s - 1] / summary.count) * 100}%` }} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="empty">Még nincs értékelés az appban. Légy az első!</p>
      )}

      {!allowed.ok ? (
        <p className="muted small">{allowed.reason}</p>
      ) : editing ? (
        <div className="review-form">
          <div className="star-input" role="radiogroup" aria-label="Csillagok">
            {[1, 2, 3, 4, 5].map((i) => (
              <button key={i} role="radio" aria-checked={rating === i} aria-label={`${i} csillag`} className={i <= rating ? "on" : ""} onClick={() => setRating(i)}>
                ★
              </button>
            ))}
          </div>
          <textarea
            rows={3}
            maxLength={REVIEW_TEXT_MAX}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Milyen volt? (nem kötelező – sörválaszték, hangulat, kiszolgálás)"
            aria-label="Értékelés szövege"
          />
          <div className="review-form-foot">
            <span className="fine">
              {text.length}/{REVIEW_TEXT_MAX} · a neved rövidítve jelenik meg
            </span>
            <div className="review-actions">
              {mine && (
                <button
                  className="mini"
                  onClick={async () => {
                    await repo.deleteReview(mine.id, user.uid);
                    setEditing(false);
                    toast("Értékelés törölve.");
                  }}
                >
                  Törlés
                </button>
              )}
              <button className="mini" onClick={() => setEditing(false)}>
                Mégse
              </button>
              <button className="btn primary" onClick={save}>
                Mentés
              </button>
            </div>
          </div>
          {err && <p className="field-err">{err}</p>}
        </div>
      ) : (
        <button className="btn ghost" onClick={open}>
          {mine ? "✏️ Értékelésem módosítása" : "★ Értékelem"}
        </button>
      )}

      {list.length > 0 && (
        <ul className="review-list">
          {list.map((r: Review) => (
            <li key={r.id} className={r.uid === user.uid ? "mine" : ""}>
              <div className="review-head">
                <strong>{r.uid === user.uid ? "Te" : r.userName}</strong>
                <Stars value={r.rating} />
                <span className="muted small">
                  {timeAgo(r.updatedAt ?? r.createdAt, t)}
                  {r.updatedAt ? " · módosítva" : ""}
                </span>
              </div>
              {r.text && <p>{r.text}</p>}
            </li>
          ))}
        </ul>
      )}

      <a className="google-reviews" href={googleMapsUrl(place)} target="_blank" rel="noreferrer">
        Google-értékelések megnyitása a Google Térképen ↗
      </a>
    </section>
  );
}
