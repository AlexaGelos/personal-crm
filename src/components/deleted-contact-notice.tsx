"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { CircleCheck, X } from "lucide-react";

import { Button } from "@/components/ui/button";

const SHOW_MS = 5000;

// Confirms a deleted contact above the list. The name comes in ?deleted=;
// the message hides together with the parameter, so reload and "Back" don't bring it back
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
      className="flex items-start gap-3 rounded-inner border border-silver-line bg-(image:--sheen-silver) py-1 pr-1 pl-4 text-sm text-silver-foreground shadow-sheen"
    >
      {/* As tall as the close button: the icon, first line and button share one center */}
      <span className="flex h-10 flex-none items-center">
        <CircleCheck className="size-4.5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 py-2.5">
        <p className="break-words">Контакт «{name}» удалён</p>
        <p className="mt-0.5 text-silver-muted-foreground">Вы сами отвечаете за своё решение</p>
      </div>
      <Button type="button" variant="ghost" size="icon" onClick={hide} aria-label="Закрыть">
        <X />
      </Button>
    </div>
  );
}

// Drops ?deleted= from the URL without reloading the list
function hide() {
  const url = new URL(window.location.href);
  url.searchParams.delete("deleted");
  window.history.replaceState(null, "", url);
}
