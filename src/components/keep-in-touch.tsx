import { KeepInTouchBlock } from "@/components/keep-in-touch-block";
import { listOverdueContacts } from "@/lib/data";

// Overdue contacts the collapsed block shows
const COLLAPSED_SIZE = 5;

// "Пора связаться" above the search: contacts whose due date has passed, the most overdue
// first. Not shown while searching. ?due=all expands the block to every overdue contact
export async function KeepInTouch({
  searchParams,
}: {
  searchParams: PageProps<"/">["searchParams"];
}) {
  const { q, due, limit } = await searchParams;
  if (typeof q === "string" && q.trim()) return null;

  const expanded = due === "all";
  const overdue = await listOverdueContacts(expanded ? undefined : COLLAPSED_SIZE);
  const total = overdue[0]?.total ?? 0;

  // The block is passed on even when nobody is overdue: it may be showing "Отмечено"
  return (
    <KeepInTouchBlock
      rows={overdue.map(({ id, name, about, overdueDays }) => ({ id, name, about, overdueDays }))}
      total={total}
      toggle={
        total > COLLAPSED_SIZE
          ? {
              href: toggleHref(limit, !expanded),
              label: expanded ? "Свернуть" : "Показать всех",
            }
          : null
      }
    />
  );
}

// The same list length (?limit=), with or without ?due=all
function toggleHref(limit: string | string[] | undefined, expand: boolean) {
  const params = new URLSearchParams();
  if (expand) params.set("due", "all");
  if (typeof limit === "string") params.set("limit", limit);
  const search = params.toString();
  return search ? `/?${search}` : "/";
}
