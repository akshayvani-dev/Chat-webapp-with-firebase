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

export type ListedUser = DirectoryUser & {
  chatInitiated: boolean;
  conversationId: string | null;
};
