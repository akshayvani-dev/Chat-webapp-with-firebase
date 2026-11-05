import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { logout } from "../../apis/auth.api";
import {
  getUsers,
  initiateConversation,
} from "../../apis/users.api";
import { getErrorMessage } from "../../apis/axiosInstance";
import ConfirmDialog from "../ui/ConfirmDialog";
import { clearUser } from "../../store/authSlice";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { clearSessionFlag } from "../../utils/sessionFlag";
import { signOutFromFirebase } from "../../config/firebase";
import type { ListedUser } from "../../types/chat.types";
import UserListItem from "./UserListItem";

type SidebarProps = {
  className?: string;
};

export default function Sidebar({ className = "" }: SidebarProps) {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { id: selectedUserId } = useParams();
  const currentUserName = useAppSelector(
    (state) => state.auth.user?.name ?? "Account",
  );
  const [users, setUsers] = useState<ListedUser[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [retryUsers, setRetryUsers] = useState(0);
  const initiatingUserIdsRef = useRef(new Set<string>());
  const [initiatingUserIds, setInitiatingUserIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [initiationError, setInitiationError] = useState<string | null>(null);
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    let active = true;

    const loadUsers = async () => {
      setIsLoadingUsers(true);
      setUsersError(null);
      try {
        const result = await getUsers(currentPage);
        if (!active) {
          return;
        }

        setUsers(result.users);
        setTotalPages(result.totalPages);
        setTotalUsers(result.total);
      } catch {
        if (active) {
          setUsersError("Unable to load users.");
        }
      } finally {
        if (active) {
          setIsLoadingUsers(false);
        }
      }
    };

    void loadUsers();
    return () => {
      active = false;
    };
  }, [currentPage, retryUsers]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      try {
        await signOutFromFirebase();
      } catch (error) {
        console.error("Firebase logout failed; clearing the local session.", error);
      }
      try {
        await logout();
      } catch (error) {
        console.error("Server logout failed; clearing the local session.", error);
      }
    } finally {
      clearSessionFlag();
      dispatch(clearUser());
      navigate("/signin", { replace: true });
    }
  };

  const handleSelectUser = async (user: ListedUser) => {
    if (initiatingUserIdsRef.current.has(user.id)) {
      return;
    }

    setInitiationError(null);
    if (user.chatInitiated) {
      if (!user.conversationId) {
        setInitiationError("This conversation could not be opened.");
        return;
      }

      navigate(`/dashboard/chat_room/${encodeURIComponent(user.id)}`);
      return;
    }

    initiatingUserIdsRef.current.add(user.id);
    setInitiatingUserIds((current) => new Set(current).add(user.id));
    try {
      const result = await initiateConversation(user.id);
      setUsers((currentUsers) =>
        currentUsers.map((currentUser) =>
          currentUser.id === user.id
            ? {
                ...currentUser,
                chatInitiated: result.chatInitiated,
                conversationId: result.conversationId,
              }
            : currentUser,
        ),
      );
      navigate(`/dashboard/chat_room/${encodeURIComponent(user.id)}`);
    } catch (error) {
      setInitiationError(getErrorMessage(error));
    } finally {
      initiatingUserIdsRef.current.delete(user.id);
      setInitiatingUserIds((current) => {
        const next = new Set(current);
        next.delete(user.id);
        return next;
      });
    }
  };

  return (
    <aside
      className={`flex h-full min-h-0 flex-col border-r border-stone-200 bg-white ${className}`}
      aria-label="Chats"
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-stone-200 px-5 py-5">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
            Signed in as
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-stone-900">
            {currentUserName}
          </p>
        </div>
        <button
          className="shrink-0 rounded-lg border border-stone-200 px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/40"
          type="button"
          onClick={() => setIsLogoutDialogOpen(true)}
        >
          Logout
        </button>
      </header>

      <div className="shrink-0 px-5 pb-2 pt-5">
        <h1 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
          Users
        </h1>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {isLoadingUsers ? (
          <p className="px-4 py-3 text-sm text-stone-500" role="status">
            Loading users...
          </p>
        ) : usersError ? (
          <div className="px-4 py-3">
            <p className="text-sm text-red-700" role="alert">
              {usersError}
            </p>
            <button
              className="mt-2 text-sm font-semibold text-emerald-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/40"
              type="button"
              onClick={() => setRetryUsers((retryCount) => retryCount + 1)}
            >
              Try again
            </button>
          </div>
        ) : users.length === 0 ? (
          <p className="px-4 py-3 text-sm text-stone-500">
            No other users found.
          </p>
        ) : (
          <>
            {initiationError && (
              <p className="px-4 py-3 text-sm text-red-700" role="alert">
                {initiationError}
              </p>
            )}
            {users.map((user) => (
              <UserListItem
                key={user.id}
                user={user}
                isSelected={user.id === selectedUserId}
                isLoading={initiatingUserIds.has(user.id)}
                onSelect={() => void handleSelectUser(user)}
              />
            ))}
          </>
        )}
      </nav>
      {totalPages > 0 && (
        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-stone-200 px-4 py-3">
          <p className="text-xs text-stone-500" aria-live="polite">
            Page {currentPage} of {totalPages} · {totalUsers} users
          </p>
          <div className="flex gap-2">
            <button
              className="rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/40 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={isLoadingUsers || currentPage <= 1}
              onClick={() => setCurrentPage((page) => page - 1)}
            >
              Previous
            </button>
            <button
              className="rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/40 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={isLoadingUsers || currentPage >= totalPages}
              onClick={() => setCurrentPage((page) => page + 1)}
            >
              Next
            </button>
          </div>
        </footer>
      )}
      <ConfirmDialog
        open={isLogoutDialogOpen}
        onOpenChange={setIsLogoutDialogOpen}
        title="Log out"
        description="Are you sure you want to log out?"
        confirmLabel="Log out"
        onConfirm={handleLogout}
        isLoading={isLoggingOut}
        variant="danger"
      />
    </aside>
  );
}
