import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

import { ContactList, ContactListSkeleton } from "@/components/contact-list";
import { SearchBox, SearchBoxFallback } from "@/components/search-box";
import { Button } from "@/components/ui/button";

export default function HomePage({ searchParams }: PageProps<"/">) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight lg:text-4xl">Контакты</h1>
        <Button asChild size="lg" className="shadow-cta hover:shadow-cta-hover">
          <Link href="/contacts/new">
            <Plus aria-hidden />
            Добавить контакт
          </Link>
        </Button>
      </div>

      <Suspense fallback={<SearchBoxFallback />}>
        <SearchBox />
      </Suspense>

      <Suspense fallback={<ContactListSkeleton />}>
        <ContactList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
