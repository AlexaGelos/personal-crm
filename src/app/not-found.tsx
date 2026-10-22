import Link from "next/link";

import { Doorway } from "@/components/doorway";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <Doorway title="Такой страницы нет" text="Возможно, контакт удалили или в адресе опечатка.">
      <Button asChild variant="outline">
        <Link href="/">К списку контактов</Link>
      </Button>
    </Doorway>
  );
}
