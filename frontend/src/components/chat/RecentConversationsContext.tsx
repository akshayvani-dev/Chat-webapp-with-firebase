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

let notificationAudioContext: AudioContext | null = null;

function prepareNotificationAudio(): void {
  if (!notificationAudioContext && typeof window !== "undefined") {
    const AudioContextConstructor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (AudioContextConstructor) {
      notificationAudioContext = new AudioContextConstructor();
    }
  }

  if (notificationAudioContext?.state === "suspended") {
    void notificationAudioContext.resume().catch((error: unknown) => {
      console.warn("Unable to enable message notification sound", error);
    });
  }
}

function playIncomingMessageSound(): void {
  const context = notificationAudioContext;
  if (!context || context.state !== "running") {
    return;
  }

  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime;

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(740, now);
  oscillator.frequency.setValueAtTime(880, now + 0.08);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.18);
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

  useEffect(() => {
    const unlockAudio = () => prepareNotificationAudio();
    window.addEventListener("pointerdown", unlockAudio);
    window.addEventListener("keydown", unlockAudio);
    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, []);

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
