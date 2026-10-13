"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Что-то пошло не так</h1>
      <p className="text-sm text-muted-foreground">
        Не получилось загрузить данные. Попробуйте ещё раз через минуту.
      </p>
      <Button onClick={() => retry()}>Попробовать ещё раз</Button>
    </div>
  );
}
