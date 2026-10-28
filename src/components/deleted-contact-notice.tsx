"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";

const SHOW_MS = 8000;

// Confirms a deleted contact at the top of the page, above "Пора связаться".
// The name comes in ?deleted=; the message hides together with the parameter,
// so reload and "Back" don't bring it back.
// While the message is on the page (`data-deleted-notice`), all candles go out and the room
// goes dark; they light up again when the message goes away - see globals.css.
export function DeletedContactNotice() {
  const name = useSearchParams().get("deleted");

  // Cleared when the page is hidden: never change the URL from a hidden page
  useEffect(() => {
    if (!name) return;
    const timer = setTimeout(hide, SHOW_MS);
    return () => clearTimeout(timer);
  }, [name]);

  if (!name) return null;

  return (
    <div
      role="status"
      data-deleted-notice
      // A double mourning frame
      className="flex items-start gap-3 rounded-inner border border-mourning-line bg-popover py-1 pr-1 pl-4 text-[0.9375rem] shadow-mourning"
    >
      {/* As tall as the close button: the icon, first line and button share one center */}
      <span className="flex h-11 flex-none items-center text-subtle-foreground">
        <SnuffedCandleIcon />
      </span>
      <div className="min-w-0 flex-1 py-3">
        <p className="break-words">Контакт «{name}» удалён</p>
        <p className="mt-1 font-gothic text-xl leading-snug text-rose">
          Вы сами отвечаете за своё решение
        </p>
      </div>
      <Button type="button" variant="ghost" size="icon" onClick={hide} aria-label="Закрыть">
        <X />
      </Button>
    </div>
  );
}

// A blown-out candle with a curl of smoke
function SnuffedCandleIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.3}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4.5"
    >
      <path d="M9.5 11h5v10h-5z" />
      <path d="M12 11V9" />
      <path d="M12 7c-1.4-1.3 1.4-2.3 0-4" />
    </svg>
  );
}

// Drops ?deleted= from the URL without reloading the list
function hide() {
  const url = new URL(window.location.href);
  url.searchParams.delete("deleted");
  window.history.replaceState(null, "", url);
}
