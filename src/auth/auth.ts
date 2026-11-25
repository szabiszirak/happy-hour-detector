import type { AppUser } from "../domain/types";
import { getFirebaseApp, isFirebaseConfigured } from "../data/firebase";

export interface AuthService {
  readonly mode: "demo" | "firebase";
  onChange(cb: (user: AppUser | null) => void): () => void;
  signInWithGoogle(demoName?: string): Promise<void>;
  signOut(): Promise<void>;
}

const DEMO_KEY = "hhd.demo.user";

/** Demó belépés: nincs valódi Google-fiók, a felhasználó a böngészőben tárolódik. */
class DemoAuth implements AuthService {
  readonly mode = "demo" as const;
  private user: AppUser | null = null;
  private subs = new Set<(u: AppUser | null) => void>();

  constructor() {
    try {
      const raw = localStorage.getItem(DEMO_KEY);
      this.user = raw ? JSON.parse(raw) : null;
    } catch {
      this.user = null;
    }
  }

  private set(u: AppUser | null) {
    this.user = u;
    try {
      if (u) localStorage.setItem(DEMO_KEY, JSON.stringify(u));
      else localStorage.removeItem(DEMO_KEY);
    } catch {
      /* nincs tároló */
    }
    this.subs.forEach((cb) => cb(u));
  }

  onChange(cb: (u: AppUser | null) => void) {
    this.subs.add(cb);
    cb(this.user);
    return () => this.subs.delete(cb);
  }

  async signInWithGoogle(demoName?: string) {
    const name = demoName?.trim() || "Demó Felhasználó";
    const slug = name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-");
    this.set({ uid: `demo-${slug}`, displayName: name, email: `${slug}@demo.local` });
  }

  async signOut() {
    this.set(null);
  }
}

/** Éles belépés: Firebase Authentication, Google-fiókkal (egy gombnyomás). */
class FirebaseAuth implements AuthService {
  readonly mode = "firebase" as const;

  onChange(cb: (u: AppUser | null) => void) {
    let unsub = () => {};
    let cancelled = false;
    (async () => {
      const app = await getFirebaseApp();
      const { getAuth, onAuthStateChanged } = await import("firebase/auth");
      if (cancelled) return;
      unsub = onAuthStateChanged(getAuth(app), async (fu) => {
        if (!fu) return cb(null);
        // Az `admin` jog a Firebase Auth custom claimből jön (csak szerverről állítható be).
        const token = await fu.getIdTokenResult().catch(() => null);
        cb({
          uid: fu.uid,
          displayName: fu.displayName ?? "Névtelen",
          email: fu.email ?? undefined,
          photoURL: fu.photoURL ?? undefined,
          isAdmin: token?.claims.admin === true,
        });
      });
    })();
    return () => {
      cancelled = true;
      unsub();
    };
  }

  async signInWithGoogle() {
    const app = await getFirebaseApp();
    const { getAuth, GoogleAuthProvider, signInWithPopup } = await import("firebase/auth");
    await signInWithPopup(getAuth(app), new GoogleAuthProvider());
  }

  async signOut() {
    const app = await getFirebaseApp();
    const { getAuth, signOut } = await import("firebase/auth");
    await signOut(getAuth(app));
  }
}

export const auth: AuthService = isFirebaseConfigured ? new FirebaseAuth() : new DemoAuth();
