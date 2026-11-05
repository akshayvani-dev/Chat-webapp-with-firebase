import { useState } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
  variant?: "default" | "danger";
};

export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  isLoading = false,
  variant = "default",
}: ConfirmDialogProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const isBusy = isLoading || isConfirming;
  const confirmButtonClassName =
    variant === "danger"
      ? "bg-red-700 hover:bg-red-800 focus-visible:ring-red-700/25"
      : "bg-emerald-900 hover:bg-emerald-800 focus-visible:ring-emerald-700/25";

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isBusy) {
      return;
    }

    onOpenChange(nextOpen);
  };

  const handleConfirm = async (
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();
    if (isBusy) {
      return;
    }

    setIsConfirming(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (error) {
      console.error("Confirmation failed.", error);
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <AlertDialog.Root open={open} onOpenChange={handleOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-stone-950/40 data-[state=open]:animate-[fade-in_180ms_ease-out]" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl outline-none data-[state=open]:animate-[dialog-in_180ms_cubic-bezier\(0.16\,1\,0.3\,1\)]">
          <AlertDialog.Title className="text-lg font-semibold text-stone-900">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm leading-6 text-stone-600">
            {description}
          </AlertDialog.Description>
          <div className="mt-6 flex justify-end gap-3">
            <AlertDialog.Cancel asChild>
              <button
                className="rounded-xl border border-stone-300 px-4 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-stone-400/25 disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                disabled={isBusy}
              >
                {cancelLabel}
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-4 disabled:cursor-wait disabled:opacity-70 ${confirmButtonClassName}`}
                type="button"
                disabled={isBusy}
                aria-busy={isBusy}
                onClick={handleConfirm}
              >
                {isBusy ? "Please wait..." : confirmLabel}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
