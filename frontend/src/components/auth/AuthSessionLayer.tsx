import { useEffect, useRef, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { getMe } from "../../apis/auth.api";
import { clearUser, setAuthLoading, setUser } from "../../store/authSlice";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
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
      });
  }, [dispatch]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (
        (event.key === SESSION_FLAG_KEY || event.key === null) &&
        !hasSessionFlag()
      ) {
        dispatch(clearUser());
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
