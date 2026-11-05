import type { DirectoryUser } from "../../types/chat.types";
import UserListItem from "./UserListItem";

type SidebarProps = {
  currentUserName: string;
  users: DirectoryUser[];
  selectedUserId: string | null;
  onSelectUser: (userId: string) => void;
  onLogout: () => void;
  isLoadingUsers: boolean;
  usersError: string | null;
  onRetryUsers: () => void;
  currentPage: number;
  totalPages: number;
  totalUsers: number;
  onPageChange: (page: number) => void;
  className?: string;
};

export default function Sidebar({
  currentUserName,
  users,
  selectedUserId,
  onSelectUser,
  onLogout,
  isLoadingUsers,
  usersError,
  onRetryUsers,
  currentPage,
  totalPages,
  totalUsers,
  onPageChange,
  className = "",
}: SidebarProps) {
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
          onClick={onLogout}
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
              onClick={onRetryUsers}
            >
              Try again
            </button>
          </div>
        ) : users.length === 0 ? (
          <p className="px-4 py-3 text-sm text-stone-500">
            No other users found.
          </p>
        ) : (
          users.map((user) => (
            <UserListItem
              key={user.id}
              user={user}
              isSelected={user.id === selectedUserId}
              onSelect={onSelectUser}
            />
          ))
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
              onClick={() => onPageChange(currentPage - 1)}
            >
              Previous
            </button>
            <button
              className="rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/40 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={isLoadingUsers || currentPage >= totalPages}
              onClick={() => onPageChange(currentPage + 1)}
            >
              Next
            </button>
          </div>
        </footer>
      )}
    </aside>
  );
}
