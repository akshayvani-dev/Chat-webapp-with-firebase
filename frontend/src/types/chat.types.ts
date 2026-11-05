export type DirectoryUser = {
  id: string;
  name: string;
};

export type ChatMessage = {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
};

export type ConversationsByUser = Record<string, ChatMessage[]>;
