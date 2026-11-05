import type { DirectoryUser } from "../../types/chat.types";

type UserListItemProps = {
  user: DirectoryUser;
  isSelected: boolean;
  onSelect: (userId: string) => void;
};

export default function UserListItem({
  user,
  isSelected,
  onSelect,
}: UserListItemProps) {
  return (
    <button
      className={`w-full border-b border-stone-100 px-4 py-3 text-left transition last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/40 ${
        isSelected
          ? "bg-emerald-50"
          : "hover:bg-stone-50"
      }`}
      type="button"
      aria-pressed={isSelected}
      onClick={() => onSelect(user.id)}
    >
      <span className="block truncate text-sm font-semibold text-stone-900">
        {user.name}
      </span>
    </button>
  );
}
