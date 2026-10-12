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
import { Avatar } from "@/components/avatar";
import { ShowMoreButton } from "@/components/show-more-button";
import { countContacts, listContacts } from "@/lib/data";
import { formatNumber, pluralize } from "@/lib/format";

const CONTACT_FORMS: [string, string, string] = ["контакт", "контакта", "контактов"];

// Contacts shown on open and added by each "Показать ещё" click
const PAGE_SIZE = 50;

// "?limit=100" -> 100; missing, malformed or too small -> the first batch
function parseLimit(value: string | string[] | undefined) {
  if (typeof value !== "string" || !/^\d{1,6}$/.test(value)) return PAGE_SIZE;
  return Math.max(Number(value), PAGE_SIZE);
}

function showMoreHref(query: string, limit: number) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  params.set("limit", String(limit));
  return `/?${params}`;
}

export async function ContactList({
  searchParams,
}: {
  searchParams: PageProps<"/">["searchParams"];
}) {
  const { q, limit: limitParam } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const limit = parseLimit(limitParam);
  const [rows, total, matched] = await Promise.all([
    listContacts(query, limit),
    countContacts(),
    query ? countContacts(query) : null,
  ]);
  const found = matched ?? total;
  const hasMore = rows.length < found;

  if (total === 0) {
    return (
      <EmptyState
        title="Пока нет ни одного контакта"
        hint="Нажмите «Добавить контакт», чтобы записать первого человека."
      />
    );
  }

  let summary: string;
  if (query) {
    summary = hasMore
      ? `Найдено: ${formatNumber(found)}, показано ${formatNumber(rows.length)}`
      : `Найдено: ${formatNumber(found)} (всего ${pluralize(total, CONTACT_FORMS)})`;
  } else {
    summary = hasMore
      ? `Показано ${formatNumber(rows.length)} из ${formatNumber(total)}`
      : `Всего ${pluralize(total, CONTACT_FORMS)}`;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{summary}</p>

      {rows.length === 0 ? (
        <EmptyState
          title={`Никого не нашли по запросу «${query}»`}
          hint="Проверьте написание или поищите по части имени, телефона или почты."
        />
      ) : (
        <div className="overflow-hidden rounded-card border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Имя</TableHead>
                <TableHead className="hidden md:table-cell">Кто это</TableHead>
                <TableHead className="hidden sm:table-cell">Телефон</TableHead>
                <TableHead className="hidden pr-5 lg:table-cell">Почта</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((contact) => (
                // The name link stretches over the whole row, so any cell opens the card
                <TableRow key={contact.id} className="relative">
                  <TableCell className="py-2.5 pl-5 font-medium">
                    <div className="flex items-center gap-3">
                      <Avatar name={contact.name} />
                      <Link
                        href={`/contacts/${contact.id}`}
                        className="outline-none after:absolute after:inset-0 focus-visible:underline"
                      >
                        {contact.name}
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell className="hidden max-w-72 truncate text-muted-foreground md:table-cell">
                    {contact.about}
                  </TableCell>
                  <TableCell className="hidden tabular-nums sm:table-cell">
                    {contact.phone}
                  </TableCell>
                  <TableCell className="hidden pr-5 lg:table-cell">
                    {contact.email}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center">
          <ShowMoreButton href={showMoreHref(query, rows.length + PAGE_SIZE)} />
        </div>
      )}
    </div>
  );
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-input bg-card px-6 py-12 text-center">
      <div className="mb-2 flex size-12 items-center justify-center rounded-field bg-primary-tint text-primary-soft">
        <UserRound className="size-5.5" aria-hidden />
      </div>
      <p className="font-medium">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}

export function ContactListSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Загружаем контакты">
      <div className="h-5 w-40 animate-pulse rounded-full bg-muted" />
      <div className="flex flex-col gap-3 rounded-card border bg-card p-5">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="size-9 flex-none animate-pulse rounded-full bg-primary-tint-strong" />
            <div className="h-2.5 w-2/5 animate-pulse rounded-full bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
