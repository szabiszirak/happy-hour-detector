import type { Repo } from "./repo";
import { isFirebaseConfigured } from "./firebase";
import { LocalRepo } from "./localRepo";

/** A megfelelő adatréteg: Firebase-kulcsokkal éles, nélkülük demó. */
export async function createRepo(): Promise<Repo> {
  if (isFirebaseConfigured) {
    const { FirebaseRepo } = await import("./firebaseRepo");
    return FirebaseRepo.create();
  }
  return new LocalRepo();
}
