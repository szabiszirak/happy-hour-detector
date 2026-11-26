import { useEffect, useRef, useState } from "react";
import type { Repo } from "../data/repo";
import type { AppUser } from "../domain/types";
import {
  AVATAR_TEXT_COLOR,
  DEFAULT_AVATAR_SETTINGS,
  resolveAvatar,
  validateAvatarFile,
  type AvatarSettings,
} from "../domain/avatar";

/** A felhasználó profilkép-beállítása (élőben követve). */
export function useAvatarSettings(repo: Repo, uid: string): AvatarSettings {
  const [s, setS] = useState<AvatarSettings>(DEFAULT_AVATAR_SETTINGS);
  useEffect(() => repo.subscribeAvatar(uid, setS), [repo, uid]);
  return s;
}

/** Profilkép, ha nincs vagy nem töltődik be: kezdőbetű (domain/avatar.ts resolveAvatar). */
export function Avatar({ user, settings, size = 34 }: { user: AppUser; settings: AvatarSettings; size?: number }) {
  const [failed, setFailed] = useState<string[]>([]);
  const view = resolveAvatar(user, settings, failed);
  const style = { width: size, height: size, fontSize: Math.round(size * 0.4), background: view.color, color: AVATAR_TEXT_COLOR };
  return (
    <span className="avatar-img" style={style} aria-hidden="true">
      {view.kind === "image" ? (
        <img src={view.url} alt="" referrerPolicy="no-referrer" onError={() => setFailed((f) => [...f, view.url])} />
      ) : (
        view.initials
      )}
    </span>
  );
}

/** Profilkép beállítása: feltöltés, Google-fiók képe, csak kezdőbetű, törlés. */
export function AvatarPicker({ repo, user, onMessage }: { repo: Repo; user: AppUser; onMessage?: (m: string) => void }) {
  const settings = useAvatarSettings(repo, user.uid);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const view = resolveAvatar(user, settings);
  const now =
    view.kind === "initials"
      ? settings.pref === "initials"
        ? "Csak kezdőbetű"
        : "Kezdőbetű (nincs kép)"
      : view.source === "custom"
        ? "Saját kép"
        : "Google-fiók képe";

  const run = async (f: () => Promise<void>, ok: string) => {
    setErr(null);
    setBusy(true);
    try {
      await f();
      onMessage?.(ok);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Nem sikerült.");
    } finally {
      setBusy(false);
    }
  };

  const onFile = (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    const e = validateAvatarFile({ mime: file.type, size: file.size });
    if (e) return setErr(e);
    void run(() => repo.setAvatar(user.uid, file), "Profilkép beállítva.");
  };

  return (
    <div className="avatar-picker">
      <Avatar user={user} settings={settings} size={64} />
      <div className="avatar-info">
        <span>
          <strong>Profilkép</strong> <span className="muted small">· {now}</span>
        </span>
        <div className="avatar-actions">
          <button className="mini" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? "Mentés…" : "📷 Kép feltöltése"}
          </button>
          {user.photoURL && (settings.custom || settings.pref === "initials") && (
            <button
              className="mini"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  if (settings.custom) await repo.clearAvatar(user.uid);
                  await repo.setAvatarPref(user.uid, "auto");
                }, "A Google-fiók képe látszik.")
              }
            >
              Google-fiók képe
            </button>
          )}
          {settings.pref !== "initials" && (
            <button className="mini" disabled={busy} onClick={() => run(() => repo.setAvatarPref(user.uid, "initials"), "Kezdőbetű látszik.")}>
              Csak kezdőbetű
            </button>
          )}
          {settings.pref === "initials" && settings.custom && (
            <button className="mini" disabled={busy} onClick={() => run(() => repo.setAvatarPref(user.uid, "auto"), "A saját képed látszik.")}>
              Saját kép mutatása
            </button>
          )}
          {settings.custom && (
            <button className="mini" disabled={busy} onClick={() => run(() => repo.clearAvatar(user.uid), "Kép törölve.")}>
              Kép törlése
            </button>
          )}
        </div>
        <span className="fine">JPG, PNG vagy WebP, max. 5 MB – 256×256-ra kicsinyítve tároljuk.</span>
        {err && <span className="field-err">{err}</span>}
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden aria-label="Profilkép feltöltése" onChange={(e) => onFile(e.target.files?.[0])} />
      </div>
    </div>
  );
}
