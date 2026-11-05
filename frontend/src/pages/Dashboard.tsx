import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getUsers } from "../apis/users.api";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import ChatPanel from "../components/chat/ChatPanel";
import Sidebar from "../components/chat/Sidebar";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { clearUser } from "../store/authSlice";
import { clearSessionFlag } from "../utils/sessionFlag";
import { logout } from "../apis/auth.api";
import type { ConversationsByUser, DirectoryUser } from "../types/chat.types";

export default function Dashboard() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const currentUserId = user?.id ?? "current-user";
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [conversations, setConversations] = useState<ConversationsByUser>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [retryUsers, setRetryUsers] = useState(0);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
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
        setSelectedUserId((selectedId) =>
          result.users.some((directoryUser) => directoryUser.id === selectedId)
            ? selectedId
            : null,
        );
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
  }, [currentPage, currentUserId, retryUsers]);
  const selectedUser =
    users.find((directoryUser) => directoryUser.id === selectedUserId) ?? null;

  const selectedMessages = useMemo(
    () => (selectedUserId ? conversations[selectedUserId] ?? [] : []),
    [conversations, selectedUserId],
  );

  const handleSendMessage = (text: string) => {
    if (!selectedUserId) {
      return;
    }

    const message = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      senderId: currentUserId,
      text,
      timestamp: new Date().toISOString(),
    };

    setConversations((current) => ({
      ...current,
      [selectedUserId]: [...(current[selectedUserId] ?? []), message],
    }));
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } catch (error) {
      console.error("Server logout failed; clearing the local session.", error);
    } finally {
      clearSessionFlag();
      dispatch(clearUser());
      navigate("/signin", { replace: true });
    }
  };

  return (
    <main className="flex h-dvh min-h-[420px] overflow-hidden bg-stone-50 text-stone-900">
      <Sidebar
        currentUserName={user?.name ?? "Account"}
        users={users}
        selectedUserId={selectedUserId}
        onSelectUser={setSelectedUserId}
        onLogout={() => setIsLogoutDialogOpen(true)}
        isLoadingUsers={isLoadingUsers}
        usersError={usersError}
        onRetryUsers={() => setRetryUsers((retryCount) => retryCount + 1)}
        currentPage={currentPage}
        totalPages={totalPages}
        totalUsers={totalUsers}
        onPageChange={setCurrentPage}
        className={`w-full shrink-0 md:w-80 ${
          selectedUserId ? "hidden md:flex" : "flex"
        }`}
      />
      <ChatPanel
        currentUserId={currentUserId}
        selectedUser={selectedUser}
        messages={selectedMessages}
        onSendMessage={handleSendMessage}
        onBack={() => setSelectedUserId(null)}
        className={selectedUserId ? "flex w-full" : "hidden md:flex"}
      />
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
    </main>
  );
}
