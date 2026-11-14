import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  Check,
  LoaderCircle,
  Pencil,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { getErrorMessage } from "../../apis/axiosInstance";
import {
  deleteMessage,
  editMessage,
  getUserById,
  sendMessage,
} from "../../apis/users.api";
import {
  subscribeToConversationMessages,
  markConversationSeen,
} from "../../config/firebase-chat";
import { useRecentConversations } from "./RecentConversationsContext";
import { useAppSelector } from "../../store/hooks";
import ConfirmDialog from "../ui/ConfirmDialog";
import type {
  ConversationMessage,
  DirectoryUser,
} from "../../types/chat.types";
import { MessageListSkeleton } from "./Chatskeletons";

type Status = "loading" | "ready" | "error";

const SKELETON_DELAY_MS = 150;

// Simple in-memory caches so revisiting a conversation renders instantly
// while the subscription refreshes in the background.
const userCache = new Map<string, DirectoryUser>();
const messageCache = new Map<string, ConversationMessage[]>();

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
  const { updateRecentConversation, markConversationRead } = useRecentConversations();
  const [user, setUser] = useState<DirectoryUser | null>(null);
  const [userError, setUserError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [isUpdatingMessage, setIsUpdatingMessage] = useState(false);
  const [messageToDelete, setMessageToDelete] =
    useState<ConversationMessage | null>(null);
  const [isDeletingMessage, setIsDeletingMessage] = useState(false);
  const sendingRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);

  // One status for the screen. While the route id and the loaded user do not
  // match yet (first render after switching conversations), treat it as loading.
  const userMatches = Boolean(user && user.id === id);
  const viewStatus: Status = userError
    ? "error"
    : !userMatches
      ? "loading"
      : status;

  useLayoutEffect(() => {
    const textarea = messageInputRef.current;
    if (!textarea) {
      return;
    }

    const maxHeight = 160;
    textarea.style.height = "auto";
    const nextHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY =
      textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [draft]);

  // Show the skeleton only if loading lasts longer than the delay.
  useEffect(() => {
    if (viewStatus !== "loading") {
      setShowSkeleton(false);
      return;
    }

    const timer = window.setTimeout(
      () => setShowSkeleton(true),
      SKELETON_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [viewStatus, id]);

  const updateRecentPreview = useCallback(
    (message: ConversationMessage | null) => {
      if (!user?.conversationId) {
        return;
      }

      updateRecentConversation({
        conversationId: user.conversationId,
        userId: user.id,
        name: user.name,
        lastMessage: message?.text ?? null,
        lastMessageAt: message?.createdAt ?? null,
      });
    },
    [updateRecentConversation, user],
  );

  useEffect(() => {
    let active = true;

    if (!id) {
      setUser(null);
      setUserError(null);
      return () => {
        active = false;
      };
    }

    const cachedUser = userCache.get(id) ?? null;
    const cachedMessages = cachedUser?.conversationId
      ? messageCache.get(cachedUser.conversationId)
      : undefined;

    const loadUser = async () => {
      setUser(cachedUser);
      setUserError(null);
      setMessages(cachedMessages ?? []);
      setStatus(cachedMessages ? "ready" : "loading");
      setMessageError(null);
      setDraft("");
      setEditingMessageId(null);
      setEditDraft("");
      setMessageToDelete(null);

      try {
        const result = await getUserById(id);
        userCache.set(id, result);
        if (active) {
          setUser(result);
        }
      } catch (requestError) {
        // With cached data on screen, fail silently and keep showing it.
        if (active && !cachedUser) {
          setUserError(getErrorText(requestError));
        }
      }
    };

    void loadUser();
    return () => {
      active = false;
    };
  }, [id, retryKey]);

  useEffect(() => {
    if (!id || !user || user.id !== id) {
      return;
    }

    const conversationId = user.conversationId;
    if (!conversationId) {
      setMessages([]);
      setStatus("ready");
      return;
    }

    if (!currentUserId || !firebaseUser) {
      return;
    }

    if (firebaseUser.uid !== currentUserId) {
      setMessageError("Firebase session does not match the signed-in account.");
      setStatus("error");
      return;
    }

    setMessageError(null);
    const unsubscribe = subscribeToConversationMessages(
      conversationId,
      currentUserId,
      (nextMessages) => {
        messageCache.set(conversationId, nextMessages);
        setMessages(nextMessages);
        const latestMessage = nextMessages[nextMessages.length - 1];
        updateRecentPreview(latestMessage ?? null);
        setStatus("ready");
        setMessageError(null);

        // Chat is open — immediately clear the unread indicator and persist
        // the last-seen timestamp to Firestore so the state survives a refresh.
        markConversationRead(conversationId);
        void markConversationSeen(conversationId, currentUserId).catch(() => {
          // Non-critical: indicator resets on next refresh if this write fails.
        });
      },
      (error) => {
        setMessageError(error.message);
        // Keep showing cached messages if we have them; otherwise show retry.
        if (!messageCache.has(conversationId)) {
          setStatus("error");
        }
      },
    );

    return unsubscribe;
}, [currentUserId, firebaseUser, id, retryKey, updateRecentPreview, user, markConversationRead]);

useEffect(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
}, [messages]);

const handleRetry = () => {
  setRetryKey((key) => key + 1);
};

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

const handleSaveEdit = async (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();
  const text = editDraft.trim();
  const conversationId = user?.conversationId;
  const messageId = editingMessageId;
  if (!text || !conversationId || !messageId || isUpdatingMessage) {
    return;
  }

  setIsUpdatingMessage(true);
  setMessageError(null);
  try {
    const updatedMessage = await editMessage(
      conversationId,
      messageId,
      text,
    );
    setMessages((currentMessages) =>
      currentMessages.map((message) =>
        message.id === updatedMessage.id ? updatedMessage : message,
      ),
    );
    if (messages[messages.length - 1]?.id === updatedMessage.id) {
      updateRecentPreview(updatedMessage);
    }
    setEditingMessageId(null);
    setEditDraft("");
  } catch (error) {
    setMessageError(getErrorText(error));
  } finally {
    setIsUpdatingMessage(false);
  }
};

const handleConfirmDelete = async () => {
  const message = messageToDelete;
  const conversationId = user?.conversationId;
  if (!message || !conversationId || isDeletingMessage) {
    return;
  }

  setIsDeletingMessage(true);
  setMessageError(null);
  try {
    const latestMessage = await deleteMessage(conversationId, message.id);
    setMessages((currentMessages) =>
      currentMessages.filter((currentMessage) => currentMessage.id !== message.id),
    );
    updateRecentPreview(latestMessage);
    if (editingMessageId === message.id) {
      setEditingMessageId(null);
      setEditDraft("");
    }
    setMessageToDelete(null);
  } catch (error) {
    setMessageError(getErrorText(error));
    throw error;
  } finally {
    setIsDeletingMessage(false);
  }
};

if (!id) {
  return (
    <section
      className="auth-grainy-background flex min-h-0 flex-1 items-center justify-center px-6 text-center"
      aria-label="Conversation"
    >
      <p className="text-base font-medium text-white/85">
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
    className="auth-grainy-background flex min-h-0 flex-1 flex-col"
    aria-label={userMatches && user ? `Conversation with ${user.name}` : "Conversation"}
  >
    <header className="flex h-[73px] shrink-0 items-center gap-3 border-b border-frosted-blue bg-white px-4 sm:px-6">
      <button
        className="rounded-lg px-2 py-2 text-sm font-semibold text-bright-teal-blue hover:bg-light-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bright-teal-blue/40 md:hidden"
        type="button"
        onClick={() => navigate("/dashboard/chat_room")}
        aria-label="Back to users"
      >
        Back
      </button>
      <h2 className="truncate text-base font-semibold text-deep-twilight">
        {userMatches && user ? (
          user.name
        ) : userError ? (
          "User"
        ) : (
          <span
            className="inline-block h-4 w-32 animate-pulse rounded bg-frosted-blue align-middle"
            aria-hidden="true"
          />
        )}
      </h2>
    </header>

    <div
      className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-5 sm:px-6"
      role="log"
      aria-label="Messages"
      aria-live="polite"
      aria-relevant="additions text"
      aria-busy={viewStatus === "loading"}
    >
      {viewStatus === "loading" ? (
        showSkeleton ? (
          <MessageListSkeleton />
        ) : null
      ) : viewStatus === "error" ? (
        <div className="m-auto flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-red-700" role="alert">
            {userError ?? messageError ?? "Something went wrong"}
          </p>
          <button
            className="cursor-pointer rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-bright-teal-blue transition-colors hover:bg-light-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-light-cyan/70"
            type="button"
            onClick={handleRetry}
          >
            Retry
          </button>
        </div>
      ) : !user?.conversationId ? (
        <p className="m-auto text-center text-sm text-bright-teal-blue">
          Select this user from the sidebar to start a conversation.
        </p>
      ) : messages.length === 0 ? (
        <p className="m-auto text-base font-medium text-white/85">
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
                className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm shadow-lg transition-shadow sm:max-w-[75%] ${isOwnMessage
                    ? "rounded-br-md border border-white/15 bg-deep-twilight text-white shadow-deep-twilight/15"
                    : "rounded-bl-md border border-frosted-blue/70 bg-white text-deep-twilight shadow-deep-twilight/10"
                  }`}
              >
                {editingMessageId === message.id ? (
                  <form className="min-w-56 space-y-2" onSubmit={handleSaveEdit}>
                    <textarea
                      className="max-h-40 min-h-16 w-full resize-y rounded-lg border border-light-cyan/40 bg-white/10 px-2.5 py-2 text-sm text-white outline-none placeholder:text-frosted-blue/70 focus:border-light-cyan focus:ring-2 focus:ring-light-cyan/30"
                      value={editDraft}
                      onChange={(event) => setEditDraft(event.target.value)}
                      maxLength={4000}
                      aria-label="Edit message text"
                      autoFocus
                    />
                    <div className="flex justify-end gap-1">
                      <button
                        className="cursor-pointer rounded-md p-1 text-frosted-blue transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-light-cyan/70 disabled:cursor-not-allowed disabled:opacity-50"
                        type="button"
                        aria-label="Cancel edit"
                        title="Cancel edit"
                        disabled={isUpdatingMessage}
                        onClick={() => {
                          setEditingMessageId(null);
                          setEditDraft("");
                        }}
                      >
                        <X className="size-4" aria-hidden="true" />
                      </button>
                      <button
                        className="cursor-pointer rounded-md p-1 text-frosted-blue transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-light-cyan/70 disabled:cursor-not-allowed disabled:opacity-50"
                        type="submit"
                        aria-label="Save edit"
                        title="Save edit"
                        disabled={!editDraft.trim() || isUpdatingMessage}
                      >
                        <Check className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <p>{message.text}</p>
                    <time
                      className={`mt-1 block text-right text-[11px] ${isOwnMessage
                          ? "text-frosted-blue"
                          : "text-bright-teal-blue"
                        }`}
                      dateTime={message.createdAt}
                    >
                      {new Date(message.createdAt).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                      {message.editedAt ? " · edited" : ""}
                    </time>
                    {isOwnMessage && (
                      <div className="mt-2 flex justify-end gap-1">
                        <button
                          className="cursor-pointer rounded-md p-1 text-frosted-blue transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-light-cyan/70 disabled:cursor-not-allowed disabled:opacity-50"
                          type="button"
                          aria-label="Edit message"
                          title="Edit message"
                          disabled={isUpdatingMessage || isDeletingMessage}
                          onClick={() => {
                            setEditingMessageId(message.id);
                            setEditDraft(message.text);
                            setMessageError(null);
                          }}
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                        </button>
                        <button
                          className="cursor-pointer rounded-md p-1 text-frosted-blue transition-colors hover:bg-red-500/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-light-cyan/70 disabled:cursor-not-allowed disabled:opacity-50"
                          type="button"
                          aria-label="Delete message"
                          title="Delete message"
                          disabled={isUpdatingMessage || isDeletingMessage}
                          onClick={() => setMessageToDelete(message)}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </article>
          );
        })
      )}
      {viewStatus === "ready" && messageError && (
        <p className="text-center text-sm text-red-700" role="alert">
          {messageError}
        </p>
      )}
      <div ref={messagesEndRef} />
    </div>

    <form
      className="flex shrink-0 items-end gap-3 p-3 sm:px-6 sm:py-4"
      onSubmit={handleSendMessage}
    >
      <label className="sr-only" htmlFor="chat-message">
        Message
      </label>
      <div
        className={`flex min-h-12 min-w-0 flex-1 items-end rounded-[1.6rem] border bg-light-cyan/70 px-4 py-1.5 transition-colors focus-within:border-bright-teal-blue focus-within:bg-white focus-within:ring-4 focus-within:ring-bright-teal-blue/10 ${conversationReady
            ? "border-frosted-blue"
            : "border-frosted-blue/60 opacity-70"
          }`}
      >
        <textarea
          ref={messageInputRef}
          id="chat-message"
          className="min-h-9 w-full resize-none self-center bg-transparent py-2 text-sm leading-5 text-deep-twilight outline-none transition-[height] duration-150 ease-out placeholder:text-bright-teal-blue/70 disabled:cursor-not-allowed"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder={
            conversationReady ? "Type a message..." : "Select a conversation"
          }
          maxLength={4000}
          disabled={!conversationReady}
          rows={1}
        />
      </div>
      <button
        className="flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-full bg-deep-twilight text-white shadow-md transition duration-150 hover:scale-105 hover:bg-bright-teal-blue focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-bright-teal-blue/25 disabled:cursor-not-allowed disabled:bg-frosted-blue disabled:shadow-none"
        type="submit"
        aria-label={isSending ? "Sending message" : "Send message"}
        title={isSending ? "Sending..." : "Send message"}
        disabled={!conversationReady || !draft.trim() || isSending}
        onMouseDown={(event) => event.preventDefault()}
      >
        {isSending ? (
          <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
        ) : (
          <Send className="size-5" aria-hidden="true" />
        )}
      </button>
    </form>
    <ConfirmDialog
      open={messageToDelete !== null}
      onOpenChange={(open) => {
        if (!open && !isDeletingMessage) {
          setMessageToDelete(null);
        }
      }}
      title="Delete message?"
      description="This message will be removed for everyone in this conversation."
      confirmLabel="Delete message"
      onConfirm={handleConfirmDelete}
      isLoading={isDeletingMessage}
      variant="danger"
    />
  </section>
);
}