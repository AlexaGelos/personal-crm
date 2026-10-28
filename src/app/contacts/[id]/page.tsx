import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";

import { addNote, deleteContact, setContactFrequency } from "@/app/actions";
import { Avatar } from "@/components/avatar";
import { BackLink } from "@/components/back-link";
import { DeleteContactButton } from "@/components/delete-contact-button";
import { FrequencySwitch } from "@/components/frequency-switch";
import { MarkContacted } from "@/components/mark-contacted";
import { NoteForm } from "@/components/note-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getContact, listNotes } from "@/lib/data";
import { listContactGroups } from "@/lib/groups";
import { formatDate, formatDateTime, formatDay, formatOverdue, pluralize } from "@/lib/format";
import { parseContactId } from "@/lib/validation";

export const metadata: Metadata = {
  title: "Карточка контакта",
};

export default function ContactPage({ params }: PageProps<"/contacts/[id]">) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <BackLink href="/">Все контакты</BackLink>
      <Suspense fallback={<ContactSkeleton />}>
        <ContactDetails params={params} />
      </Suspense>
    </div>
  );
}

async function ContactDetails({
  params,
}: {
  params: PageProps<"/contacts/[id]">["params"];
}) {
  const id = parseContactId((await params).id);
  if (id === null) notFound();

  const [contact, notes, groups] = await Promise.all([
    getContact(id),
    listNotes(id),
    listContactGroups(id),
  ]);
  if (!contact) notFound();

  return (
    <>
      <Card>
        {/* On narrow screens the buttons wrap below the name instead of squeezing it */}
        <CardHeader className="flex flex-wrap items-start justify-between gap-4 border-b">
          <div className="flex min-w-0 flex-1 basis-64 items-center gap-5">
            <Avatar name={contact.name} size="lg" />
            <div className="flex min-w-0 flex-col gap-1.5">
              <CardTitle>
                <h1 className="font-heading text-[2.25rem] leading-none font-medium break-words text-heading sm:text-[2.625rem]">
                  {contact.name}
                </h1>
              </CardTitle>
              {contact.about && (
                <CardDescription className="text-[0.9375rem]">{contact.about}</CardDescription>
              )}
            </div>
          </div>
          <div className="flex flex-none gap-2">
            <Button asChild variant="outline">
              <Link href={`/contacts/${contact.id}/edit`}>
                <Pencil aria-hidden />
                Изменить
              </Link>
            </Button>
            <DeleteContactButton
              contactName={contact.name}
              action={deleteContact.bind(null, contact.id)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-4.5 text-[0.9375rem] leading-relaxed sm:grid-cols-[10.5rem_1fr]">
            <Detail label="Откуда знакомы">
              {contact.howWeMet && (
                <span className="whitespace-pre-wrap">{contact.howWeMet}</span>
              )}
            </Detail>
            <Detail label="Телефон">
              {contact.phone && (
                <a
                  href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}
                  className="text-rose tabular-nums underline-offset-4 hover:underline"
                >
                  {contact.phone}
                </a>
              )}
            </Detail>
            <Detail label="Почта">
              {contact.email && (
                <a
                  href={`mailto:${contact.email}`}
                  className="break-all text-rose underline-offset-4 hover:underline"
                >
                  {contact.email}
                </a>
              )}
            </Detail>
            <Detail label="Группы">
              {groups.length > 0 && (
                <span className="break-words">
                  {groups.map((group, index) => (
                    <span key={group.id}>
                      {index > 0 && ", "}
                      <Link
                        href={`/?group=${group.id}`}
                        className="text-rose underline-offset-4 hover:underline"
                      >
                        {group.name}
                      </Link>
                    </span>
                  ))}
                </span>
              )}
            </Detail>
            <Detail label="В списке с">{formatDate(contact.createdAt)}</Detail>
          </dl>
        </CardContent>
        {/* Keeping in touch: a strip of its own under the details - five buttons
            don't fit the narrow column next to a label */}
        <section
          aria-labelledby="keep-in-touch-heading"
          className="mx-(--card-spacing) -mt-1 flex flex-col gap-3.5 border-t border-dashed border-avatar-line pt-5.5"
        >
          <h2
            id="keep-in-touch-heading"
            className="text-[0.6875rem] font-medium tracking-[0.2em] text-subtle-foreground uppercase"
          >
            Как часто общаться
          </h2>
          <FrequencySwitch
            value={contact.contactFrequency ?? "none"}
            action={setContactFrequency.bind(null, contact.id)}
            labelledBy="keep-in-touch-heading"
          />
          <DueLine dueDate={contact.dueDate} overdueDays={contact.overdueDays} />
          <MarkContacted
            contactId={contact.id}
            lastContacted={contact.lastContactedAt && formatDate(contact.lastContactedAt)}
          />
        </section>
      </Card>

      <section className="mt-3 flex flex-col gap-4" aria-labelledby="notes-heading">
        <div className="flex items-center gap-5">
          <h2
            id="notes-heading"
            className="text-xs font-medium tracking-[0.32em] text-muted-foreground uppercase"
          >
            Заметки
          </h2>
          <span className="h-px flex-1 bg-border" aria-hidden />
          <span className="text-[0.8125rem] text-muted-foreground">
            {notes.length > 0 ? pluralize(notes.length, ["заметка", "заметки", "заметок"]) : ""}
          </span>
        </div>

        <NoteForm action={addNote.bind(null, contact.id)} />

        {notes.length === 0 ? (
          <p className="rounded-inner border border-dashed border-avatar-line bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            Заметок пока нет. Запишите, о чём поговорили и о чём договорились.
          </p>
        ) : (
          <ol className="flex flex-col gap-2.5">
            {notes.map((note) => (
              <li key={note.id} className="rounded-inner border bg-card px-5.5 py-4.5">
                <time
                  dateTime={note.createdAt.toISOString()}
                  className="font-heading text-lg text-muted-foreground italic"
                >
                  {formatDateTime(note.createdAt)}
                </time>
                <p className="mt-1.5 text-[0.9375rem] leading-relaxed whitespace-pre-wrap">{note.body}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="contents">
      <dt className="pt-0.5 text-[0.6875rem] font-medium tracking-[0.2em] text-subtle-foreground uppercase">
        {label}
      </dt>
      <dd className="-mt-3 sm:mt-0">
        {children || <span className="text-muted-foreground">—</span>}
      </dd>
    </div>
  );
}

// When to get in touch next; nothing without a frequency
function DueLine({
  dueDate,
  overdueDays,
}: {
  dueDate: string | null;
  overdueDays: number | null;
}) {
  if (dueDate === null || overdueDays === null) return null;

  if (overdueDays > 0) {
    return (
      <p className="flex items-start gap-2 text-[0.9375rem] text-rose">
        <FlameIcon />
        Пора связаться — {formatOverdue(overdueDays)}
      </p>
    );
  }

  return (
    <p className="text-[0.9375rem] text-muted-foreground">
      Следующий раз — до <span className="text-foreground">{formatDay(dueDate)}</span>
    </p>
  );
}

// A small candle flame next to "Пора связаться"
function FlameIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinejoin="round"
      className="mt-0.75 size-4 flex-none"
    >
      <path d="M12 3c2.5 3.2 5 5.8 5 9.5a5 5 0 0 1-10 0C7 8.8 9.5 6.2 12 3Z" />
      <path d="M12 12c1 1.2 1.8 2 1.8 3.2a1.8 1.8 0 0 1-3.6 0c0-1.2.8-2 1.8-3.2Z" />
    </svg>
  );
}

function ContactSkeleton() {
  const shimmer = "bg-(image:--glow-shimmer) bg-size-[720px_100%] motion-safe:animate-shimmer";

  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Загружаем контакт">
      <div className="flex flex-col gap-4 rounded-card border bg-card p-5 sm:p-7">
        <div className="flex items-center gap-4">
          <div className={`size-16 flex-none rounded-full ${shimmer}`} />
          <div className="flex flex-1 flex-col gap-2">
            <div className={`h-7 w-full max-w-64 ${shimmer}`} />
            <div className={`h-4 w-full max-w-48 ${shimmer}`} />
          </div>
        </div>
        <div className={`h-24 ${shimmer}`} />
      </div>
      <div className={`h-24 ${shimmer}`} />
    </div>
  );
}
