import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getRecentConversations } from "../../apis/conversations.api";
import {
  getLastSeenAt,
  subscribeToLatestConversationMessage,
} from "../../config/firebase-chat";
import { useAppSelector } from "../../store/hooks";
import type { RecentConversation } from "../../types/chat.types";
import chatSoundSrc from "../../assets/chat_sound.mp3";

export type SidebarTab = "users" | "recent";

type RecentConversationsContextValue = {
  recentConversationUpdates: RecentConversation[];
  updateRecentConversation: (conversation: RecentConversation) => void;
  activeSidebarTab: SidebarTab;
  setActiveSidebarTab: (tab: SidebarTab) => void;
  unreadConversationIds: ReadonlySet<string>;
  markConversationRead: (conversationId: string) => void;
};

const RecentConversationsContext =
  createContext<RecentConversationsContextValue | null>(null);

type RecentConversationsProviderProps = {
  children: ReactNode;
  activeConversationUserId?: string;
};

const chatSound = new Audio(chatSoundSrc);

function playIncomingMessageSound(): void {
  chatSound.currentTime = 0;
  void chatSound.play().catch((error: unknown) => {
    console.warn("Unable to play message notification sound", error);
  });
}

export function RecentConversationsProvider({
  children,
  activeConversationUserId,
}: RecentConversationsProviderProps) {
  const currentUserId = useAppSelector((state) => state.auth.user?.id ?? null);
  const firebaseUser = useAppSelector((state) => state.auth.firebaseUser);
  const [updatesByConversation, setUpdatesByConversation] = useState<
    Record<string, RecentConversation>
  >({});
  const [activeSidebarTab, setActiveSidebarTab] =
    useState<SidebarTab>("users");
  const subscriptionsRef = useRef(new Map<string, () => void>());
  const activeConversationUserIdRef = useRef(activeConversationUserId);
  activeConversationUserIdRef.current = activeConversationUserId;

  const [unreadConversationIds, setUnreadConversationIds] = useState<Set<string>>(
    () => new Set(),
  );

  const markConversationRead = useCallback((conversationId: string) => {
    setUnreadConversationIds((prev) => {
      if (!prev.has(conversationId)) return prev;
      const next = new Set(prev);
      next.delete(conversationId);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!activeConversationUserId) return;
    for (const conv of Object.values(updatesByConversation)) {
      if (conv.userId === activeConversationUserId) {
        markConversationRead(conv.conversationId);
      }
    }
  }, [activeConversationUserId, updatesByConversation, markConversationRead]);

  const updateRecentConversation = useCallback(
    (conversation: RecentConversation) => {
      setUpdatesByConversation((current) => {
        const previous = current[conversation.conversationId];
        if (
          previous?.lastMessageAt &&
          conversation.lastMessageAt &&
          Date.parse(previous.lastMessageAt) >
            Date.parse(conversation.lastMessageAt)
        ) {
          return current;
        }

        if (
          previous?.lastMessage === conversation.lastMessage &&
          previous.lastMessageAt === conversation.lastMessageAt &&
          previous.userId === conversation.userId &&
          previous.name === conversation.name
        ) {
          return current;
        }

        return {
          ...current,
          [conversation.conversationId]: conversation,
        };
      });
    },
    [],
  );

  const subscribeToConversation = useCallback(
    (conversation: RecentConversation) => {
      if (
        !currentUserId ||
        firebaseUser?.uid !== currentUserId ||
        subscriptionsRef.current.has(conversation.conversationId)
      ) {
        return;
      }

      // Closure-local variables to handle the race between getLastSeenAt
      // (async Firestore read) and the initial Firestore snapshot callback.
      // Either may arrive first; both orderings are handled correctly.
      let resolvedLastSeenAt: Date | null | undefined = undefined; // undefined = not yet loaded
      // undefined = initial snapshot hasn't arrived yet
      let pendingInitialMessage: { senderId: string; createdAt: string } | null | undefined =
        undefined;

      const checkInitialUnread = (
        message: { senderId: string; createdAt: string } | null,
        lastSeenAt: Date | null,
      ) => {
        if (!message || message.senderId === currentUserId) return;
        // Don't mark unread when the user already has this chat open.
        if (conversation.userId === activeConversationUserIdRef.current) return;
        const msgTime = Date.parse(message.createdAt);
        const isUnread = !lastSeenAt || msgTime > lastSeenAt.getTime();
        if (isUnread) {
          setUnreadConversationIds((prev) => {
            if (prev.has(conversation.conversationId)) return prev;
            return new Set(prev).add(conversation.conversationId);
          });
        }
      };

      // Fetch the user's last-seen timestamp from Firestore once on subscribe.
      void getLastSeenAt(conversation.conversationId, currentUserId)
        .then((seenAt) => {
          resolvedLastSeenAt = seenAt;
          // If the initial snapshot already arrived, process it now.
          if (pendingInitialMessage !== undefined) {
            checkInitialUnread(pendingInitialMessage, seenAt);
          }
        })
        .catch(() => {
          // On error fall back to treating everything as potentially unread.
          resolvedLastSeenAt = null;
          if (pendingInitialMessage !== undefined) {
            checkInitialUnread(pendingInitialMessage, null);
          }
        });

      const unsubscribe = subscribeToLatestConversationMessage(
        conversation.conversationId,
        currentUserId,
        (message, isInitialSnapshot, isNewMessage) => {
          // ── New message while the app is running ────────────────────────
          if (
            isNewMessage &&
            message &&
            message.senderId !== currentUserId &&
            conversation.userId !== activeConversationUserIdRef.current
          ) {
            playIncomingMessageSound();
            setUnreadConversationIds((prev) => {
              if (prev.has(conversation.conversationId)) return prev;
              return new Set(prev).add(conversation.conversationId);
            });
          }

          // ── Initial snapshot on mount — check against persisted lastSeenAt ──
          if (isInitialSnapshot) {
            if (resolvedLastSeenAt !== undefined) {
              // getLastSeenAt already resolved — check immediately.
              checkInitialUnread(message, resolvedLastSeenAt);
            } else {
              // getLastSeenAt still in-flight — store message for deferred check.
              pendingInitialMessage = message;
            }

            // Skip the recent-conversation update if data already matches.
            const currentTimestamp = conversation.lastMessageAt
              ? Date.parse(conversation.lastMessageAt)
              : null;
            const latestTimestamp = message
              ? Date.parse(message.createdAt)
              : null;
            const timestampsMatch =
              currentTimestamp === null
                ? latestTimestamp === null
                : latestTimestamp !== null &&
                  Math.abs(currentTimestamp - latestTimestamp) < 2000;
            if (
              conversation.lastMessage === (message?.text ?? null) &&
              timestampsMatch
            ) {
              return;
            }
          }

          updateRecentConversation({
            ...conversation,
            lastMessage: message?.text ?? null,
            lastMessageAt: message?.createdAt ?? null,
          });
        },
        (error) => {
          console.error(
            `Unable to listen for messages in conversation ${conversation.conversationId}`,
            error,
          );
        },
      );
      subscriptionsRef.current.set(conversation.conversationId, unsubscribe);
    },
    [currentUserId, firebaseUser?.uid, updateRecentConversation],
  );

  useEffect(() => {
    if (!currentUserId || firebaseUser?.uid !== currentUserId) {
      return;
    }

    let active = true;
    const loadConversations = async () => {
      try {
        let page = 1;
        let totalPages = 1;
        do {
          const result = await getRecentConversations(page);
          if (!active) {
            return;
          }

          totalPages = result.totalPages;
          result.conversations.forEach(subscribeToConversation);
          page = result.page + 1;
        } while (page <= totalPages);
      } catch (error) {
        if (active) {
          console.error("Unable to load conversations for realtime updates", error);
        }
      }
    };

    void loadConversations();
    return () => {
      active = false;
      subscriptionsRef.current.forEach((unsubscribe) => unsubscribe());
      subscriptionsRef.current.clear();
    };
  }, [currentUserId, firebaseUser?.uid, subscribeToConversation]);

  useEffect(() => {
    Object.values(updatesByConversation).forEach(subscribeToConversation);
  }, [subscribeToConversation, updatesByConversation]);

  const value = useMemo(
    () => ({
      recentConversationUpdates: Object.values(updatesByConversation),
      updateRecentConversation,
      activeSidebarTab,
      setActiveSidebarTab,
      unreadConversationIds,
      markConversationRead,
    }),
    [
      activeSidebarTab,
      updatesByConversation,
      updateRecentConversation,
      setActiveSidebarTab,
      unreadConversationIds,
      markConversationRead,
    ],
  );

  return (
    <RecentConversationsContext.Provider value={value}>
      {children}
    </RecentConversationsContext.Provider>
  );
}

export function useRecentConversations() {
  const context = useContext(RecentConversationsContext);
  if (!context) {
    throw new Error(
      "useRecentConversations must be used within RecentConversationsProvider",
    );
  }
  return context;
}
