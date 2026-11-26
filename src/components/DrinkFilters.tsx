import { useMemo, useState } from "react";
import { buildCatalog, OTHER_BRAND, splitBrandList, type BrandBadge, type BrandEntry, type CategoryNode, type DrinkCategory } from "../domain/drinkCatalog";
import type { DrinkFilter } from "../domain/search";
import type { DrinkStyle, Place } from "../domain/types";

/** Saját monogram-jelvény a márkához (nem logó). */
export function BrandIcon({ badge, size = 26 }: { badge: BrandBadge; size?: number }) {
  return (
    <span
      className="brand-icon"
      aria-hidden="true"
      style={{ background: badge.color, color: badge.textColor, width: size, height: size, fontSize: size * 0.42 }}
    >
      {badge.initials}
    </span>
  );
}

/**
 * Kategória-harmonika a „Piák & árak” fülhöz.
 * Alapból csak a kategóriák látszanak; a kiválasztott kategória nyílik le
 * (stílusok + ABC-sorrendű márkalista), a többi csukva marad.
 */
export function CategoryFilter({
  places,
  filter,
  setFilter,
}: {
  places: Place[];
  filter: DrinkFilter;
  setFilter: (f: DrinkFilter) => void;
}) {
  const catalog = useMemo(() => buildCatalog(places), [places]);

  const toggleCategory = (c: DrinkCategory) =>
    setFilter(
      filter.category === c
        ? { ...filter, category: null, styles: [], brand: null } // újra rákoppintva: összecsuk, minden kategória
        : { ...filter, category: c, styles: [], brand: null },
    );

  return (
    <div className="cat-list" role="list">
      {catalog.map((node) => {
        const open = filter.category === node.category;
        return (
          <div key={node.category} className={`cat ${open ? "open" : ""}`} role="listitem">
            <button
              className="cat-head"
              aria-expanded={open}
              aria-controls={`cat-panel-${node.category}`}
              onClick={() => toggleCategory(node.category)}
            >
              <span className="cat-icon" aria-hidden="true">
                {node.icon}
              </span>
              <span className="cat-label">{node.label}</span>
              <span className={`cat-count ${node.count ? "" : "zero"}`}>{node.count ? `${node.count} ár` : "még nincs ár"}</span>
              <span className="cat-chevron" aria-hidden="true">
                ▾
              </span>
            </button>
            {open && <CategoryPanel node={node} filter={filter} setFilter={setFilter} />}
          </div>
        );
      })}
    </div>
  );
}

function CategoryPanel({
  node,
  filter,
  setFilter,
}: {
  node: CategoryNode;
  filter: DrinkFilter;
  setFilter: (f: DrinkFilter) => void;
}) {
  const toggleStyle = (s: DrinkStyle) =>
    setFilter({ ...filter, styles: filter.styles.includes(s) ? filter.styles.filter((x) => x !== s) : [...filter.styles, s] });
  const pick = (brand: string | null) => setFilter({ ...filter, brand });
  const [showMore, setShowMore] = useState(false);
  const [q, setQ] = useState("");
  // felül az árazott márkák; a még ár nélküli ismert márkák (a katalógusból akár 100+) összecsukva, kereshetően
  const { shown, more, moreTotal } = splitBrandList(node.brands, filter.brand, q);
  const row = (b: BrandEntry) => (
    <li key={b.key}>
      <button
        className={`brand-row ${filter.brand === b.key ? "on" : ""} ${b.count ? "" : "no-price"}`}
        aria-pressed={filter.brand === b.key}
        onClick={() => pick(b.key)}
      >
        <BrandIcon badge={b.badge} />
        <span className="brand-name">{b.label}</span>
        <span className="brand-count">{b.count ? b.count : "még nincs ár"}</span>
      </button>
    </li>
  );

  return (
    <div className="cat-panel" id={`cat-panel-${node.category}`}>
      {node.styles.length > 1 && (
        <>
          <div className="cat-sub">Fajta</div>
          <div className="chips">
            {node.styles.map((s) => (
              <button
                key={s.style}
                className={`chip small ${filter.styles.includes(s.style) ? "on" : ""}`}
                aria-pressed={filter.styles.includes(s.style)}
                onClick={() => toggleStyle(s.style)}
              >
                {s.label}
                {s.count > 0 && <span className="chip-count">{s.count}</span>}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="cat-sub">Márka</div>
      <ul className="brand-list">
        <li>
          <button className={`brand-row ${filter.brand === null ? "on" : ""}`} aria-pressed={filter.brand === null} onClick={() => pick(null)}>
            <span className="brand-icon all" aria-hidden="true">
              ★
            </span>
            <span className="brand-name">Összes márka</span>
            <span className="brand-count">{node.count || ""}</span>
          </button>
        </li>
        {shown.map(row)}
        <li>
          <button
            className={`brand-row ${filter.brand === OTHER_BRAND ? "on" : ""} ${node.otherCount ? "" : "no-price"}`}
            aria-pressed={filter.brand === OTHER_BRAND}
            onClick={() => pick(OTHER_BRAND)}
          >
            <span className="brand-icon other" aria-hidden="true">
              …
            </span>
            <span className="brand-name">Egyéb (márka nélkül)</span>
            <span className="brand-count">{node.otherCount || "még nincs ár"}</span>
          </button>
        </li>
      </ul>
      {moreTotal > 0 && (
        <div className="brand-more">
          <button className="mini" aria-expanded={showMore} onClick={() => setShowMore(!showMore)}>
            {showMore ? "▲ Kevesebb" : `▼ További ismert márkák (${moreTotal})`}
          </button>
          {showMore && (
            <>
              <input className="brand-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Márka keresése…" aria-label="Márka keresése" />
              <ul className="brand-list">{more.length ? more.map(row) : <li className="muted small">Nincs ilyen márka.</li>}</ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Az aktuális kategória-választás rövid leírása az üres állapothoz. */
export function selectionLabel(filter: DrinkFilter, places: Place[]): string | null {
  if (!filter.category) return null;
  const node = buildCatalog(places).find((c) => c.category === filter.category)!;
  const brand =
    filter.brand === OTHER_BRAND ? "márka nélkül" : filter.brand ? node.brands.find((b) => b.key === filter.brand)?.label : null;
  return [node.label, brand].filter(Boolean).join(" · ");
}
