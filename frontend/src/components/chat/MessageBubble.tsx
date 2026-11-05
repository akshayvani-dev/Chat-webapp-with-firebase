import type { ChatMessage } from "../../types/chat.types";

type MessageBubbleProps = {
  message: ChatMessage;
  isMine: boolean;
};

export default function MessageBubble({
  message,
  isMine,
}: MessageBubbleProps) {
  const time = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(message.timestamp));

  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[min(80%,32rem)] rounded-2xl px-4 py-3 ${
          isMine
            ? "rounded-br-md bg-emerald-800 text-white"
            : "rounded-bl-md border border-stone-200 bg-white text-stone-800"
        }`}
      >
        <p className="whitespace-pre-wrap break-words text-sm leading-6">
          {message.text}
        </p>
        <time
          className={`mt-1 block text-right text-[11px] ${
            isMine ? "text-emerald-100" : "text-stone-400"
          }`}
          dateTime={message.timestamp}
        >
          {time}
        </time>
      </div>
    </div>
  );
}
