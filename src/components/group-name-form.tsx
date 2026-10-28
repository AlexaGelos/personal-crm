"use client";

import { useActionState, useId, useLayoutEffect, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { GroupFormState } from "@/lib/validation";

type GroupNameFormProps = {
  action: (state: GroupFormState, formData: FormData) => Promise<GroupFormState>;
  label: string;
  submitLabel: string;
  // The name the field starts with: empty for a new group, the current name for a rename
  defaultName?: string;
  // "Отмена" - only where the form can be closed (renaming)
  cancelHref?: string;
  autoFocus?: boolean;
};

// "Новая группа" and the rename of a group share this form: name field plus buttons.
// A plain form, so it works before JavaScript loads, like the other forms
export function GroupNameForm(props: GroupNameFormProps) {
  // Pages stay mounted (hidden) after navigation; start with a fresh form on every visit
  const [formKey, setFormKey] = useState(0);
  useLayoutEffect(() => () => setFormKey((key) => key + 1), []);

  return <GroupNameFormFields key={formKey} {...props} />;
}

function GroupNameFormFields({
  action,
  label,
  submitLabel,
  defaultName = "",
  cancelHref,
  autoFocus,
}: GroupNameFormProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const [state, formAction, pending] = useActionState(action, {});
  // After a failed submit React resets the form, so the typed text comes back via defaultValue.
  // After a successful one the state is empty and the field starts over with defaultName
  const name = state.name ?? defaultName;

  return (
    <form action={formAction} className="flex flex-col gap-2.5" noValidate>
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>
      {/* Phones: the buttons go under the field, side by side they do not fit */}
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <Input
          id={id}
          name="name"
          defaultValue={name}
          placeholder={label}
          autoComplete="off"
          autoFocus={autoFocus}
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? errorId : undefined}
          className="sm:flex-1"
        />
        <div className="flex gap-2.5">
          <Button type="submit" disabled={pending} className="flex-1 sm:flex-none">
            {pending ? "Сохраняем…" : submitLabel}
          </Button>
          {cancelHref && (
            <Button asChild variant="outline" className="flex-1 sm:flex-none">
              <Link href={cancelHref}>Отмена</Link>
            </Button>
          )}
        </div>
      </div>
      {state.error && (
        <p id={errorId} role="alert" className="text-[0.8125rem] text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
