import { cert, getApps, initializeApp } from "firebase-admin/app";
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

export const firestore = getFirestore(firebaseApp);
