import { lazy, Suspense, useEffect } from "react";
import { Navigate, Outlet, Route, Routes, useNavigate } from "react-router-dom";
import { getMe } from "./apis/auth.api";
import { clearUser, setAuthLoading, setUser } from "./store/authSlice";
import { useAppDispatch, useAppSelector } from "./store/hooks";
import {
  clearSessionFlag,
  hasSessionFlag,
  SESSION_FLAG_KEY,
  setSessionFlag,
} from "./utils/sessionFlag";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const SignIn = lazy(() => import("./pages/SignIn"));
const SignUp = lazy(() => import("./pages/SignUp"));

let sessionRestore: Promise<void> | null = null;

function SessionManager() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    if (sessionRestore) {
      return;
    }

    if (!hasSessionFlag()) {
      dispatch(clearUser());
      return;
    }

    dispatch(setAuthLoading());
    sessionRestore = getMe()
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

  return null;
}

function SessionLoader() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f5f2] text-stone-700">
      <p role="status">Loading your session...</p>
    </main>
  );
}

function PublicOnlyRoute() {
  const status = useAppSelector((state) => state.auth.status);

  if (status === "loading" || status === "idle") {
    return <SessionLoader />;
  }

  return status === "authenticated" ? (
    <Navigate to="/dashboard" replace />
  ) : (
    <Outlet />
  );
}

function ProtectedRoute() {
  const status = useAppSelector((state) => state.auth.status);

  if (status === "loading" || status === "idle") {
    return <SessionLoader />;
  }

  return status === "authenticated" ? (
    <Outlet />
  ) : (
    <Navigate to="/signin" replace />
  );
}

export default function App() {
  return (
    <>
      <SessionManager />
      <Suspense fallback={<SessionLoader />}>
        <Routes>
          <Route element={<PublicOnlyRoute />}>
            <Route path="/" element={<Navigate to="/signin" replace />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
          </Route>
          <Route path="*" element={<Navigate to="/signin" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}
