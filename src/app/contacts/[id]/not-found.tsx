import Link from "next/link";

import { Doorway } from "@/components/doorway";
import { Button } from "@/components/ui/button";

// A contact that does not exist and a contact of another user look exactly the same: nobody can
// tell from this page whether a record with that number is somebody else's
export default function ContactNotFound() {
  return (
    <Doorway title="Контакт не найден" text="Возможно, контакт удалили или в адресе опечатка.">
      <Button asChild variant="outline">
        <Link href="/">К списку контактов</Link>
      </Button>
    </Doorway>
  );
}
