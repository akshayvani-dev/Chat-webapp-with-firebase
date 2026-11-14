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
      className={`w-full cursor-pointer border-b border-stone-100 px-4 py-3 text-left transition last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/40 disabled:cursor-not-allowed ${
        isSelected
          ? "bg-emerald-50"
          : "hover:bg-stone-50"
      }`}
      type="button"
      aria-pressed={isSelected}
      disabled={isLoading}
      onClick={onSelect}
    >
      <span className="block truncate text-sm font-semibold text-stone-900">
        {isLoading ? "Starting chat..." : user.name}
      </span>
    </button>
  );
}
