import {
  browserLocalPersistence,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithCustomToken,
  signOut,
  type User,
} from "firebase/auth";
import { getApps, initializeApp } from "firebase/app";
import type { Unsubscribe } from "firebase/auth";

export type FirebaseClientUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
};

function getFirebaseConfig() {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
}

export function isFirebaseClientConfigured(): boolean {
  return Object.values(getFirebaseConfig()).every(
    (value) => typeof value === "string" && value.trim().length > 0,
  );
}

function toFirebaseClientUser(user: User): FirebaseClientUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
  };
}

export function getFirebaseApp() {
  const config = getFirebaseConfig();
  if (!isFirebaseClientConfigured()) {
    throw new Error(
      "Firebase client configuration is incomplete. Set the VITE_FIREBASE_* variables.",
    );
  }

  return (
    getApps().find((existingApp) => existingApp.name === "frontend-auth") ??
    initializeApp(config, "frontend-auth")
  );
}

function getFirebaseAuth() {
  return getAuth(getFirebaseApp());
}

export async function verifyCurrentFirebaseUser(
  expectedUid: string,
): Promise<void> {
  const auth = getFirebaseAuth();
  await auth.authStateReady();
  if (!auth.currentUser || auth.currentUser.uid !== expectedUid) {
    throw new Error("Firebase user does not match the signed-in account");
  }
}

export async function signInWithFirebaseCustomToken(
  customToken: string,
): Promise<FirebaseClientUser> {
  const auth = getFirebaseAuth();
  await setPersistence(auth, browserLocalPersistence);
  const credential = await signInWithCustomToken(auth, customToken);
  return toFirebaseClientUser(credential.user);
}

export async function signOutFromFirebase(): Promise<void> {
  await signOut(getFirebaseAuth());
}

export function subscribeToFirebaseAuth(
  onUser: (user: FirebaseClientUser | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onAuthStateChanged(
    getFirebaseAuth(),
    (user) => onUser(user ? toFirebaseClientUser(user) : null),
    onError,
  );
}
