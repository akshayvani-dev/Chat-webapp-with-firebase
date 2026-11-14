import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
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
};

export function RecentConversationsProvider({
  children,
}: RecentConversationsProviderProps) {
  const [updatesByConversation, setUpdatesByConversation] = useState<
    Record<string, RecentConversation>
  >({});
  const [activeSidebarTab, setActiveSidebarTab] =
    useState<SidebarTab>("users");

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

        return {
          ...current,
          [conversation.conversationId]: conversation,
        };
      });
    },
    [],
  );

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
