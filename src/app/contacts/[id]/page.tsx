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
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
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
        <CardHeader className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 basis-64 items-center gap-4">
            <Avatar name={contact.name} size="lg" />
            <div className="flex min-w-0 flex-col gap-1">
              <CardTitle>
                <h1 className="text-2xl font-semibold tracking-tight break-words">
                  {contact.name}
                </h1>
              </CardTitle>
              {contact.about && (
                <CardDescription className="text-base">{contact.about}</CardDescription>
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
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-[10rem_1fr]">
            <Detail label="Откуда знакомы">
              {contact.howWeMet && (
                <span className="whitespace-pre-wrap">{contact.howWeMet}</span>
              )}
            </Detail>
            <Detail label="Телефон">
              {contact.phone && (
                <a
                  href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}
                  className="text-primary-soft tabular-nums underline-offset-4 hover:underline"
                >
                  {contact.phone}
                </a>
              )}
            </Detail>
            <Detail label="Почта">
              {contact.email && (
                <a
                  href={`mailto:${contact.email}`}
                  className="break-all text-primary-soft underline-offset-4 hover:underline"
                >
                  {contact.email}
                </a>
              )}
            </Detail>
            <Detail label="В списке с">{formatDate(contact.createdAt)}</Detail>
          </dl>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-4" aria-labelledby="notes-heading">
        <div className="flex items-center justify-between gap-3">
          {/* Pill heading with an accent dot, like the landing's section headings */}
          <h2
            id="notes-heading"
            className="flex h-8.5 items-center gap-2 rounded-full border border-primary-line-strong bg-primary-tint px-3.5 text-sm font-medium text-primary-soft"
          >
            <span className="size-1.5 rounded-full bg-primary" aria-hidden />
            Заметки
          </h2>
          <span className="text-sm text-muted-foreground">
            {notes.length > 0 ? pluralize(notes.length, ["заметка", "заметки", "заметок"]) : ""}
          </span>
        </div>

        <NoteForm action={addNote.bind(null, contact.id)} />

        {notes.length === 0 ? (
          <p className="rounded-inner border border-dashed border-input bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            Заметок пока нет. Запишите, о чём поговорили и о чём договорились.
          </p>
        ) : (
          <ol className="flex flex-col gap-3">
            {notes.map((note) => (
              <li key={note.id} className="rounded-inner border bg-card px-5 py-4">
                <time
                  dateTime={note.createdAt.toISOString()}
                  className="text-xs text-muted-foreground"
                >
                  {formatDateTime(note.createdAt)}
                </time>
                <p className="mt-1.5 text-sm whitespace-pre-wrap">{note.body}</p>
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
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="-mt-3 text-sm sm:mt-0">
        {children || <span className="text-muted-foreground">—</span>}
      </dd>
    </div>
  );
}

function ContactSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Загружаем контакт">
      <div className="flex flex-col gap-4 rounded-card border bg-card p-5 sm:p-7">
        <div className="flex items-center gap-4">
          <div className="size-13 flex-none animate-pulse rounded-full bg-primary-tint-strong" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-7 w-full max-w-64 animate-pulse rounded-full bg-muted" />
            <div className="h-4 w-full max-w-48 animate-pulse rounded-full bg-muted" />
          </div>
        </div>
        <div className="h-24 animate-pulse rounded-chip bg-muted" />
      </div>
      <div className="h-24 animate-pulse rounded-inner bg-muted" />
    </div>
  );
}
