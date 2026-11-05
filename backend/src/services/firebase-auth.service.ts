import { AppError } from "../utils/AppError.js";
import { firebaseAdminAuth } from "../config/firebase.js";
import type { AuthenticatedUser } from "../types/auth.js";

function getFirebaseErrorCode(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }
  return undefined;
}

function throwFirebaseAuthError(
  operation: string,
  error: unknown,
  fallbackMessage: string,
): never {
  const code = getFirebaseErrorCode(error);
  console.error("Firebase Auth operation failed", {
    operation,
    code: code ?? "unknown",
  });

  if (code === "auth/configuration-not-found") {
    throw new AppError(
      503,
      "Firebase Authentication is not configured for this project. Enable Firebase Authentication in Firebase Console.",
    );
  }

  throw new AppError(503, fallbackMessage);
}

export async function ensureFirebaseUser(
  user: AuthenticatedUser,
): Promise<boolean> {
  try {
    await firebaseAdminAuth.getUser(user.id);
    return false;
  } catch (error) {
    if (getFirebaseErrorCode(error) !== "auth/user-not-found") {
      throwFirebaseAuthError("getUser", error, "Unable to verify Firebase user");
    }
  }

  try {
    await firebaseAdminAuth.createUser({
      uid: user.id,
      email: user.email,
      displayName: user.name,
    });
    return true;
  } catch (error) {
    if (getFirebaseErrorCode(error) !== "auth/email-already-exists") {
      throwFirebaseAuthError("createUser", error, "Unable to create Firebase user");
    }

    let existingUser;
    try {
      existingUser = await firebaseAdminAuth.getUserByEmail(user.email);
    } catch (lookupError) {
      throwFirebaseAuthError(
        "getUserByEmail",
        lookupError,
        "Unable to verify Firebase user",
      );
    }

    if (existingUser.uid !== user.id) {
      throw new AppError(
        409,
        "This email is already linked to a different Firebase account",
      );
    }
    return false;
  }
}

export async function createFirebaseCustomToken(userId: string): Promise<string> {
  try {
    return await firebaseAdminAuth.createCustomToken(userId);
  } catch (error) {
    throwFirebaseAuthError(
      "createCustomToken",
      error,
      "Unable to create Firebase authentication token",
    );
  }
}

export async function deleteFirebaseUser(userId: string): Promise<void> {
  await firebaseAdminAuth.deleteUser(userId);
}
