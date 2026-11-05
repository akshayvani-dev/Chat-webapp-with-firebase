import { useEffect, useRef } from "react";
import type { ChatMessage, DirectoryUser } from "../../types/chat.types";
import MessageBubble from "./MessageBubble";
import MessageComposer from "./MessageComposer";

type ChatPanelProps = {
  currentUserId: string;
  selectedUser: DirectoryUser | null;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onBack: () => void;
  className?: string;
};

export default function ChatPanel({
  currentUserId,
  selectedUser,
  messages,
  onSendMessage,
  onBack,
  className = "",
}: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, selectedUser?.id]);

  if (!selectedUser) {
    return (
      <section
        className={`flex min-h-0 flex-1 items-center justify-center bg-stone-50 px-6 text-center ${className}`}
        aria-label="Conversation"
      >
        <p className="text-sm text-stone-500">Select a user to start chatting</p>
      </section>
    );
  }

  return (
    <section
      className={`flex min-h-0 flex-1 flex-col bg-stone-50 ${className}`}
      aria-label={`Conversation with ${selectedUser.name}`}
    >
      <header className="flex h-[73px] shrink-0 items-center gap-3 border-b border-stone-200 bg-white px-4 sm:px-6">
        <button
          className="rounded-lg px-2 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/40 md:hidden"
          type="button"
          onClick={onBack}
          aria-label="Back to users"
        >
          Back
        </button>
        <h2 className="truncate text-base font-semibold text-stone-900">
          {selectedUser.name}
        </h2>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {messages.length === 0 ? (
            <p className="py-8 text-center text-sm text-stone-500">
              No messages yet. Send a message to start.
            </p>
          ) : (
            messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isMine={message.senderId === currentUserId}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <MessageComposer onSend={onSendMessage} />
    </section>
  );
}
