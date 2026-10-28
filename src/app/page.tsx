import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

import { ContactList, ContactListSkeleton } from "@/components/contact-list";
import { DeletedContactNotice } from "@/components/deleted-contact-notice";
import { GroupFilter } from "@/components/group-filter";
import { KeepInTouch } from "@/components/keep-in-touch";
import { RunningDemon } from "@/components/running-demon";
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

      {/* Above "Пора связаться": the chosen group filters the block and the list alike.
          The placeholder keeps the height, so the page does not jump when the row arrives */}
      <Suspense fallback={<div className="h-11" aria-hidden />}>
        <GroupFilter searchParams={searchParams} />
      </Suspense>

      {/* Above "Пора связаться": on phones the block fills the screen, a message below it is out of sight */}
      <Suspense fallback={null}>
        <DeletedContactNotice />
      </Suspense>

      {/* No placeholder: most of the time there is no block, a placeholder would only flicker */}
      <Suspense fallback={null}>
        <KeepInTouch searchParams={searchParams} />
      </Suspense>

      <Suspense fallback={<SearchBoxFallback />}>
        <SearchBox />
      </Suspense>

      <Suspense fallback={<ContactListSkeleton />}>
        <ContactList searchParams={searchParams} />
      </Suspense>

      <RunningDemon />
    </div>
  );
}
