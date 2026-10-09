import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";

import { addNote, deleteContact } from "@/app/actions";
import { BackLink } from "@/components/back-link";
import { DeleteContactButton } from "@/components/delete-contact-button";
import { NoteForm } from "@/components/note-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
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
        <CardHeader>
          <CardTitle>
            <h1 className="text-2xl font-semibold tracking-tight">{contact.name}</h1>
          </CardTitle>
          {contact.about && (
            <CardDescription className="text-base">{contact.about}</CardDescription>
          )}
          <CardAction className="flex gap-2">
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
          </CardAction>
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
                  className="tabular-nums underline-offset-4 hover:underline"
                >
                  {contact.phone}
                </a>
              )}
            </Detail>
            <Detail label="Почта">
              {contact.email && (
                <a
                  href={`mailto:${contact.email}`}
                  className="break-all underline-offset-4 hover:underline"
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
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="notes-heading" className="text-lg font-semibold">
            Заметки
          </h2>
          <span className="text-sm text-muted-foreground">
            {notes.length > 0 ? pluralize(notes.length, ["заметка", "заметки", "заметок"]) : ""}
          </span>
        </div>

        <NoteForm action={addNote.bind(null, contact.id)} />

        {notes.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-background px-4 py-8 text-center text-sm text-muted-foreground">
            Заметок пока нет. Запишите, о чём поговорили и о чём договорились.
          </p>
        ) : (
          <ol className="flex flex-col gap-3">
            {notes.map((note) => (
              <li key={note.id} className="rounded-xl border bg-background p-4">
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
      <div className="flex flex-col gap-4 rounded-xl border bg-background p-4">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="h-5 w-48 animate-pulse rounded bg-muted" />
        <div className="h-24 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-24 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
