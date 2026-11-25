import type { CategoryBudgets, DrinkCategory } from "../domain/types";
import { CATEGORY_ICONS, CATEGORY_LABELS } from "../domain/drinkCatalog";
import { BUDGET_STEPS, BUDGET_UNIT, defaultBudget } from "../domain/priceBudget";
import { formatFt } from "../domain/pricing";

/** Ízlésprofil utolsó lépése: kategóriánkénti árkeret – csak a kiválasztott kategóriákra. */
export function BudgetPicker({
  categories,
  value,
  onChange,
}: {
  categories: DrinkCategory[];
  value: CategoryBudgets;
  onChange: (v: CategoryBudgets) => void;
}) {
  return (
    <div className="budget-list">
      {categories.map((c) => {
        const current = c in value ? value[c] : defaultBudget(c);
        const set = (v: number | null) => onChange({ ...value, [c]: v });
        return (
          <section key={c} className="budget-row" aria-label={CATEGORY_LABELS[c]}>
            <header>
              <span className="emoji" aria-hidden="true">
                {CATEGORY_ICONS[c]}
              </span>
              <div>
                <strong>{CATEGORY_LABELS[c]}</strong>
                <span className="muted small">{BUDGET_UNIT[c].question} legfeljebb…</span>
              </div>
            </header>
            <div className="chips" role="radiogroup">
              {BUDGET_STEPS[c].map((s) => (
                <button key={s} role="radio" aria-checked={current === s} className={`chip ${current === s ? "on" : ""}`} onClick={() => set(s)}>
                  {formatFt(s)}
                </button>
              ))}
              <button role="radio" aria-checked={current === null} className={`chip ${current === null ? "on" : ""}`} onClick={() => set(null)}>
                Mindegy
              </button>
            </div>
          </section>
        );
      })}
    </div>
  );
}
