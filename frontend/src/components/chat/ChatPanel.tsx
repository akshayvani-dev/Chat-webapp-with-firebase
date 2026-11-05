import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getErrorMessage } from "../../apis/axiosInstance";
import { getUserById } from "../../apis/users.api";
import type { DirectoryUser } from "../../types/chat.types";

export default function ChatPanel() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState<DirectoryUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (!id) {
      setUser(null);
      setError(null);
      setIsLoading(false);
      return () => {
        active = false;
      };
    }

    const loadUser = async () => {
      setUser(null);
      setError(null);
      setIsLoading(true);
      try {
        const result = await getUserById(id);
        if (active) {
          setUser(result);
        }
      } catch (requestError) {
        if (active) {
          setError(getErrorMessage(requestError));
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadUser();
    return () => {
      active = false;
    };
  }, [id]);

  if (!id) {
    return (
      <section
        className="flex min-h-0 flex-1 items-center justify-center bg-stone-50 px-6 text-center"
        aria-label="Conversation"
      >
        <p className="text-sm text-stone-500">
          Select chat to view chat history
        </p>
      </section>
    );
  }

  return (
    <section
      className="flex min-h-0 flex-1 flex-col bg-stone-50"
      aria-label={user ? `Conversation with ${user.name}` : "Conversation"}
    >
      <header className="flex h-[73px] shrink-0 items-center gap-3 border-b border-stone-200 bg-white px-4 sm:px-6">
        <button
          className="rounded-lg px-2 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/40 md:hidden"
          type="button"
          onClick={() => navigate("/dashboard/chat_room")}
          aria-label="Back to users"
        >
          Back
        </button>
        <h2 className="truncate text-base font-semibold text-stone-900">
          {isLoading ? "Loading user..." : user?.name ?? "User"}
        </h2>
      </header>
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center">
        {isLoading ? (
          <p className="text-sm text-stone-500" role="status">
            Loading user...
          </p>
        ) : error ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : (
          <p className="text-sm text-stone-500">
            Chat history is not available yet.
          </p>
        )}
      </div>
    </section>
  );
}
