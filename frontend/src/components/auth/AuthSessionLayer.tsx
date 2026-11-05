import { useEffect, useRef, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { getMe } from "../../apis/auth.api";
import {
  clearUser,
  clearFirebaseUser,
  setAuthLoading,
  setFirebaseUser,
  setUser,
} from "../../store/authSlice";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  isFirebaseClientConfigured,
  signOutFromFirebase,
  subscribeToFirebaseAuth,
} from "../../config/firebase";
import {
  clearSessionFlag,
  hasSessionFlag,
  SESSION_FLAG_KEY,
  setSessionFlag,
} from "../../utils/sessionFlag";

type AuthSessionLayerProps = {
  children: ReactNode;
};

export function SessionLoader() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f5f2] text-stone-700">
      <p role="status">Loading your session...</p>
    </main>
  );
}

export default function AuthSessionLayer({
  children,
}: AuthSessionLayerProps) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const status = useAppSelector((state) => state.auth.status);
  const restoreStarted = useRef(false);

  useEffect(() => {
    if (restoreStarted.current) {
      return;
    }

    restoreStarted.current = true;
    if (!hasSessionFlag()) {
      dispatch(clearUser());
      if (isFirebaseClientConfigured()) {
        void signOutFromFirebase().catch((error: unknown) => {
          console.error("Unable to clear the Firebase session", error);
        });
      }
      return;
    }

    dispatch(setAuthLoading());
    void getMe()
      .then(({ user }) => {
        if (!hasSessionFlag()) {
          dispatch(clearUser());
          return;
        }

        setSessionFlag();
        dispatch(setUser(user));
      })
      .catch(() => {
        clearSessionFlag();
        dispatch(clearUser());
        if (isFirebaseClientConfigured()) {
          void signOutFromFirebase().catch((error: unknown) => {
            console.error("Unable to clear the Firebase session", error);
          });
        }
      });
  }, [dispatch]);

  useEffect(() => {
    if (!isFirebaseClientConfigured()) {
      return;
    }

    try {
      return subscribeToFirebaseAuth(
        (firebaseUser) => {
          if (firebaseUser) {
            dispatch(setFirebaseUser(firebaseUser));
          } else {
            dispatch(clearFirebaseUser());
          }
        },
        (error) => {
          dispatch(clearFirebaseUser());
          console.error("Firebase authentication state listener failed", error);
        },
      );
    } catch (error) {
      console.error("Unable to initialize Firebase authentication", error);
      return;
    }
  }, [dispatch]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (
        (event.key === SESSION_FLAG_KEY || event.key === null) &&
        !hasSessionFlag()
      ) {
        dispatch(clearUser());
        if (isFirebaseClientConfigured()) {
          void signOutFromFirebase().catch((error: unknown) => {
            console.error("Unable to clear the Firebase session", error);
          });
        }
        navigate("/signin", { replace: true });
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [dispatch, navigate]);

  if (status === "loading" || status === "idle") {
    return <SessionLoader />;
  }

  return children;
}
