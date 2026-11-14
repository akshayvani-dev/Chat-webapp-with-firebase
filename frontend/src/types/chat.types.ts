export type DirectoryUser = {
  id: string;
  name: string;
  conversationId: string | null;
};

export type ConversationMessage = {
  id: string;
  text: string;
  senderId: string;
  createdAt: string;
};

export type ListedUser = {
  id: string;
  name: string;
};

export type RecentConversation = {
  conversationId: string;
  userId: string;
  name: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
};
