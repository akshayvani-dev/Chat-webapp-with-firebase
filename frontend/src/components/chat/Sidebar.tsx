import { useCallback, useEffect, useRef, useState } from "react";
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
    });

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
  const [hasMoreUsers, setHasMoreUsers] = useState(true);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const currentPageRef = useRef(0);
  const totalPagesRef = useRef(0);
  const hasMoreUsersRef = useRef(true);
  const isLoadingUsersRef = useRef(false);
  const usersStartedRef = useRef(false);
  const [recentConversations, setRecentConversations] = useState<
    RecentConversation[]
  >([]);
  const [hasMoreRecent, setHasMoreRecent] = useState(true);
  const [isLoadingRecent, setIsLoadingRecent] = useState(false);
  const [recentError, setRecentError] = useState<string | null>(null);
  const recentPageRef = useRef(0);
  const totalRecentPagesRef = useRef(0);
  const hasMoreRecentRef = useRef(true);
  const isLoadingRecentRef = useRef(false);
  const recentStartedRef = useRef(false);
  const isMountedRef = useRef(true);
  const listContainerRef = useRef<HTMLElement>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const initiatingUserIdsRef = useRef(new Set<string>());
  const [initiatingUserIds, setInitiatingUserIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [initiationError, setInitiationError] = useState<string | null>(null);
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const loadNextUsers = useCallback(async () => {
    if (isLoadingUsersRef.current || !hasMoreUsersRef.current) {
      return;
    }

    const requestedPage = currentPageRef.current + 1;
    isLoadingUsersRef.current = true;
    setIsLoadingUsers(true);
    setUsersError(null);
    try {
      const result = await getUsers(requestedPage);
      if (!isMountedRef.current) {
        return;
      }

      currentPageRef.current = result.page;
      totalPagesRef.current = result.totalPages;
      const hasMore =
        currentPageRef.current < totalPagesRef.current;
      hasMoreUsersRef.current = hasMore;
      setHasMoreUsers(hasMore);
      if (!hasMore) {
        observerRef.current?.disconnect();
      }
      setUsers((currentUsers) => {
        const existingIds = new Set(currentUsers.map((user) => user.id));
        return [
          ...currentUsers,
          ...result.users.filter((user) => {
            if (existingIds.has(user.id)) {
              return false;
            }
            existingIds.add(user.id);
            return true;
          }),
        ];
      });
    } catch {
      hasMoreUsersRef.current = false;
      setHasMoreUsers(false);
      observerRef.current?.disconnect();
      if (isMountedRef.current) {
        setUsersError("Unable to load users.");
      }
    } finally {
      isLoadingUsersRef.current = false;
      if (isMountedRef.current) {
        setIsLoadingUsers(false);
      }
    }
  }, []);

  const loadNextRecent = useCallback(async () => {
    if (isLoadingRecentRef.current || !hasMoreRecentRef.current) {
      return;
    }

    const requestedPage = recentPageRef.current + 1;
    isLoadingRecentRef.current = true;
    setIsLoadingRecent(true);
    setRecentError(null);
    try {
      const result = await getRecentConversations(requestedPage);
      if (!isMountedRef.current) {
        return;
      }

      recentPageRef.current = result.page;
      totalRecentPagesRef.current = result.totalPages;
      const hasMore =
        recentPageRef.current < totalRecentPagesRef.current;
      hasMoreRecentRef.current = hasMore;
      setHasMoreRecent(hasMore);
      if (!hasMore) {
        observerRef.current?.disconnect();
      }
      setRecentConversations((current) =>
        mergeRecentConversations(
          [...current, ...result.conversations],
          recentConversationUpdatesRef.current,
          result.page === 1,
        ),
      );
    } catch {
      hasMoreRecentRef.current = false;
      setHasMoreRecent(false);
      observerRef.current?.disconnect();
      if (isMountedRef.current) {
        setRecentError("Unable to load recent chats.");
      }
    } finally {
      isLoadingRecentRef.current = false;
      if (isMountedRef.current) {
        setIsLoadingRecent(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      observerRef.current?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!usersStartedRef.current) {
      usersStartedRef.current = true;
      void loadNextUsers();
    }
  }, [loadNextUsers]);

  useEffect(() => {
    if (activeTab === "recent" && !recentStartedRef.current) {
      recentStartedRef.current = true;
      void loadNextRecent();
    }
  }, [activeTab, loadNextRecent]);

  useEffect(() => {
    setRecentConversations((current) =>
      mergeRecentConversations(
        current,
        recentConversationUpdates,
        recentPageRef.current <= 1,
      ),
    );
  }, [recentConversationUpdates]);

  useEffect(() => {
    const root = listContainerRef.current;
    const sentinel = loadMoreSentinelRef.current;
    const hasMore = activeTab === "users" ? hasMoreUsers : hasMoreRecent;
    const hasError = activeTab === "users" ? usersError : recentError;
    if (!root || !sentinel || !hasMore || hasError) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) {
          return;
        }

        if (activeTab === "users") {
          void loadNextUsers();
        } else {
          void loadNextRecent();
        }
      },
      { root, rootMargin: "200px", threshold: 0 },
    );
    observerRef.current = observer;
    observer.observe(sentinel);

    return () => {
      observer.disconnect();
      if (observerRef.current === observer) {
        observerRef.current = null;
      }
    };
  }, [
    activeTab,
    hasMoreRecent,
    hasMoreUsers,
    loadNextRecent,
    loadNextUsers,
    recentError,
    usersError,
  ]);

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

  const activeHasMore = activeTab === "users" ? hasMoreUsers : hasMoreRecent;
  const isLoading = activeTab === "users" ? isLoadingUsers : isLoadingRecent;
  const activeError = activeTab === "users" ? usersError : recentError;

  const retryLoading = () => {
    if (activeTab === "users") {
      hasMoreUsersRef.current = true;
      setHasMoreUsers(true);
      setUsersError(null);
      void loadNextUsers();
    } else {
      hasMoreRecentRef.current = true;
      setHasMoreRecent(true);
      setRecentError(null);
      void loadNextRecent();
    }
  };

  return (
    <aside
      className={`flex h-full min-h-0 flex-col border-r border-frosted-blue/70 bg-white ${className}`}
      aria-label="Chats"
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-frosted-blue/70 bg-white/80 px-5 py-3.5">
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
        ref={listContainerRef}
        className="min-h-0 flex-1 overflow-y-auto px-3 pb-4"
        id="sidebar-panel"
        role="tabpanel"
        aria-labelledby={`${activeTab}-tab`}
      >
        {activeTab === "users" ? (
          isLoadingUsers && users.length === 0 ? (
            <p className="px-4 py-3 text-sm text-bright-teal-blue" role="status">
              Loading users...
            </p>
          ) : users.length === 0 && !usersError ? (
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
        ) : isLoadingRecent && recentConversations.length === 0 ? (
          <p className="px-4 py-3 text-sm text-bright-teal-blue" role="status">
            Loading recent chats...
          </p>
        ) : recentConversations.length === 0 && !recentError ? (
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
        {activeError && (
          <div className="px-4 py-3">
            <p className="text-sm text-red-700" role="alert">
              {activeError}
            </p>
            <button
              className="mt-2 text-sm font-semibold text-bright-teal-blue hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bright-teal-blue/40"
              type="button"
              onClick={retryLoading}
            >
              Try again
            </button>
          </div>
        )}
        {activeHasMore && !activeError && (
          <div
            ref={loadMoreSentinelRef}
            className="h-px w-full"
            aria-hidden="true"
          />
        )}
        {isLoading && (
          <div className="flex justify-center py-3" role="status">
            <span className="size-4 animate-spin rounded-full border-2 border-frosted-blue border-t-bright-teal-blue" />
            <span className="sr-only">
              {activeTab === "users" ? "Loading more users" : "Loading more chats"}
            </span>
          </div>
        )}
      </nav>
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
