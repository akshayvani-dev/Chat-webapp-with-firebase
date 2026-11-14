import type { ListedUser } from "../../types/chat.types";

type UserListItemProps = {
  user: ListedUser;
  isSelected: boolean;
  isLoading: boolean;
  onSelect: () => void;
};

export default function UserListItem({
  user,
  isSelected,
  isLoading,
  onSelect,
}: UserListItemProps) {
  return (
    <button
      className={`mb-1.5 flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-left transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bright-teal-blue/40 disabled:cursor-not-allowed ${
        isSelected
          ? "bg-light-cyan/70 shadow-sm ring-1 ring-bright-teal-blue/25"
          : "hover:-translate-y-0.5 hover:bg-light-cyan/40 hover:shadow-sm"
      }`}
      type="button"
      aria-pressed={isSelected}
      disabled={isLoading}
      onClick={onSelect}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-frosted-blue/60 text-sm font-semibold text-deep-twilight">
        {user.name.slice(0, 1).toUpperCase() || "?"}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-deep-twilight">
        {isLoading ? "Starting chat..." : user.name}
      </span>
    </button>
  );
}
