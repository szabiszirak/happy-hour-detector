// data/drink-catalog.json előállítása a src/domain/catalogData.ts-ből.
// Futtatás: npm run catalog:export
import { writeFileSync } from "node:fs";
import { exportCatalog } from "../src/domain/drinkCatalog";

writeFileSync(new URL("../data/drink-catalog.json", import.meta.url), JSON.stringify(exportCatalog(), null, 2) + "\n");
console.log("data/drink-catalog.json frissítve");
