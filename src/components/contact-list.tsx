import Link from "next/link";
import { UserRound } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { countContacts, listContacts } from "@/lib/data";
import { pluralize } from "@/lib/format";

const CONTACT_FORMS: [string, string, string] = ["контакт", "контакта", "контактов"];

export async function ContactList({
  searchParams,
}: {
  searchParams: PageProps<"/">["searchParams"];
}) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const [rows, total] = await Promise.all([listContacts(query), countContacts()]);

  if (total === 0) {
    return (
      <EmptyState
        title="Пока нет ни одного контакта"
        hint="Нажмите «Добавить контакт», чтобы записать первого человека."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {query
          ? `Найдено: ${rows.length.toLocaleString("ru-RU")} (всего ${pluralize(total, CONTACT_FORMS)})`
          : `Всего ${pluralize(total, CONTACT_FORMS)}`}
      </p>

      {rows.length === 0 ? (
        <EmptyState
          title={`Никого не нашли по запросу «${query}»`}
          hint="Проверьте написание или поищите по части имени, телефона или почты."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-background">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Имя</TableHead>
                <TableHead className="hidden md:table-cell">Кто это</TableHead>
                <TableHead className="hidden sm:table-cell">Телефон</TableHead>
                <TableHead className="hidden pr-4 lg:table-cell">Почта</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((contact) => (
                // The name link stretches over the whole row, so any cell opens the card
                <TableRow key={contact.id} className="relative">
                  <TableCell className="py-2.5 pl-4 font-medium">
                    <Link
                      href={`/contacts/${contact.id}`}
                      className="outline-none after:absolute after:inset-0 focus-visible:underline"
                    >
                      {contact.name}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden max-w-72 truncate text-muted-foreground md:table-cell">
                    {contact.about}
                  </TableCell>
                  <TableCell className="hidden tabular-nums sm:table-cell">
                    {contact.phone}
                  </TableCell>
                  <TableCell className="hidden pr-4 lg:table-cell">
                    {contact.email}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-background px-6 py-12 text-center">
      <UserRound className="size-8 text-muted-foreground" aria-hidden />
      <p className="font-medium">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}

export function ContactListSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Загружаем контакты">
      <div className="h-5 w-40 animate-pulse rounded bg-muted" />
      <div className="flex flex-col gap-3 rounded-xl border bg-background p-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-5 animate-pulse rounded bg-muted" />
        ))}
      </div>
    </div>
  );
}
