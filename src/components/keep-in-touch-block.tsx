"use client";

import Link from "next/link";
import { Check } from "lucide-react";

import { Avatar } from "@/components/avatar";
import { ContactedNotice, useContactedMark } from "@/components/contacted-notice";
import { ShowMoreButton } from "@/components/show-more-button";
import { Button } from "@/components/ui/button";
import { CONTACT_FORMS, formatOverdue, pluralize } from "@/lib/format";

export type OverdueRow = {
  id: number;
  name: string;
  about: string | null;
  overdueDays: number;
};

// "Показать всех" / "Свернуть"; none when everybody fits into the collapsed block
type KeepInTouchToggle = { href: string; label: string };

// The "Пора связаться" block. It also holds the "Отмечено" message: when "Связались" takes
// the last overdue contact away, the heading and rows go, the message stays in their place,
// and "Отменить" brings the block back
export function KeepInTouchBlock({
  rows,
  total,
  toggle,
}: {
  rows: OverdueRow[];
  total: number;
  toggle: KeepInTouchToggle | null;
}) {
  const contacted = useContactedMark();

  if (rows.length === 0 && !contacted.notice && !contacted.error) return null;

  return (
    <section aria-label="Пора связаться" className="flex flex-col gap-3">
      {rows.length > 0 && (
        <div className="flex items-center gap-3.5 sm:gap-5">
          <h2 className="text-xs font-medium tracking-[0.32em] whitespace-nowrap text-muted-foreground uppercase">
            Пора связаться
          </h2>
          <span className="h-px flex-1 bg-border" aria-hidden />
          <span className="text-[0.8125rem] whitespace-nowrap text-muted-foreground">
            {pluralize(total, CONTACT_FORMS)}
          </span>
        </div>
      )}

      {contacted.error && (
        <p role="alert" className="text-sm text-destructive">
          {contacted.error}
        </p>
      )}
      {contacted.notice && (
        <ContactedNotice
          name={contacted.notice.mark.name}
          error={contacted.notice.undoError}
          undoing={contacted.isUndoing}
          onUndo={contacted.undo}
          onClose={contacted.close}
        />
      )}

      {rows.length > 0 && (
        <>
          {/* The 1px gaps between rows show the list background as row lines.
              grid-cols-1 lets a row shrink below its text, so "Кто это" gets cut, not the button */}
          <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-card border bg-row-line">
            {rows.map((row) => {
              const pending = contacted.isMarking(row.id);
              return (
                // On phones the overdue days and "Кто это" go under the name; from md the
                // inner boxes dissolve into one grid row: name, "Кто это", days, button
                <li
                  key={row.id}
                  className="flex items-center gap-3 bg-card py-2.5 pr-3 pl-3.5 md:grid md:grid-cols-[2.25rem_minmax(0,13.75rem)_minmax(0,1fr)_auto_auto] md:gap-x-4 md:pr-4 md:pl-6"
                >
                  <Avatar name={row.name} />
                  <div className="flex min-w-0 flex-1 flex-col md:contents">
                    <Link
                      href={`/contacts/${row.id}`}
                      className="truncate font-heading text-xl leading-tight font-medium text-heading transition-colors duration-400 outline-none hover:text-glow-text focus-visible:underline"
                    >
                      {row.name}
                    </Link>
                    <div className="flex min-w-0 gap-1.5 text-[0.8125rem] leading-snug md:contents md:text-sm">
                      {/* On the narrowest phones the days go onto a second line, not under the button */}
                      <span className="text-rose md:order-1 md:whitespace-nowrap">
                        {formatOverdue(row.overdueDays)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">
                        {row.about}
                      </span>
                    </div>
                  </div>
                  {/* Without the tick on phones: with it the overdue days don't fit */}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => contacted.mark(row.id)}
                    disabled={pending}
                    aria-busy={pending || undefined}
                    aria-label={`Связались — ${row.name}`}
                    className="flex-none px-2.5 text-[0.8125rem] tracking-normal normal-case has-[>svg:first-child]:pl-2.5 md:order-2 md:px-3.5 md:text-[0.84375rem] md:has-[>svg:first-child]:pl-3.5"
                  >
                    <Check aria-hidden className="hidden md:block" />
                    Связались
                  </Button>
                </li>
              );
            })}
          </ul>
          {toggle && (
            <div className="mt-1 flex justify-center">
              <ShowMoreButton href={toggle.href} label={toggle.label} />
            </div>
          )}
        </>
      )}
    </section>
  );
}
