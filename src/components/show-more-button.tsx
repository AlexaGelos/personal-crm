"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

// Shows more or fewer rows: replaces the URL (a bigger ?limit=, ?due=all) and keeps the scroll
// position. The state lives in the URL, so "Back" from a contact card returns to the same view.
export function ShowMoreButton({ href, label }: { href: string; label: string }) {
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
      {label}
    </Button>
  );
}
