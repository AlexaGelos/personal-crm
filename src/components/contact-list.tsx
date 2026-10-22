import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar } from "@/components/avatar";
import { LoneCandle } from "@/components/lone-candle";
import { ShowMoreButton } from "@/components/show-more-button";
import { countContacts, listContacts } from "@/lib/data";
import { CONTACT_FORMS, formatNumber, pluralize } from "@/lib/format";

// Contacts shown on open and added by each "Показать ещё" click
const PAGE_SIZE = 50;

// "?limit=100" -> 100; missing, malformed or too small -> the first batch
function parseLimit(value: string | string[] | undefined) {
  if (typeof value !== "string" || !/^\d{1,6}$/.test(value)) return PAGE_SIZE;
  return Math.max(Number(value), PAGE_SIZE);
}

// Keeps ?due=all, so the "Пора связаться" block above stays expanded
function showMoreHref(query: string, limit: number, dueAll: boolean) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (dueAll) params.set("due", "all");
  params.set("limit", String(limit));
  return `/?${params}`;
}

export async function ContactList({
  searchParams,
}: {
  searchParams: PageProps<"/">["searchParams"];
}) {
  const { q, limit: limitParam, due } = await searchParams;
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
        candle="unlit"
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
      <p className="text-[0.8125rem] text-muted-foreground">{summary}</p>

      {rows.length === 0 ? (
        <EmptyState
          candle="snuffed"
          title={`Никого не нашли по запросу «${query}»`}
          hint="Проверьте написание или поищите по части имени, телефона или почты."
        />
      ) : (
        <div className="overflow-hidden rounded-card border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6">Имя</TableHead>
                <TableHead className="hidden md:table-cell">Кто это</TableHead>
                <TableHead className="hidden sm:table-cell">Телефон</TableHead>
                <TableHead className="hidden pr-6 lg:table-cell">Почта</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((contact) => (
                // The name link stretches over the whole row, so any cell opens the card.
                // On hover the row warms up from the left, as if a candle were brought closer.
                <TableRow
                  key={contact.id}
                  className="group/row relative hover:bg-transparent [&>td:first-child]:bg-no-repeat hover:[&>td:first-child]:bg-(image:--glow-row)"
                >
                  <TableCell className="py-2.5 pl-6">
                    <div className="flex items-center gap-3.5">
                      <Avatar
                        name={contact.name}
                        className="group-hover/row:border-glow-line group-hover/row:shadow-glow-avatar"
                      />
                      <Link
                        href={`/contacts/${contact.id}`}
                        className="font-heading text-xl font-medium text-heading transition-colors duration-400 outline-none group-hover/row:text-glow-text after:absolute after:inset-0 focus-visible:underline"
                      >
                        {contact.name}
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell className="hidden max-w-72 truncate text-muted-foreground md:table-cell">
                    {contact.about}
                  </TableCell>
                  <TableCell className="hidden text-soft-foreground tabular-nums sm:table-cell">
                    {contact.phone}
                  </TableCell>
                  <TableCell className="hidden pr-6 text-soft-foreground lg:table-cell">
                    {contact.email}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {hasMore && (
        <div className="mt-3 flex justify-center">
          <ShowMoreButton
            href={showMoreHref(query, rows.length + PAGE_SIZE, due === "all")}
            label="Показать ещё"
          />
        </div>
      )}
    </div>
  );
}

function EmptyState({
  candle,
  title,
  hint,
}: {
  candle: "unlit" | "snuffed";
  title: string;
  hint: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2.5 rounded-card border border-dashed border-avatar-line bg-card px-7 pt-11 pb-12 text-center">
      <div className="mb-2">
        <LoneCandle id={`empty-candle-${candle}`} state={candle} />
      </div>
      <p className="font-heading text-[1.625rem] leading-tight font-medium text-heading">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}

export function ContactListSkeleton() {
  // A warm glint passes over the placeholders while the list loads
  const shimmer = "bg-(image:--glow-shimmer) bg-size-[720px_100%] motion-safe:animate-shimmer";

  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Загружаем контакты">
      <div className={`h-2.5 w-44 ${shimmer}`} />
      <div className="flex flex-col gap-4 rounded-card border bg-card px-6 py-5">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-3.5">
            <div className={`size-9 flex-none rounded-full ${shimmer}`} />
            <div className={`h-2.5 w-2/5 ${shimmer}`} />
          </div>
        ))}
      </div>
    </div>
  );
}
