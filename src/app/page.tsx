import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

import { ContactList, ContactListSkeleton } from "@/components/contact-list";
import { DeletedContactNotice } from "@/components/deleted-contact-notice";
import { SearchBox, SearchBoxFallback } from "@/components/search-box";
import { Button } from "@/components/ui/button";

export default function HomePage({ searchParams }: PageProps<"/">) {
  return (
    <div className="flex flex-col gap-6">
      {/* Below md the small chandelier hangs on the right, so the button goes under the heading */}
      <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="font-heading text-[2.75rem] leading-none font-normal text-heading lg:text-[3.25rem]">
          Контакты
        </h1>
        <Button asChild size="lg">
          <Link href="/contacts/new">
            <Plus aria-hidden />
            Добавить контакт
          </Link>
        </Button>
      </div>

      <Suspense fallback={<SearchBoxFallback />}>
        <SearchBox />
      </Suspense>

      <Suspense fallback={null}>
        <DeletedContactNotice />
      </Suspense>

      <Suspense fallback={<ContactListSkeleton />}>
        <ContactList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
