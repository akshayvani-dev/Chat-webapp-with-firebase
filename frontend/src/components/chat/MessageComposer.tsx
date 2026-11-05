import { useState, type FormEvent, type KeyboardEvent } from "react";

const MAX_WORDS = 300;

type MessageComposerProps = {
  onSend: (text: string) => void;
};

function countWords(text: string): number {
  const trimmedText = text.trim();
  return trimmedText.length === 0 ? 0 : trimmedText.split(/\s+/).length;
}

export default function MessageComposer({ onSend }: MessageComposerProps) {
  const [text, setText] = useState("");
  const wordCount = countWords(text);
  const isOverLimit = wordCount > MAX_WORDS;
  const isEmpty = text.trim().length === 0;

  const sendMessage = () => {
    if (isEmpty || isOverLimit) {
      return;
    }

    onSend(text.trim());
    setText("");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    sendMessage();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  return (
    <form
      className="shrink-0 border-t border-stone-200 bg-white p-4 sm:px-6"
      onSubmit={handleSubmit}
    >
      <label className="sr-only" htmlFor="message-composer">
        Write a message
      </label>
      <div className="flex items-end gap-3">
        <textarea
          className="min-h-12 flex-1 resize-none rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-5 text-stone-900 outline-none placeholder:text-stone-400 focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/10"
          id="message-composer"
          rows={2}
          placeholder="Write a message..."
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          className="rounded-xl bg-emerald-800 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-700/25 disabled:cursor-not-allowed disabled:bg-stone-300"
          type="submit"
          disabled={isEmpty || isOverLimit}
        >
          Send
        </button>
      </div>
      <p
        className={`mt-2 text-right text-xs ${
          wordCount >= MAX_WORDS ? "text-red-600" : "text-stone-500"
        }`}
        aria-live="polite"
      >
        {wordCount}/{MAX_WORDS}
      </p>
    </form>
  );
}
