import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getErrorMessage } from "../../apis/axiosInstance";
import { getUserById, sendMessage } from "../../apis/users.api";
import { subscribeToConversationMessages } from "../../config/firebase-chat";
import { useRecentConversations } from "./RecentConversationsContext";
import { useAppSelector } from "../../store/hooks";
import type {
  ConversationMessage,
  DirectoryUser,
} from "../../types/chat.types";

function getErrorText(error: unknown): string {
  const apiMessage = getErrorMessage(error);
  if (apiMessage !== "Something went wrong") {
    return apiMessage;
  }
  return error instanceof Error ? error.message : apiMessage;
}

export default function ChatPanel() {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUserId = useAppSelector((state) => state.auth.user?.id ?? null);
  const firebaseUser = useAppSelector((state) => state.auth.firebaseUser);
  const { updateRecentConversation } = useRecentConversations();
  const [user, setUser] = useState<DirectoryUser | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const sendingRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const updateRecentPreview = useCallback(
    (message: ConversationMessage) => {
      if (!user?.conversationId) {
        return;
      }

      updateRecentConversation({
        conversationId: user.conversationId,
        userId: user.id,
        name: user.name,
        lastMessage: message.text,
        lastMessageAt: message.createdAt,
      });
    },
    [updateRecentConversation, user],
  );

  useEffect(() => {
    let active = true;

    if (!id) {
      setUser(null);
      setUserError(null);
      setIsLoadingUser(false);
      return () => {
        active = false;
      };
    }

    const loadUser = async () => {
      setUser(null);
      setUserError(null);
      setIsLoadingUser(true);
      setMessages([]);
      setMessageError(null);
      setDraft("");

      try {
        const result = await getUserById(id);
        if (active) {
          setUser(result);
        }
      } catch (requestError) {
        if (active) {
          setUserError(getErrorText(requestError));
        }
      } finally {
        if (active) {
          setIsLoadingUser(false);
        }
      }
    };

    void loadUser();
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (!id || !user || user.id !== id || isLoadingUser) {
      setMessages([]);
      setIsLoadingMessages(false);
      setMessageError(null);
      return;
    }

    if (userError) {
      setIsLoadingMessages(false);
      return;
    }

    if (!user.conversationId) {
      setMessages([]);
      setIsLoadingMessages(false);
      setMessageError(null);
      return;
    }

    if (!currentUserId || !firebaseUser) {
      setIsLoadingMessages(true);
      setMessageError(null);
      return;
    }

    if (firebaseUser.uid !== currentUserId) {
      setMessages([]);
      setIsLoadingMessages(false);
      setMessageError("Firebase session does not match the signed-in account.");
      return;
    }

    setIsLoadingMessages(true);
    setMessageError(null);
    const unsubscribe = subscribeToConversationMessages(
      user.conversationId,
      currentUserId,
      (nextMessages) => {
        setMessages(nextMessages);
        const latestMessage = nextMessages[nextMessages.length - 1];
        if (latestMessage) {
          updateRecentPreview(latestMessage);
        }
        setIsLoadingMessages(false);
        setMessageError(null);
      },
      (error) => {
        setIsLoadingMessages(false);
        setMessageError(error.message);
      },
    );

    return unsubscribe;
  }, [
    currentUserId,
    firebaseUser,
    id,
    isLoadingUser,
    updateRecentPreview,
    user,
    userError,
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    const conversationId = user?.conversationId;
    if (
      !text ||
      !conversationId ||
      !currentUserId ||
      firebaseUser?.uid !== currentUserId ||
      sendingRef.current
    ) {
      return;
    }

    sendingRef.current = true;
    setIsSending(true);
    setMessageError(null);
    try {
      const message = await sendMessage(conversationId, text);
      updateRecentPreview(message);
      setDraft("");
    } catch (error) {
      setMessageError(getErrorText(error));
    } finally {
      sendingRef.current = false;
      setIsSending(false);
    }
  };

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

  const conversationReady = Boolean(
    user?.conversationId &&
      currentUserId &&
      firebaseUser?.uid === currentUserId,
  );

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
          {isLoadingUser ? "Loading user..." : user?.name ?? "User"}
        </h2>
      </header>

      <div
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-5 sm:px-6"
        role="log"
        aria-label="Messages"
        aria-live="polite"
        aria-relevant="additions text"
      >
        {isLoadingUser || isLoadingMessages ? (
          <p className="m-auto text-sm text-stone-500" role="status">
            {isLoadingUser ? "Loading conversation..." : "Loading messages..."}
          </p>
        ) : userError ? (
          <p className="m-auto text-sm text-red-700" role="alert">
            {userError}
          </p>
        ) : !user?.conversationId ? (
          <p className="m-auto text-center text-sm text-stone-500">
            Select this user from the sidebar to start a conversation.
          </p>
        ) : messageError && messages.length === 0 ? (
          <p className="m-auto text-sm text-red-700" role="alert">
            {messageError}
          </p>
        ) : messages.length === 0 ? (
          <p className="m-auto text-sm text-stone-500">
            No messages yet. Send the first message.
          </p>
        ) : (
          messages.map((message) => {
            const isOwnMessage = message.senderId === currentUserId;
            return (
              <article
                key={message.id}
                className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm ${
                    isOwnMessage
                      ? "bg-emerald-900 text-white"
                      : "bg-white text-stone-800 shadow-sm"
                  }`}
                >
                  <p>{message.text}</p>
                  <time
                    className={`mt-1 block text-right text-[11px] ${
                      isOwnMessage ? "text-emerald-100" : "text-stone-400"
                    }`}
                    dateTime={message.createdAt}
                  >
                    {new Date(message.createdAt).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </time>
                  {isOwnMessage && (
                    <div
                      className="mt-2 flex cursor-pointer justify-end gap-2 text-emerald-100"
                      aria-hidden="true"
                    >
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
                      </svg>
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 6h18" />
                        <path d="M8 6V4h8v2" />
                        <path d="m19 6-1 14H6L5 6" />
                        <path d="M10 11v5M14 11v5" />
                      </svg>
                    </div>
                  )}
                </div>
              </article>
            );
          })
        )}
        {messageError && messages.length > 0 && (
          <p className="text-center text-sm text-red-700" role="alert">
            {messageError}
          </p>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form
        className="flex shrink-0 items-end gap-3 border-t border-stone-200 bg-white p-4 sm:px-6"
        onSubmit={handleSendMessage}
      >
        <label className="sr-only" htmlFor="chat-message">
          Message
        </label>
        <textarea
          id="chat-message"
          className="max-h-32 min-h-11 flex-1 resize-y rounded-xl border border-stone-200 px-4 py-3 text-sm text-stone-900 outline-none placeholder:text-stone-400 focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/10 disabled:bg-stone-100"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={
            conversationReady ? "Write a message..." : "Select a conversation"
          }
          maxLength={4000}
          disabled={!conversationReady || isSending}
        />
        <button
          className="shrink-0 rounded-xl bg-emerald-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-700/25 disabled:cursor-not-allowed disabled:bg-stone-300"
          type="submit"
          disabled={!conversationReady || !draft.trim() || isSending}
        >
          {isSending ? "Sending..." : "Send"}
        </button>
      </form>
    </section>
  );
}
