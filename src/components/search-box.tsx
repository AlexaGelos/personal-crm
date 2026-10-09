"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoaderCircle, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const DEBOUNCE_MS = 250;
const PLACEHOLDER = "Поиск по имени, телефону или почте";

// Live search: updates ?q= in the URL while the user types
export function SearchBox() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";

  const [value, setValue] = useState(urlQuery);
  const [syncedQuery, setSyncedQuery] = useState(urlQuery);
  const [sentQuery, setSentQuery] = useState(urlQuery);
  const [isPending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  // The URL changed from outside (header link, back button): show its query.
  // Our own debounced updates are skipped so they don't overwrite fresh typing.
  if (urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery);
    if (urlQuery !== sentQuery) {
      setValue(urlQuery);
    }
  }

  // The page stays mounted while hidden: never navigate from a hidden page
  useEffect(() => () => clearTimeout(timer.current), []);

  // Text typed before React hydrated the page is only in the DOM: pick it up
  useEffect(() => {
    const typed = inputRef.current?.value ?? "";
    if (typed !== value) handleChange(typed);
    // Run once on mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleChange(next: string) {
    setValue(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const query = next.trim();
      setSentQuery(query);
      startTransition(() => {
        router.replace(query ? `/?q=${encodeURIComponent(query)}` : "/", {
          scroll: false,
        });
      });
    }, DEBOUNCE_MS);
  }

  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => handleChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") handleChange("");
        }}
        placeholder={PLACEHOLDER}
        aria-label={PLACEHOLDER}
        autoComplete="off"
        className="h-10 bg-background pr-10 pl-9 [&::-webkit-search-cancel-button]:hidden"
      />
      <div className="absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center">
        {isPending ? (
          <LoaderCircle
            className="mr-1.5 size-4 animate-spin text-muted-foreground"
            aria-label="Ищем…"
          />
        ) : value ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => handleChange("")}
            aria-label="Очистить поиск"
          >
            <X />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function SearchBoxFallback() {
  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        disabled
        placeholder={PLACEHOLDER}
        aria-label={PLACEHOLDER}
        className="h-10 bg-background pl-9"
      />
    </div>
  );
}
