import type { Report } from "./types";

/** Egy bejelentés ennyi ideig él („ma csak 700” holnapra már nem igaz). */
export const REPORT_TTL_MS = 12 * 60 * 60 * 1000;

export type ReportStatus = "fresh" | "confirmed" | "disputed" | "expired";

export function reportStatus(r: Report, now: number): ReportStatus {
  if (now >= r.expiresAt) return "expired";
  const net = r.confirms.length - r.denies.length;
  if (r.denies.length >= 2 && net < 0) return "disputed";
  if (r.confirms.length >= 2 && net > 0) return "confirmed";
  return "fresh";
}

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  fresh: "Friss",
  confirmed: "Megerősítve",
  disputed: "Vitatott",
  expired: "Lejárt",
};

/** Szavazás: egy felhasználó vagy megerősít, vagy cáfol – a kettő kizárja egymást. */
export function applyVote(r: Report, uid: string, vote: "confirm" | "deny"): Report {
  const confirms = r.confirms.filter((u) => u !== uid);
  const denies = r.denies.filter((u) => u !== uid);
  if (vote === "confirm") confirms.push(uid);
  else denies.push(uid);
  return { ...r, confirms, denies };
}

export function timeAgo(ts: number, now: number): string {
  const min = Math.max(0, Math.round((now - ts) / 60000));
  if (min < 1) return "most";
  if (min < 60) return `${min} perce`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} órája`;
  return `${Math.round(h / 24)} napja`;
}

/** Ár kiszedése a szövegből: „ma csak 700 forint az arany ászok” → 700. */
export function extractPrice(text: string): number | undefined {
  const m = text.match(/(\d{3,5})\s*(ft|forint|huf)?/i);
  if (!m) return undefined;
  const n = Number(m[1]);
  return n >= 100 && n <= 20000 ? n : undefined;
}
