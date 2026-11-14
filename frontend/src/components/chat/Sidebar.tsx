import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LogOut, MessageCircle, UsersRound } from "lucide-react";
import { logout } from "../../apis/auth.api";
import { getRecentConversations } from "../../apis/conversations.api";
import { getUsers, initiateConversation } from "../../apis/users.api";
import { getErrorMessage } from "../../apis/axiosInstance";
import ConfirmDialog from "../ui/ConfirmDialog";
import { clearUser } from "../../store/authSlice";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { clearSessionFlag } from "../../utils/sessionFlag";
import { signOutFromFirebase } from "../../config/firebase";
import type { ListedUser, RecentConversation } from "../../types/chat.types";
import {
  useRecentConversations,
  type SidebarTab,
} from "./RecentConversationsContext";
import UserListItem from "./UserListItem";

type SidebarProps = {
  className?: string;
};

const RECENT_PAGE_SIZE = 10;

function mergeRecentConversations(
  current: RecentConversation[],
  updates: RecentConversation[],
  insertMissing: boolean,
): RecentConversation[] {
  const conversations = new Map(
    current.map((conversation) => [conversation.conversationId, conversation]),
  );

  for (const update of updates) {
    const previous = conversations.get(update.conversationId);
    if (!previous && !insertMissing) {
      continue;
    }

    if (
      previous?.lastMessageAt &&
      update.lastMessageAt &&
      Date.parse(previous.lastMessageAt) > Date.parse(update.lastMessageAt)
    ) {
      continue;
    }

    if (
      previous?.lastMessage === update.lastMessage &&
      previous.lastMessageAt === update.lastMessageAt
    ) {
      continue;
    }

    conversations.set(update.conversationId, update);
  }

  const merged = [...conversations.values()]
    .sort((left, right) => {
      const leftTime = left.lastMessageAt
        ? Date.parse(left.lastMessageAt)
        : Number.NEGATIVE_INFINITY;
      const rightTime = right.lastMessageAt
        ? Date.parse(right.lastMessageAt)
        : Number.NEGATIVE_INFINITY;
      return rightTime - leftTime;
    })
    .slice(0, RECENT_PAGE_SIZE);

  if (
    merged.length === current.length &&
    merged.every(
      (conversation, index) => conversation === current[index],
    )
  ) {
    return current;
  }

  return merged;
}

export default function Sidebar({ className = "" }: SidebarProps) {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { id: selectedUserId } = useParams();
  const currentUserName = useAppSelector(
    (state) => state.auth.user?.name ?? "Account",
  );
  const {
    activeSidebarTab: activeTab,
    recentConversationUpdates,
    setActiveSidebarTab: setActiveTab,
  } = useRecentConversations();
  const recentConversationUpdatesRef = useRef(recentConversationUpdates);
  recentConversationUpdatesRef.current = recentConversationUpdates;
  const [users, setUsers] = useState<ListedUser[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [retryUsers, setRetryUsers] = useState(0);
  const [recentConversations, setRecentConversations] = useState<
    RecentConversation[]
  >([]);
  const [recentPage, setRecentPage] = useState(1);
  const [totalRecentPages, setTotalRecentPages] = useState(0);
  const [totalRecentConversations, setTotalRecentConversations] = useState(0);
  const [isLoadingRecent, setIsLoadingRecent] = useState(false);
  const [recentError, setRecentError] = useState<string | null>(null);
  const [retryRecent, setRetryRecent] = useState(0);
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

  useEffect(() => {
    if (activeTab !== "recent") {
      return;
    }

    let active = true;
    const loadRecentConversations = async () => {
      setIsLoadingRecent(true);
      setRecentError(null);
      try {
        const result = await getRecentConversations(recentPage);
        if (!active) {
          return;
        }

        setRecentConversations(
          mergeRecentConversations(
            result.conversations,
            recentConversationUpdatesRef.current,
            recentPage === 1,
          ),
        );
        setTotalRecentPages(result.totalPages);
        setTotalRecentConversations(result.total);
      } catch {
        if (active) {
          setRecentError("Unable to load recent chats.");
        }
      } finally {
        if (active) {
          setIsLoadingRecent(false);
        }
      }
    };

    void loadRecentConversations();
    return () => {
      active = false;
    };
  }, [activeTab, recentPage, retryRecent]);

  useEffect(() => {
    setRecentConversations((current) =>
      mergeRecentConversations(
        current,
        recentConversationUpdates,
        recentPage === 1,
      ),
    );
  }, [recentConversationUpdates, recentPage]);

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
    initiatingUserIdsRef.current.add(user.id);
    setInitiatingUserIds((current) => new Set(current).add(user.id));
    try {
      await initiateConversation(user.id);
      setActiveTab("recent");
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

  const page = activeTab === "users" ? currentPage : recentPage;
  const activeTotalPages =
    activeTab === "users" ? totalPages : totalRecentPages;
  const totalItems =
    activeTab === "users" ? totalUsers : totalRecentConversations;
  const isLoading = activeTab === "users" ? isLoadingUsers : isLoadingRecent;

  const changePage = (nextPage: number) => {
    if (activeTab === "users") {
      setCurrentPage(nextPage);
    } else {
      setRecentPage(nextPage);
    }
  };

  return (
    <aside
      className={`flex h-full min-h-0 flex-col border-r border-frosted-blue/70 bg-white ${className}`}
      aria-label="Chats"
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-frosted-blue/70 bg-white/80 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-deep-twilight text-lg font-semibold text-white shadow-sm">
            {currentUserName.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-bright-teal-blue">
              Chat App
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-deep-twilight">
              {currentUserName}
            </p>
          </div>
        </div>
        <button
          className="flex size-10 shrink-0 items-center justify-center rounded-xl text-bright-teal-blue transition hover:bg-light-cyan hover:text-deep-twilight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bright-teal-blue/40"
          type="button"
          aria-label="Log out"
          title="Log out"
          onClick={() => setIsLogoutDialogOpen(true)}
        >
          <LogOut className="size-5" aria-hidden="true" />
        </button>
      </header>

      <div className="shrink-0 px-4 pb-4 pt-5">
        <p className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-bright-teal-blue">
          Your workspace
        </p>
        <div
          className="grid grid-cols-2 gap-1 rounded-2xl border border-frosted-blue/70 bg-white/75 p-1.5 shadow-sm"
          role="tablist"
          aria-label="Sidebar lists"
        >
          {(["users", "recent"] as const).map((tab) => {
            const Icon = tab === "users" ? UsersRound : MessageCircle;
            return (
              <button
                key={tab}
                id={`${tab}-tab`}
                className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl px-2 py-2.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-bright-teal-blue/50 sm:text-sm ${
                  activeTab === tab
                    ? "bg-deep-twilight text-white shadow-sm"
                    : "text-bright-teal-blue hover:bg-light-cyan hover:text-deep-twilight"
                }`}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                aria-controls="sidebar-panel"
                onClick={() => setActiveTab(tab)}
              >
                <Icon className="size-4" aria-hidden="true" />
                {tab === "users" ? "Users" : "Recent chats"}
              </button>
            );
          })}
        </div>
      </div>
      <nav
        className="min-h-0 flex-1 overflow-y-auto px-3 pb-4"
        id="sidebar-panel"
        role="tabpanel"
        aria-labelledby={`${activeTab}-tab`}
      >
        {activeTab === "users" ? (
          isLoadingUsers ? (
            <p className="px-4 py-3 text-sm text-bright-teal-blue" role="status">
              Loading users...
            </p>
          ) : usersError ? (
            <div className="px-4 py-3">
              <p className="text-sm text-red-700" role="alert">
                {usersError}
              </p>
              <button
                className="mt-2 text-sm font-semibold text-bright-teal-blue hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bright-teal-blue/40"
                type="button"
                onClick={() => setRetryUsers((retryCount) => retryCount + 1)}
              >
                Try again
              </button>
            </div>
          ) : users.length === 0 ? (
            <p className="px-4 py-3 text-sm text-bright-teal-blue">
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
          )
        ) : isLoadingRecent ? (
          <p className="px-4 py-3 text-sm text-bright-teal-blue" role="status">
            Loading recent chats...
          </p>
        ) : recentError ? (
          <div className="px-4 py-3">
            <p className="text-sm text-red-700" role="alert">
              {recentError}
            </p>
            <button
              className="mt-2 text-sm font-semibold text-bright-teal-blue hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bright-teal-blue/40"
              type="button"
              onClick={() => setRetryRecent((retryCount) => retryCount + 1)}
            >
              Try again
            </button>
          </div>
        ) : recentConversations.length === 0 ? (
          <p className="px-4 py-3 text-sm text-bright-teal-blue">
            No recent chats.
          </p>
        ) : (
          recentConversations.map((conversation) => (
            <button
              key={conversation.conversationId}
              className={`mb-1.5 flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-left transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bright-teal-blue/40 ${
                conversation.userId === selectedUserId
                  ? "bg-light-cyan/70 shadow-sm ring-1 ring-bright-teal-blue/25"
                  : "hover:-translate-y-0.5 hover:bg-light-cyan/40 hover:shadow-sm"
              }`}
              type="button"
              aria-pressed={conversation.userId === selectedUserId}
              onClick={() =>
                navigate(
                  `/dashboard/chat_room/${encodeURIComponent(conversation.userId)}`,
                )
              }
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-turquoise-surf/20 text-sm font-semibold text-deep-twilight">
                {conversation.name.slice(0, 1).toUpperCase() || "?"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-deep-twilight">
                  {conversation.name}
                </span>
                <span className="mt-1 block truncate text-xs text-bright-teal-blue">
                  {conversation.lastMessage ?? "No messages yet"}
                </span>
              </span>
            </button>
          ))
        )}
      </nav>
      {activeTotalPages > 0 && (
        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-frosted-blue px-4 py-3">
          <p className="text-xs text-bright-teal-blue" aria-live="polite">
            Page {page} of {activeTotalPages} · {totalItems}{" "}
            {activeTab === "users" ? "users" : "chats"}
          </p>
          <div className="flex gap-2">
            <button
              className="rounded-lg border border-frosted-blue px-2.5 py-1.5 text-xs font-semibold text-deep-twilight hover:bg-light-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bright-teal-blue/40 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={isLoading || page <= 1}
              onClick={() => changePage(page - 1)}
            >
              Previous
            </button>
            <button
              className="rounded-lg border border-frosted-blue px-2.5 py-1.5 text-xs font-semibold text-deep-twilight hover:bg-light-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bright-teal-blue/40 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={isLoading || page >= activeTotalPages}
              onClick={() => changePage(page + 1)}
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
