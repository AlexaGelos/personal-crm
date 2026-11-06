import type { Metadata } from "next";
import Link from "next/link";

import { Doorway } from "@/components/doorway";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Ссылка устарела",
};

// Where the link from the email leads when it does not work: used, older than 15 minutes,
// replaced by a newer one, or made up
export default function LinkExpiredPage() {
  return (
    <Doorway title="Ссылка устарела" text="Запроси новую">
      <Button asChild>
        <Link href="/login">На страницу входа</Link>
      </Button>
    </Doorway>
  );
}
