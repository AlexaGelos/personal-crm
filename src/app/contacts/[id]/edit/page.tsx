import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { updateContact } from "@/app/actions";
import { BackLink } from "@/components/back-link";
import { ContactForm } from "@/components/contact-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getContact } from "@/lib/data";
import { listContactGroups, listGroups } from "@/lib/groups";
import { parseContactId } from "@/lib/validation";

export const metadata: Metadata = {
  title: "Изменить контакт",
};

export default function EditContactPage({ params }: PageProps<"/contacts/[id]/edit">) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <Suspense fallback={<EditSkeleton />}>
        <EditContact params={params} />
      </Suspense>
    </div>
  );
}

async function EditContact({ params }: { params: PageProps<"/contacts/[id]/edit">["params"] }) {
  const id = parseContactId((await params).id);
  if (id === null) notFound();

  const [contact, groups, contactGroups] = await Promise.all([
    getContact(id),
    listGroups(),
    listContactGroups(id),
  ]);
  if (!contact) notFound();

  const cardHref = `/contacts/${contact.id}`;

  return (
    <>
      <BackLink href={cardHref}>К карточке</BackLink>
      <Card>
        <CardHeader>
          <CardTitle>
            <h1 className="font-heading text-[2.5rem] leading-none font-medium text-heading">
              Изменить контакт
            </h1>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ContactForm
            action={updateContact.bind(null, contact.id)}
            defaults={{
              name: contact.name,
              about: contact.about ?? "",
              howWeMet: contact.howWeMet ?? "",
              phone: contact.phone ?? "",
              email: contact.email ?? "",
              groupIds: contactGroups.map((group) => group.id),
              newGroupNames: [],
            }}
            groups={groups}
            submitLabel="Сохранить"
            cancelHref={cardHref}
          />
        </CardContent>
      </Card>
    </>
  );
}

function EditSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-card border bg-card p-5 sm:p-7" aria-busy="true">
      <div className="h-8 w-56 bg-(image:--glow-shimmer) bg-size-[720px_100%] motion-safe:animate-shimmer" />
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          className="h-12 bg-(image:--glow-shimmer) bg-size-[720px_100%] motion-safe:animate-shimmer"
        />
      ))}
    </div>
  );
}
