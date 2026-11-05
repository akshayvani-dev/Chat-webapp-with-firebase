async function checkFirebaseConnection(): Promise<void> {
  try {
    const { firestore } = await import("../config/firebase.js");
    await firestore.doc("_firebase_connection_check/status").get();
    console.log("Firebase Admin SDK initialized successfully.");
    console.log("Firestore read access verified; no data was written.");
  } catch {
    console.error(
      "Firebase connection check failed. Verify the service-account environment values and Firestore permissions.",
    );
    process.exitCode = 1;
  }
}

void checkFirebaseConnection();
