const MESSAGE_ROWS = [
  { own: false, width: "w-48" },
  { own: true, width: "w-56" },
  { own: false, width: "w-64" },
  { own: true, width: "w-40" },
  { own: false, width: "w-52" },
  { own: true, width: "w-60" },
];

// Rendered inside the same scroll container as real messages, so the
// spacing matches and nothing shifts when the data arrives.
export function MessageListSkeleton() {
  return (
    <>
      {MESSAGE_ROWS.map((row, index) => (
        <div
          key={index}
          aria-hidden="true"
          className={`flex ${row.own ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`h-16 max-w-[85%] animate-pulse rounded-2xl sm:max-w-[75%] ${row.width} ${
              row.own
                ? "rounded-br-md bg-deep-twilight/60"
                : "rounded-bl-md bg-white/30"
            }`}
          />
        </div>
      ))}
    </>
  );
}

type ConversationListSkeletonProps = {
  rows?: number;
};

export function ConversationListSkeleton({
  rows = 6,
}: ConversationListSkeletonProps) {
  return (
    <ul aria-hidden="true" className="space-y-1 p-2">
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className="flex items-center gap-3 px-2 py-3">
          <div className="size-10 shrink-0 animate-pulse rounded-full bg-frosted-blue" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3.5 w-32 animate-pulse rounded bg-frosted-blue" />
            <div className="h-3 w-20 animate-pulse rounded bg-light-cyan" />
          </div>
        </li>
      ))}
    </ul>
  );
}