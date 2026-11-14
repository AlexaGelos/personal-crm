import Link from "next/link";

import { Avatar } from "@/components/avatar";
import { listUpcomingBirthdays } from "@/lib/data";
import { formatBirthDate, formatBirthdayIn, formatTurns } from "@/lib/format";
import { selectedGroup } from "@/lib/selected-group";
import { requireUserId } from "@/lib/session";

// "Скоро день рождения" under "Пора связаться": contacts whose birthday is today or in the next
// 7 days, the nearest first. Not shown while searching, and not shown at all when there is
// nobody. With a group chosen (?group=) only the contacts of that group. Every row is shown:
// the window is short, so there is no "Показать всех". No state and no buttons: a plain list
export async function UpcomingBirthdays({
  searchParams,
}: {
  searchParams: PageProps<"/">["searchParams"];
}) {
  const userId = await requireUserId();
  const { q } = await searchParams;
  if (typeof q === "string" && q.trim()) return null;

  const group = await selectedGroup(userId, searchParams);
  const rows = await listUpcomingBirthdays(userId, group?.id);
  if (rows.length === 0) return null;

  return (
    <section aria-label="Скоро день рождения" className="flex flex-col gap-3">
      <div className="flex items-center gap-3.5 sm:gap-5">
        <h2 className="text-xs font-medium tracking-[0.32em] whitespace-nowrap text-muted-foreground uppercase">
          Скоро день рождения
        </h2>
        <span className="h-px flex-1 bg-border" aria-hidden />
      </div>

      {/* The 1px gaps between rows show the list background as row lines, as in "Пора связаться".
          grid-cols-1 lets a row shrink below its text, so "Кто это" gets cut, not the date */}
      <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-card border bg-row-line">
        {rows.map((row) => (
          // On phones the date goes under the name and "Кто это"; from md the inner boxes dissolve
          // into one grid row: name, "Кто это", when
          <li
            key={row.id}
            className="flex items-center gap-3 bg-card py-2.5 pr-3 pl-3.5 md:grid md:grid-cols-[2.25rem_minmax(0,13.75rem)_minmax(0,1fr)_auto] md:gap-x-4 md:pr-4 md:pl-6"
          >
            <Avatar name={row.name} />
            <div className="flex min-w-0 flex-1 flex-col md:contents">
              <Link
                href={`/contacts/${row.id}`}
                className="truncate font-heading text-xl leading-tight font-medium text-heading transition-colors duration-400 outline-none hover:text-glow-text focus-visible:underline"
              >
                {row.name}
              </Link>
              <span className="min-w-0 truncate text-[0.8125rem] leading-snug text-muted-foreground md:text-sm">
                {row.about}
              </span>
              {/* On phones a long line wraps instead of running under the screen edge */}
              <p className="text-[0.8125rem] leading-snug md:text-sm md:whitespace-nowrap">
                <span className={row.daysUntil === 0 ? "font-medium text-rose" : "text-rose"}>
                  {formatBirthdayIn(row.daysUntil)}
                </span>
                <span className="text-muted-foreground">
                  {" · "}
                  {formatBirthDate(row.birthDay!, row.birthMonth!, null)}
                  {row.age !== null && (
                    <>
                      {" · "}
                      <span className="whitespace-nowrap">{formatTurns(row.age)}</span>
                    </>
                  )}
                </span>
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
