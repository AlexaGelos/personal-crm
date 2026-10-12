"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

// Loads the next batch: replaces the URL with a bigger ?limit= and keeps the scroll position.
// The limit lives in the URL, so "Back" from a contact card returns to the same long list.
export function ShowMoreButton({ href }: { href: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      onClick={() => startTransition(() => router.replace(href, { scroll: false }))}
      aria-busy={isPending || undefined}
    >
      {isPending && <LoaderCircle className="animate-spin" aria-hidden />}
      Показать ещё
    </Button>
  );
}
