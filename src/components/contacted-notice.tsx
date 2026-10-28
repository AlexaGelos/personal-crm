"use client";

import { startTransition, useEffect, useLayoutEffect, useState, useTransition } from "react";
import { X } from "lucide-react";

import { markContacted, undoContacted } from "@/app/actions";
import { Button } from "@/components/ui/button";
import type { ContactedMark } from "@/lib/validation";

const SHOW_MS = 8000;

type Notice = { mark: ContactedMark; undoError?: string };

// "Связались" with its "Отмечено" message, for the card and the home block.
// The message lives in this state, not in the URL: it holds the old value for the undo,
// and a reload must not bring it back
export function useContactedMark() {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [error, setError] = useState<string>();
  const [markingId, setMarkingId] = useState<number | null>(null);
  const [isMarking, startMarking] = useTransition();
  const [isUndoing, startUndoing] = useTransition();

  // A new message or an undo error starts the 8 seconds again
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), SHOW_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  // The page stays mounted while hidden: coming back shows no stale message
  useLayoutEffect(
    () => () => {
      setNotice(null);
      setError(undefined);
    },
    [],
  );

  function mark(contactId: number) {
    setMarkingId(contactId);
    startMarking(async () => {
      const result = await markContacted(contactId);
      // Shown together with the page the action re-rendered
      startTransition(() => {
        if ("error" in result) {
          setNotice(null);
          setError(result.error);
        } else {
          setError(undefined);
          setNotice({ mark: result.mark });
        }
      });
    });
  }

  function undo() {
    if (!notice) return;
    const { contactId, previous, markedAt } = notice.mark;
    startUndoing(async () => {
      const result = await undoContacted(contactId, previous, markedAt);
      startTransition(() => {
        setNotice((current) =>
          result.error && current ? { ...current, undoError: result.error } : null,
        );
      });
    });
  }

  return {
    notice,
    error,
    isUndoing,
    isMarking: (contactId: number) => isMarking && markingId === contactId,
    mark,
    undo,
    close: () => setNotice(null),
  };
}

// "Отмечено: <имя>" after "Связались". The same frame as the "contact deleted" message.
// While it is on the page (`data-contacted-notice`), all candles flare up and the room
// grows lighter; they calm down again when the message goes away - see globals.css.
export function ContactedNotice({
  name,
  error,
  undoing,
  onUndo,
  onClose,
}: {
  name: string;
  error?: string;
  undoing: boolean;
  onUndo: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div
        role="status"
        data-contacted-notice
        className="flex items-center gap-2.5 rounded-inner border border-mourning-line bg-popover py-1 pr-1 pl-3.5 text-[0.9375rem] shadow-mourning sm:gap-3 sm:pl-4"
      >
        <LitCandleIcon />
        <p className="min-w-0 flex-1 py-2 leading-snug break-words sm:py-2.5">Отмечено: {name}</p>
        <Button
          type="button"
          variant="outline"
          onClick={onUndo}
          disabled={undoing}
          className="px-3 text-[0.84375rem] tracking-normal normal-case sm:px-4"
        >
          Отменить
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Закрыть"
          className="size-11"
        >
          <X />
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

// A burning candle
function LitCandleIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.3}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4.5 flex-none text-subtle-foreground"
    >
      <path d="M9.5 11h5v10h-5z" />
      <path d="M12 11V9.5" />
      <path
        d="M12 3.5c1.3 1.6 2 2.6 2 3.8a2 2 0 0 1-4 0c0-1.2.7-2.2 2-3.8Z"
        stroke="none"
        className="fill-(--flame-body)"
      />
    </svg>
  );
}
