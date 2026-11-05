import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { env } from "./env.js";

const existingApp = getApps().find((app) => app.name === "[DEFAULT]");

const firebaseApp =
  existingApp ??
  (() => {
    try {
      return initializeApp({
        credential: cert({
          projectId: env.FIREBASE_PROJECT_ID,
          clientEmail: env.FIREBASE_CLIENT_EMAIL,
          privateKey: env.FIREBASE_PRIVATE_KEY,
        }),
        projectId: env.FIREBASE_PROJECT_ID,
      });
    } catch {
      throw new Error(
        "Firebase Admin initialization failed. Check the Firebase environment configuration.",
      );
    }
  })();

if (firebaseApp.options.projectId !== env.FIREBASE_PROJECT_ID) {
  throw new Error(
    "Firebase Admin app project ID does not match FIREBASE_PROJECT_ID.",
  );
}

export const firestore = getFirestore(firebaseApp);
export const firebaseAdminAuth = getAuth(firebaseApp);
