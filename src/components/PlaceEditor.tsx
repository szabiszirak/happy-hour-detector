import { useState } from "react";
import { useApp } from "../context";
import { brandSuggestions, canonicalBrand, CATEGORY_OF, CATEGORY_ORDER } from "../domain/drinkCatalog";
import { inferSubtype, SUBTYPE_CATEGORY, SUBTYPE_LABELS, SUBTYPE_OPTIONS, type SubtypeCategory } from "../domain/tasteProfile";
import { STYLE_LABELS, VIBE_LABELS, type Drink, type DrinkStyle, type DrinkSubtype, type HappyHourSlot, type Place, type Vibe } from "../domain/types";

const DAYS = ["H", "K", "Sze", "Cs", "P", "Szo", "V"];
const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function validate(p: Place): string | null {
  if (!p.name.trim()) return "Add meg a hely nevét.";
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

/** Bármelyik belépett felhasználó szerkesztheti a hely adatait (Waze-elv). */
export function PlaceEditor({ place, onClose }: { place: Place; onClose: () => void }) {
  const { repo, user, toast } = useApp();
  const [p, setP] = useState<Place>(() => structuredClone(place));
  const [err, setErr] = useState<string | null>(null);

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
    await repo.savePlace(JSON.parse(JSON.stringify({ ...p, name: p.name.trim(), drinks })), user);
    toast("Mentve. Köszi, hogy frissítetted!");
    onClose();
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet editor" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Hely szerkesztése">
        <div className="sheet-head">
          <h2>Szerkesztés</h2>
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
