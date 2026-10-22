import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";

import { addNote, deleteContact } from "@/app/actions";
import { Avatar } from "@/components/avatar";
import { BackLink } from "@/components/back-link";
import { DeleteContactButton } from "@/components/delete-contact-button";
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
import { formatDate, formatDateTime, pluralize } from "@/lib/format";
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

  const [contact, notes] = await Promise.all([getContact(id), listNotes(id)]);
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
            <Detail label="В списке с">{formatDate(contact.createdAt)}</Detail>
          </dl>
        </CardContent>
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
