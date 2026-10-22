"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { NoteFormState } from "@/lib/validation";

export function NoteForm({
  action,
}: {
  action: (state: NoteFormState, formData: FormData) => Promise<NoteFormState>;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-2.5">
      <Label htmlFor="note-body" className="sr-only">
        Новая заметка
      </Label>
      <Textarea
        id="note-body"
        name="body"
        rows={3}
        // After a failed submit React resets the form, so the text comes back via defaultValue
        defaultValue={state.body}
        placeholder="О чём поговорили, о чём договорились…"
        aria-invalid={state.error ? true : undefined}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
            event.preventDefault();
            // requestSubmit() ignores the disabled button: skip while the note is saving,
            // otherwise a second press queues the same note again
            if (pending) return;
            event.currentTarget.form?.requestSubmit();
          }
        }}
      />
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <span className="hidden text-xs text-subtle-foreground sm:inline">
          Ctrl + Enter — сохранить
        </span>
        <Button type="submit" disabled={pending}>
          {pending ? "Сохраняем…" : "Добавить заметку"}
        </Button>
      </div>
    </form>
  );
}
