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
import { subscribeToLatestConversationMessage } from "../../config/firebase-chat";
import { useAppSelector } from "../../store/hooks";
import type { RecentConversation } from "../../types/chat.types";
import chatSoundSrc from "../../assets/chat_sound.mp3";

export type SidebarTab = "users" | "recent";

type RecentConversationsContextValue = {
  recentConversationUpdates: RecentConversation[];
  updateRecentConversation: (conversation: RecentConversation) => void;
  activeSidebarTab: SidebarTab;
  setActiveSidebarTab: (tab: SidebarTab) => void;
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

      const unsubscribe = subscribeToLatestConversationMessage(
        conversation.conversationId,
        currentUserId,
        (message, isInitialSnapshot, isNewMessage) => {
          if (
            isNewMessage &&
            message &&
            message.senderId !== currentUserId &&
            conversation.userId !== activeConversationUserIdRef.current
          ) {
            playIncomingMessageSound();
          }

          if (isInitialSnapshot) {
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
    }),
    [
      activeSidebarTab,
      updatesByConversation,
      updateRecentConversation,
      setActiveSidebarTab,
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
