import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Pencil } from "lucide-react";

import { createGroup, deleteGroup, renameGroup } from "@/app/actions";
import { BackLink } from "@/components/back-link";
import { DeleteGroupButton } from "@/components/delete-group-button";
import { EmptyState } from "@/components/empty-state";
import { GroupNameForm } from "@/components/group-name-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CONTACT_FORMS, pluralize } from "@/lib/format";
import { listGroups } from "@/lib/groups";
import { parseGroupId } from "@/lib/validation";

export const metadata: Metadata = {
  title: "Группы",
};

// "Переименовать" and "Удалить" on a phone: a finger-sized square with only the icon; the words
// stay for screen readers. The padding of a button with an icon is beaten by "!"
const ICON_ON_PHONE = "max-sm:size-11 max-sm:gap-0 max-sm:p-0!";

export default function GroupsPage({ searchParams }: PageProps<"/groups">) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <BackLink href="/">Все контакты</BackLink>
      <Card>
        <CardHeader>
          <CardTitle>
            <h1 className="font-heading text-[2.5rem] leading-none font-medium text-heading">
              Группы
            </h1>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <GroupNameForm action={createGroup} label="Новая группа" submitLabel="Создать" />
          <Suspense fallback={<GroupListSkeleton />}>
            <GroupList searchParams={searchParams} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}

async function GroupList({ searchParams }: { searchParams: PageProps<"/groups">["searchParams"] }) {
  // searchParams first: the list renders per request, and the build never reads the database
  const { edit } = await searchParams;
  const groups = await listGroups();
  // ?edit=<id>: this group's row is a rename form instead of a name
  const editingId = parseGroupId(edit);

  if (groups.length === 0) {
    return (
      <EmptyState
        candle="unlit"
        title="Групп пока нет"
        hint="Впишите название в поле выше, например «Семья» или «Теннис», и нажмите «Создать»."
      />
    );
  }

  return (
    // The 1px gaps between rows show the list background as row lines
    <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-card border bg-row-line">
      {groups.map((group) => (
        // Below 360px less padding, tighter gaps and a smaller name: the longest word
        // («Флорентийцы») fits next to the buttons, with room for fonts drawn a bit wider elsewhere
        <li key={group.id} className="bg-card px-4 py-3.5 max-[22.5rem]:px-3 sm:px-5">
          {group.id === editingId ? (
            <GroupNameForm
              action={renameGroup.bind(null, group.id)}
              label="Название группы"
              submitLabel="Сохранить"
              defaultName={group.name}
              cancelHref="/groups"
              autoFocus
            />
          ) : (
            // One line on any screen: on a phone the buttons are bare icons, so the list stays short
            <div className="flex items-center justify-between gap-3 max-[22.5rem]:gap-2 sm:gap-4">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <Link
                  href={`/?group=${group.id}`}
                  className="font-heading text-xl leading-tight font-medium break-words max-[22.5rem]:text-base text-heading transition-colors duration-400 outline-none hover:text-glow-text focus-visible:underline"
                >
                  {group.name}
                </Link>
                <span className="text-[0.8125rem] text-muted-foreground">
                  {pluralize(group.contactCount, CONTACT_FORMS)}
                </span>
              </div>
              <div className="flex flex-none gap-1.5 max-[22.5rem]:gap-1 sm:gap-2">
                <Button asChild variant="outline" className={ICON_ON_PHONE}>
                  <Link href={`/groups?edit=${group.id}`}>
                    <Pencil aria-hidden />
                    <span className="max-sm:sr-only">Переименовать</span>
                    <span className="sr-only"> группу «{group.name}»</span>
                  </Link>
                </Button>
                <DeleteGroupButton
                  className={ICON_ON_PHONE}
                  groupName={group.name}
                  action={deleteGroup.bind(null, group.id)}
                />
              </div>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function GroupListSkeleton() {
  return (
    <div
      className="flex flex-col gap-4 rounded-card border bg-card px-5 py-5"
      aria-busy="true"
      aria-label="Загружаем группы"
    >
      {Array.from({ length: 3 }, (_, i) => (
        <div
          key={i}
          className="h-2.5 w-2/5 bg-(image:--glow-shimmer) bg-size-[720px_100%] motion-safe:animate-shimmer"
        />
      ))}
    </div>
  );
}
