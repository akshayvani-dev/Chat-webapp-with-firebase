export type DirectoryUser = {
  id: string;
  name: string;
};

export type ListedUser = DirectoryUser & {
  chatInitiated: boolean;
  conversationId: string | null;
};
