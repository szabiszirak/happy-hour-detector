import { useState } from "react";
import type { PriceBand, TasteProfile } from "../domain/types";
import { PRICE_BAND_LABELS } from "../domain/types";
import { normalizePrefs } from "../domain/tasteProfile";
import { TastePicker, type TasteValue } from "./TastePicker";

export function LoginScreen({ mode, onLogin }: { mode: "demo" | "firebase"; onLogin: (demoName?: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const go = async () => {
    setBusy(true);
    setErr(null);
    try {
      await onLogin(name);
    } catch (e) {
      setErr("A belépés nem sikerült. Próbáld újra.");
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="onb">
      <div className="onb-card">
        <div className="logo-big">🍺</div>
        <h1>Happy Hour Detector</h1>
        <p className="muted">Hol van most happy hour, és hol a legolcsóbb a sör – a Kálvin tér és a Boráros tér között.</p>
        {mode === "demo" && (
          <label className="field">
            <span>Becenév a demóhoz (nem kötelező)</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="pl. Szabi" maxLength={24} />
          </label>
        )}
        <button className="btn google" onClick={go} disabled={busy}>
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6C12.4 13.7 17.7 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 7l7.2 5.6c4.2-3.9 7.1-9.7 7.1-17.1z" />
            <path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.8-6z" />
            <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.2-5.6c-2 1.4-4.7 2.3-8.7 2.3-6.3 0-11.6-4.2-13.5-9.9l-7.8 6C6.6 42.6 14.6 48 24 48z" />
          </svg>
          {busy ? "Belépés…" : mode === "demo" ? "Belépés Google-fiókkal (demó)" : "Belépés Google-fiókkal"}
        </button>
        {err && <p className="error">{err}</p>}
        <p className="fine">
          {mode === "demo"
            ? "Demó mód: nincs valódi Google-belépés, az adatok csak ebben a böngészőben tárolódnak."
            : "Csak a neved és az e-mail-címed kerül hozzánk. 18 éven felülieknek."}
        </p>
      </div>
    </div>
  );
}

export function Onboarding({
  name,
  initial,
  onDone,
  onCancel,
}: {
  name: string;
  /** Meglévő profil (módosításkor előre kitöltve). */
  initial?: TasteProfile;
  onDone: (p: TasteProfile) => Promise<void>;
  onCancel?: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [taste, setTaste] = useState<TasteValue>({ categories: initial?.categories ?? [], prefs: initial?.prefs ?? {} });
  const [busy, setBusy] = useState(false);

  const finish = async (band: PriceBand) => {
    setBusy(true);
    await onDone({
      version: 2,
      categories: taste.categories,
      prefs: normalizePrefs(taste.categories, taste.prefs),
      priceBand: band,
      completedAt: Date.now(),
    });
  };

  return (
    <div className="onb">
      <div className="onb-card wide">
        <div className="steps">
          <span className={step === 1 ? "on" : ""} />
          <span className={step === 2 ? "on" : ""} />
        </div>
        {step === 1 ? (
          <>
            <p className="muted">{initial ? "Ízlésprofil módosítása" : `Szia, ${name.split(" ")[0]}! Két gyors kérdés, és kész.`}</p>
            <h2>Mit iszol legszívesebben?</h2>
            <p className="muted small">Több is választható. A kijelölt italnál pontosíthatod is, mit szeretsz – ez nem kötelező.</p>
            <TastePicker value={taste} onChange={setTaste} />
            <button className="btn primary" disabled={taste.categories.length === 0} onClick={() => setStep(2)}>
              Tovább
            </button>
            {onCancel && (
              <button className="btn ghost" onClick={onCancel}>
                Mégse
              </button>
            )}
          </>
        ) : (
          <>
            <h2>Mennyit adnál maximum egy korsóért?</h2>
            <div className="band-list">
              {(Object.keys(PRICE_BAND_LABELS) as PriceBand[]).map((b) => (
                <button key={b} className={`band ${initial?.priceBand === b ? "current" : ""}`} disabled={busy} onClick={() => finish(b)}>
                  <span className="emoji">{b === "budget" ? "🪙" : b === "mid" ? "⚖️" : "💎"}</span>
                  {PRICE_BAND_LABELS[b]}
                </button>
              ))}
            </div>
            <button className="btn ghost" onClick={() => setStep(1)}>
              Vissza
            </button>
          </>
        )}
      </div>
    </div>
  );
}
