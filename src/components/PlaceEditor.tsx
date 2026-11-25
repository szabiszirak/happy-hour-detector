import { useRef, useState } from "react";
import { formatOpeningHours, parseOpeningHours } from "../domain/openingHours";
import { useApp } from "../context";
import { brandSuggestions, canonicalBrand, CATEGORY_OF, CATEGORY_ORDER } from "../domain/drinkCatalog";
import { inferSubtype, SUBTYPE_CATEGORY, SUBTYPE_LABELS, SUBTYPE_OPTIONS, type SubtypeCategory } from "../domain/tasteProfile";
import { STYLE_LABELS, VIBE_LABELS, type Drink, type DrinkStyle, type DrinkSubtype, type HappyHourSlot, type Place, type PlacePhoto, type Vibe } from "../domain/types";

const DAYS = ["H", "K", "Sze", "Cs", "P", "Szo", "V"];
const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function validate(p: Place): string | null {
  if (!p.name.trim()) return "Add meg a hely nevét.";
  if (p.info?.openingHours && parseOpeningHours(p.info.openingHours) === null)
    return "A nyitvatartás formátuma nem érthető (pl. Mo-Th 16:00-24:00; Fr-Sa 16:00-02:00).";
  if ((p.description ?? "").length > 500) return "A bemutatkozás legfeljebb 500 karakter.";
  for (const d of p.drinks) {
    if (!d.name.trim()) return "Minden italnak legyen neve.";
    if (!(d.price > 0)) return `${d.name}: az ár legyen pozitív szám.`;
    if (!(d.volumeL > 0 && d.volumeL <= 3)) return `${d.name}: a kiszerelés literben 0 és 3 között legyen.`;
    if (d.hhPrice !== undefined && !(d.hhPrice > 0)) return `${d.name}: a HH ár legyen pozitív, vagy hagyd üresen.`;
  }
  for (const h of p.happyHours) {
    if (!h.days.length) return "Minden happy hour sávhoz jelölj ki legalább egy napot.";
    if (!TIME_RE.test(h.start) || !TIME_RE.test(h.end)) return "Az időpontok formátuma ÓÓ:PP legyen.";
    if (h.start === h.end) return "A happy hour kezdete és vége nem lehet azonos.";
  }
  return null;
}

/**
 * Gazdátlan helyet bármelyik belépett felhasználó szerkeszthet (Waze-elv).
 * Ellenőrzött helynél csak a kocsmáros (ownerMode) – ő a nyitvatartást, a bemutatkozást és a fotókat is kezeli.
 */
export function PlaceEditor({ place, onClose, ownerMode = false }: { place: Place; onClose: () => void; ownerMode?: boolean }) {
  const { repo, user, toast } = useApp();
  const [p, setP] = useState<Place>(() => structuredClone(place));
  const [err, setErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setErr(null);
    try {
      const added: PlacePhoto[] = [];
      for (const f of Array.from(files).slice(0, 6 - (p.photos?.length ?? 0))) added.push(await repo.uploadPlacePhoto(p.id, f, user));
      setP((cur) => ({ ...cur, photos: [...(cur.photos ?? []), ...added] }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "A feltöltés nem sikerült.");
    } finally {
      setUploading(false);
      if (photoRef.current) photoRef.current.value = "";
    }
  };

  const setDrink = (id: string, patch: Partial<Drink>) =>
    setP({ ...p, drinks: p.drinks.map((d) => (d.id === id ? { ...d, ...patch } : d)) });
  const setSlot = (id: string, patch: Partial<HappyHourSlot>) =>
    setP({ ...p, happyHours: p.happyHours.map((h) => (h.id === id ? { ...h, ...patch } : h)) });
  const toggleVibe = (v: Vibe) => setP({ ...p, vibes: p.vibes.includes(v) ? p.vibes.filter((x) => x !== v) : [...p.vibes, v] });

  const save = async () => {
    const e = validate(p);
    setErr(e);
    if (e) return;
    // az ármódosítás új adatnak számít: a régi megerősítések nem öröklődnek
    const drinks = p.drinks.map((d) => {
      const old = place.drinks.find((o) => o.id === d.id);
      const changed = !old || old.price !== d.price || old.hhPrice !== d.hhPrice;
      const brand = d.brand?.trim() ? canonicalBrand(d.brand) : undefined;
      d = { ...d, brand };
      return changed ? { ...d, updatedAt: Date.now(), updatedBy: user.displayName, lastConfirmedAt: undefined, confirmCount: 0 } : d;
    });
    try {
      await repo.savePlace(JSON.parse(JSON.stringify({ ...p, name: p.name.trim(), drinks })), user);
    } catch (x) {
      setErr(x instanceof Error ? x.message : "A mentés nem sikerült.");
      return;
    }
    toast(ownerMode ? "Mentve – a helyed adatai frissültek." : "Mentve. Köszi, hogy frissítetted!");
    onClose();
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet editor" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Hely szerkesztése">
        <div className="sheet-head">
          <div>
            {ownerMode && <span className="verified-badge">✓ Kocsmáros</span>}
            <h2>{ownerMode ? p.name || "Szerkesztés" : "Szerkesztés"}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Bezárás">
            ✕
          </button>
        </div>

        <label className="field">
          <span>Hely neve</span>
          <input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
        </label>
        <label className="field">
          <span>Cím</span>
          <input value={p.address} onChange={(e) => setP({ ...p, address: e.target.value })} />
        </label>
        <div className="field">
          <span>Hangulat</span>
          <div className="chips">
            {(Object.keys(VIBE_LABELS) as Vibe[]).map((v) => (
              <button key={v} className={`chip ${p.vibes.includes(v) ? "on" : ""}`} onClick={() => toggleVibe(v)}>
                {VIBE_LABELS[v]}
              </button>
            ))}
          </div>
        </div>

        {ownerMode && (
          <>
            <label className="field">
              <span>Nyitvatartás (OSM formátum)</span>
              <input
                value={p.info?.openingHours ?? ""}
                onChange={(e) => setP({ ...p, info: { ...(p.info ?? {}), openingHours: e.target.value || undefined } })}
                placeholder="Mo-Th 16:00-24:00; Fr-Sa 16:00-02:00; Su off"
              />
              {p.info?.openingHours && (
                <em className={parseOpeningHours(p.info.openingHours) ? "field-ok" : "field-err"}>
                  {parseOpeningHours(p.info.openingHours) ? formatOpeningHours(p.info.openingHours) : "Nem értelmezhető formátum"}
                </em>
              )}
            </label>
            <label className="field">
              <span>Bemutatkozás (max. 500 karakter)</span>
              <textarea rows={3} maxLength={500} value={p.description ?? ""} onChange={(e) => setP({ ...p, description: e.target.value || undefined })} />
            </label>
            <div className="field">
              <span>Fotók ({p.photos?.length ?? 0}/6)</span>
              <div className="photo-grid">
                {(p.photos ?? []).map((ph) => (
                  <figure key={ph.id}>
                    <img src={ph.url} alt="" />
                    <button className="icon-btn" aria-label="Fotó törlése" onClick={() => setP({ ...p, photos: (p.photos ?? []).filter((x) => x.id !== ph.id) })}>
                      ✕
                    </button>
                  </figure>
                ))}
                {(p.photos?.length ?? 0) < 6 && (
                  <button className="photo-add" disabled={uploading} onClick={() => photoRef.current?.click()}>
                    {uploading ? "Feltöltés…" : "+ Fotó"}
                  </button>
                )}
              </div>
              <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => addPhotos(e.target.files)} aria-label="Fotó feltöltése" />
            </div>
          </>
        )}

        <h3 className="sec">Happy Hour sávok</h3>
        {p.happyHours.map((h) => (
          <div key={h.id} className="edit-box">
            <div className="days">
              {DAYS.map((label, i) => {
                const day = i + 1;
                const on = h.days.includes(day);
                return (
                  <button
                    key={label}
                    className={`chip small ${on ? "on" : ""}`}
                    onClick={() => setSlot(h.id, { days: on ? h.days.filter((x) => x !== day) : [...h.days, day].sort() })}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="row">
              <input type="time" value={h.start} onChange={(e) => setSlot(h.id, { start: e.target.value })} aria-label="Kezdés" />
              <span>–</span>
              <input type="time" value={h.end} onChange={(e) => setSlot(h.id, { end: e.target.value })} aria-label="Vége" />
              <button className="mini danger" onClick={() => setP({ ...p, happyHours: p.happyHours.filter((x) => x.id !== h.id) })}>
                Törlés
              </button>
            </div>
            <input value={h.note} placeholder="Mi az akció? pl. Minden csapolt sör -200 Ft" onChange={(e) => setSlot(h.id, { note: e.target.value })} />
          </div>
        ))}
        <button
          className="btn ghost"
          onClick={() =>
            setP({ ...p, happyHours: [...p.happyHours, { id: uid("h"), days: [1, 2, 3, 4, 5], start: "16:00", end: "18:00", note: "" }] })
          }
        >
          + Happy Hour sáv
        </button>

        <h3 className="sec">Italok és árak</h3>
        {p.drinks.map((d) => (
          <div key={d.id} className="edit-box">
            <div className="row">
              <input value={d.name} placeholder="Ital neve (pl. Arany Ászok korsó)" onChange={(e) => setDrink(d.id, { name: e.target.value })} />
              <select
                value={d.style}
                onChange={(e) => {
                  const style = e.target.value as DrinkStyle;
                  const keep = d.subtype && CATEGORY_OF[style] !== "beer" && SUBTYPE_CATEGORY[d.subtype] === CATEGORY_OF[style];
                  setDrink(d.id, { style, subtype: keep ? d.subtype : undefined });
                }}
              >
                {(Object.keys(STYLE_LABELS) as DrinkStyle[]).map((s) => (
                  <option key={s} value={s}>
                    {STYLE_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div className="row">
              <input
                className="brand-input"
                value={d.brand ?? ""}
                placeholder="Márka (pl. Dreher) – nem kötelező"
                list={`brands-${CATEGORY_OF[d.style]}`}
                aria-label="Márka"
                onChange={(e) => setDrink(d.id, { brand: e.target.value === "" ? undefined : e.target.value })}
              />
              {CATEGORY_OF[d.style] !== "beer" && (
                <select
                  aria-label="Fajta"
                  value={d.subtype ?? ""}
                  onChange={(e) => setDrink(d.id, { subtype: (e.target.value || undefined) as DrinkSubtype | undefined })}
                >
                  <option value="">
                    Fajta: {(() => {
                      const guess = inferSubtype({ ...d, subtype: undefined });
                      return guess ? `${SUBTYPE_LABELS[guess]} (a névből)` : "nem tudni";
                    })()}
                  </option>
                  {SUBTYPE_OPTIONS[CATEGORY_OF[d.style] as SubtypeCategory].map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="row">
              <label className="inline">
                Liter
                <input type="number" step="0.01" min="0.01" value={d.volumeL} onChange={(e) => setDrink(d.id, { volumeL: Number(e.target.value) })} />
              </label>
              <label className="inline">
                Ár (Ft)
                <input type="number" step="10" min="0" value={d.price} onChange={(e) => setDrink(d.id, { price: Number(e.target.value) })} />
              </label>
              <label className="inline">
                HH ár
                <input
                  type="number"
                  step="10"
                  min="0"
                  value={d.hhPrice ?? ""}
                  placeholder="–"
                  onChange={(e) => setDrink(d.id, { hhPrice: e.target.value === "" ? undefined : Number(e.target.value) })}
                />
              </label>
              <button className="mini danger" onClick={() => setP({ ...p, drinks: p.drinks.filter((x) => x.id !== d.id) })}>
                Törlés
              </button>
            </div>
          </div>
        ))}
        <button
          className="btn ghost"
          onClick={() => setP({ ...p, drinks: [...p.drinks, { id: uid("d"), name: "", style: "lager", volumeL: 0.5, price: 0 }] })}
        >
          + Ital
        </button>

        {CATEGORY_ORDER.map((c) => (
          <datalist key={c} id={`brands-${c}`}>
            {brandSuggestions(c).map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        ))}
        {err && <p className="error">{err}</p>}
        <div className="sheet-actions sticky">
          <button className="btn ghost" onClick={onClose}>
            Mégse
          </button>
          <button className="btn primary" onClick={save}>
            Mentés
          </button>
        </div>
      </div>
    </div>
  );
}
