import Link from "next/link";
import { Plus, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { listGroups } from "@/lib/groups";
import { selectedGroup } from "@/lib/selected-group";

// The row of groups under the heading: "Все", the groups by name, "Настроить группы".
// A group is a link to /?group=<id>; the selected one looks like the pressed frequency button.
// The search text stays, the list length and the "Пора связаться" expansion start over
export async function GroupFilter({
  searchParams,
}: {
  searchParams: PageProps<"/">["searchParams"];
}) {
  const [groups, selected, { q }] = await Promise.all([
    listGroups(),
    selectedGroup(searchParams),
    searchParams,
  ]);
  const query = typeof q === "string" ? q.trim() : "";

  function href(groupId?: number) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (groupId !== undefined) params.set("group", String(groupId));
    const search = params.toString();
    return search ? `/?${search}` : "/";
  }

  if (groups.length === 0) {
    return (
      <div>
        <Button asChild variant="outline">
          <Link href="/groups">
            <Plus aria-hidden />
            Создать группу
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <nav aria-label="Группы" className="flex flex-wrap gap-1.5">
      <GroupLink href={href()} current={selected === null}>
        Все
      </GroupLink>
      {groups.map((group) => (
        <GroupLink key={group.id} href={href(group.id)} current={selected?.id === group.id}>
          {group.name}
        </GroupLink>
      ))}
      <Button asChild variant="ghost">
        <Link href="/groups">
          <Settings aria-hidden />
          Настроить группы
        </Link>
      </Button>
    </nav>
  );
}

function GroupLink({
  href,
  current,
  children,
}: {
  href: string;
  current: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      asChild
      variant={current ? "default" : "outline"}
      // A long name wraps instead of widening the row past the screen
      className="h-auto min-h-11 max-w-full px-4 py-2 text-[0.84375rem] leading-snug tracking-normal [overflow-wrap:anywhere] whitespace-normal normal-case"
    >
      <Link href={href} aria-current={current ? "true" : undefined}>
        {children}
      </Link>
    </Button>
  );
}
