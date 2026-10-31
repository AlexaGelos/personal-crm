import Link from "next/link";
import { Plus, Settings } from "lucide-react";

import { GroupRow } from "@/components/group-row";
import { Button } from "@/components/ui/button";
import { listGroups } from "@/lib/groups";
import { selectedGroup } from "@/lib/selected-group";

// The row of groups under the heading: "Все", the groups by name, "Настроить группы".
// The links are made here, on the server; GroupRow decides how many are in sight.
// A group is a link to /?group=<id>; the selected one looks like the pressed frequency button.
// The search text stays, the list length and the "Пора связаться" expansion start over
export async function GroupFilter({
  searchParams,
}: {
  searchParams: PageProps<"/">["searchParams"];
}) {
  // searchParams first: the filter renders per request, and the build never reads the database
  const { q } = await searchParams;
  const [groups, selected] = await Promise.all([listGroups(), selectedGroup(searchParams)]);
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

  // Two lines at most, the rest behind «Ещё N»: GroupRow measures what fits
  return (
    <GroupRow
      items={[
        <GroupLink key="all" href={href()} current={selected === null}>
          Все
        </GroupLink>,
        ...groups.map((group) => (
          <GroupLink key={group.id} href={href(group.id)} current={selected?.id === group.id}>
            {group.name}
          </GroupLink>
        )),
      ]}
      selected={selected === null ? 0 : groups.findIndex((group) => group.id === selected.id) + 1}
      settings={
        <Button asChild variant="ghost">
          <Link href="/groups">
            <Settings aria-hidden />
            Настроить группы
          </Link>
        </Button>
      }
    />
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
