import { Suspense } from "react";
import type { Metadata } from "next";

import { createContact } from "@/app/actions";
import { BackLink } from "@/components/back-link";
import { ContactForm } from "@/components/contact-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listGroups } from "@/lib/groups";
import { requireUserId } from "@/lib/session";

export const metadata: Metadata = {
  title: "Новый контакт",
};

export default function NewContactPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <BackLink href="/">Все контакты</BackLink>
      <Card>
        <CardHeader>
          <CardTitle>
            <h1 className="font-heading text-[2.5rem] leading-none font-medium text-heading">
              Новый контакт
            </h1>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<FormSkeleton />}>
            <NewContactForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}

// The groups to choose from come from the database, so the form waits for them inside Suspense.
// Rendered on every request (the user comes from the request): the build has no database,
// and the groups change at any time
async function NewContactForm() {
  const userId = await requireUserId();
  const groups = await listGroups(userId);

  return (
    <ContactForm
      action={createContact}
      groups={groups}
      submitLabel="Добавить контакт"
      cancelHref="/"
    />
  );
}

function FormSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Загружаем форму">
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          className="h-12 bg-(image:--glow-shimmer) bg-size-[720px_100%] motion-safe:animate-shimmer"
        />
      ))}
    </div>
  );
}
