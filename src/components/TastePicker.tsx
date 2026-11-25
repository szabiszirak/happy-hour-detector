import { useState } from "react";
import { CATEGORY_ICONS, CATEGORY_LABELS, CATEGORY_ORDER, brandBadge, brandKey, canonicalBrand } from "../domain/drinkCatalog";
import { beerBrandOptions, prefLabels, SUBTYPE_OPTIONS, type SubtypeCategory } from "../domain/tasteProfile";
import type { DrinkCategory, DrinkSubtype, TastePrefs } from "../domain/types";
import { BrandIcon } from "./DrinkFilters";

export interface TasteValue {
  categories: DrinkCategory[];
  prefs: TastePrefs;
}

/**
 * Ízlésprofil-választó: kategóriák harmonikában. A kijelölt kategória alatt nyílik le a hozzá
 * tartozó finomító (sör: kedvenc márkák ABC-ben + egyéb; bor, rövidital, koktél, üdítő: alfajták).
 * Egyszerre egy finomító van nyitva, hogy mobilon is átlátható maradjon. A részletek nem kötelezők.
 */
export function TastePicker({ value, onChange }: { value: TasteValue; onChange: (v: TasteValue) => void }) {
  const [expanded, setExpanded] = useState<DrinkCategory | null>(value.categories[0] ?? null);

  const toggleCategory = (c: DrinkCategory) => {
    const on = value.categories.includes(c);
    const categories = on ? value.categories.filter((x) => x !== c) : CATEGORY_ORDER.filter((x) => x === c || value.categories.includes(x));
    onChange({ ...value, categories });
    setExpanded(on ? (expanded === c ? null : expanded) : c);
  };
  const onHead = (c: DrinkCategory) => {
    if (!value.categories.includes(c)) toggleCategory(c);
    else setExpanded(expanded === c ? null : c);
  };

  return (
    <div className="taste-list">
      {CATEGORY_ORDER.map((c) => {
        const selected = value.categories.includes(c);
        const open = selected && expanded === c;
        const chosen = prefLabels(value.prefs, c);
        return (
          <div key={c} className={`taste ${selected ? "selected" : ""} ${open ? "open" : ""}`}>
            <div className="taste-head-row">
              <button
                className={`taste-check ${selected ? "on" : ""}`}
                role="checkbox"
                aria-checked={selected}
                aria-label={`${CATEGORY_LABELS[c]} ${selected ? "kijelölve" : "kijelölése"}`}
                onClick={() => toggleCategory(c)}
              >
                {selected ? "✓" : ""}
              </button>
              <button className="taste-head" aria-expanded={open} onClick={() => onHead(c)}>
                <span className="cat-icon" aria-hidden="true">
                  {CATEGORY_ICONS[c]}
                </span>
                <span className="taste-text">
                  <span className="taste-label">{CATEGORY_LABELS[c]}</span>
                  {selected && (
                    <span className="taste-summary">{chosen.length ? chosen.join(", ") : "Pontosítanád? (nem kötelező)"}</span>
                  )}
                </span>
                {selected && (
                  <span className="cat-chevron" aria-hidden="true">
                    ▾
                  </span>
                )}
              </button>
            </div>
            {open && (c === "beer" ? <BeerPrefs value={value} onChange={onChange} /> : <SubtypePrefs cat={c} value={value} onChange={onChange} />)}
          </div>
        );
      })}
    </div>
  );
}

function BeerPrefs({ value, onChange }: { value: TasteValue; onChange: (v: TasteValue) => void }) {
  const [custom, setCustom] = useState("");
  const brands = value.prefs.beerBrands ?? [];
  const has = (b: string) => brands.some((x) => brandKey(x) === brandKey(b));
  const set = (list: string[]) => onChange({ ...value, prefs: { ...value.prefs, beerBrands: list } });
  const toggle = (b: string) => set(has(b) ? brands.filter((x) => brandKey(x) !== brandKey(b)) : [...brands, b]);
  const known = beerBrandOptions();
  const extra = brands.filter((b) => !known.some((k) => brandKey(k) === brandKey(b)));
  const addCustom = () => {
    const b = canonicalBrand(custom);
    if (brandKey(b) && !has(b)) set([...brands, b]);
    setCustom("");
  };

  return (
    <div className="taste-panel">
      <div className="cat-sub">Kedvenc márkák (több is lehet)</div>
      <div className="brand-chips">
        {[...known, ...extra].map((b) => (
          <button key={b} className={`brand-chip ${has(b) ? "on" : ""}`} aria-pressed={has(b)} onClick={() => toggle(b)}>
            <BrandIcon badge={brandBadge(b)} size={22} />
            {b}
          </button>
        ))}
      </div>
      <div className="custom-brand">
        <input
          value={custom}
          placeholder="Egyéb márka (pl. kézműves főzde)"
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addCustom()}
          maxLength={40}
        />
        <button className="mini" disabled={!brandKey(custom)} onClick={addCustom}>
          + Hozzáad
        </button>
      </div>
    </div>
  );
}

function SubtypePrefs({ cat, value, onChange }: { cat: Exclude<DrinkCategory, "beer">; value: TasteValue; onChange: (v: TasteValue) => void }) {
  const current = (value.prefs[cat] ?? []) as DrinkSubtype[];
  const toggle = (v: DrinkSubtype) => {
    const next = current.includes(v) ? current.filter((x) => x !== v) : [...current, v];
    onChange({ ...value, prefs: { ...value.prefs, [cat]: next } });
  };
  return (
    <div className="taste-panel">
      <div className="cat-sub">Mit szeretsz leginkább? (több is lehet)</div>
      <div className="chips">
        {SUBTYPE_OPTIONS[cat as SubtypeCategory].map((o) => (
          <button key={o.value} className={`chip ${current.includes(o.value) ? "on" : ""}`} aria-pressed={current.includes(o.value)} onClick={() => toggle(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
