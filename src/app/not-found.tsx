import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Такой страницы нет</h1>
      <p className="text-sm text-muted-foreground">
        Возможно, контакт удалили или в адресе опечатка.
      </p>
      <Button asChild variant="outline">
        <Link href="/">К списку контактов</Link>
      </Button>
    </div>
  );
}
