import { lazy, Suspense } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "./store/hooks";
import { SessionLoader } from "./components/auth/AuthSessionLayer";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const ChatPanel = lazy(() => import("./components/chat/ChatPanel"));
const SignIn = lazy(() => import("./pages/SignIn"));
const SignUp = lazy(() => import("./pages/SignUp"));

function PublicOnlyRoute() {
  const status = useAppSelector((state) => state.auth.status);

  if (status === "loading" || status === "idle") {
    return <SessionLoader />;
  }

  return status === "authenticated" ? (
    <Navigate to="/dashboard/chat_room" replace />
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
    <Suspense fallback={<SessionLoader />}>
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/" element={<Navigate to="/signin" replace />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />}>
            <Route index element={<Navigate to="chat_room" replace />} />
            <Route path="chat_room" element={<ChatPanel />} />
            <Route path="chat_room/:id" element={<ChatPanel />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/signin" replace />} />
      </Routes>
    </Suspense>
  );
}
