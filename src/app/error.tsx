"use client";

import { useEffect } from "react";

import { Doorway } from "@/components/doorway";
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
    <Doorway title="Что-то пошло не так" text="Не получилось загрузить данные. Попробуйте ещё раз через минуту.">
      <Button onClick={() => retry()}>Попробовать ещё раз</Button>
    </Doorway>
  );
}
