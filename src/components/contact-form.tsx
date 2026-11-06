"use client";

import { useActionState, useId, useLayoutEffect, useState } from "react";
import Link from "next/link";

import { GroupPicker, type GroupOption } from "@/components/group-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  emptyContactFields,
  type ContactFields,
  type ContactFormState,
  type ContactFormValues,
} from "@/lib/validation";

type ContactFormProps = {
  action: (state: ContactFormState, formData: FormData) => Promise<ContactFormState>;
  defaults?: ContactFormValues;
  // All groups to choose from
  groups: GroupOption[];
  submitLabel: string;
  cancelHref: string;
};

export function ContactForm(props: ContactFormProps) {
  // Pages stay mounted (hidden) after navigation; start with a fresh form on every visit
  const [formKey, setFormKey] = useState(0);
  useLayoutEffect(() => () => setFormKey((key) => key + 1), []);

  return <ContactFormFields key={formKey} {...props} />;
}

function ContactFormFields({
  action,
  defaults = emptyContactFields,
  groups,
  submitLabel,
  cancelHref,
}: ContactFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  // After a failed submit React resets the form, so the typed values come back via defaultValue
  const values = state.values ?? defaults;
  const errors = state.errors ?? {};

  // The group picker keeps its own state, which the reset above cannot restore: it is rebuilt from
  // the values on every answer of the server. It is also rebuilt when the groups in `defaults`
  // change: the form is remounted when its page is hidden, with the groups from before the save,
  // and the saved ones arrive with the next visit
  const [seenState, setSeenState] = useState(state);
  const [answerCount, setAnswerCount] = useState(0);
  if (seenState !== state) {
    setSeenState(state);
    setAnswerCount((count) => count + 1);
  }
  const pickerKey = `${answerCount}:${values.groupIds.join(",")}:${JSON.stringify(values.newGroupNames)}`;

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {state.message && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}

      <Field
        label="Имя"
        name="name"
        required
        autoFocus
        defaultValue={values.name}
        error={errors.name?.[0]}
        placeholder="Например, Анна Смирнова"
      />
      <Field
        label="Кто это"
        name="about"
        defaultValue={values.about}
        error={errors.about?.[0]}
        placeholder="Чем занимается, кем приходится"
      />
      <Field
        label="Откуда знакомы"
        name="howWeMet"
        multiline
        defaultValue={values.howWeMet}
        error={errors.howWeMet?.[0]}
        placeholder="Где и как познакомились"
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Телефон"
          name="phone"
          type="tel"
          defaultValue={values.phone}
          error={errors.phone?.[0]}
          placeholder="+7 900 123-45-67"
        />
        <Field
          label="Почта"
          name="email"
          type="email"
          defaultValue={values.email}
          error={errors.email?.[0]}
          placeholder="name@example.com"
        />
      </div>

      <GroupPicker
        key={pickerKey}
        groups={groups}
        initialIds={values.groupIds}
        initialNewNames={values.newGroupNames}
        serverError={errors.newGroupNames?.[0]}
      />

      {/* Phones: buttons stacked full width - side by side they do not fit */}
      <div className="mt-1 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Сохраняем…" : submitLabel}
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href={cancelHref}>Отмена</Link>
        </Button>
      </div>
    </form>
  );
}

type FieldProps = {
  label: string;
  name: keyof ContactFields;
  defaultValue: string;
  error?: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  autoFocus?: boolean;
  multiline?: boolean;
};

function Field({ label, name, error, multiline, required, ...inputProps }: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const shared = {
    id,
    name,
    required,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? errorId : undefined,
  };

  return (
    <div className="flex flex-col gap-2.5">
      <Label htmlFor={id}>
        {label}
        {required && (
          <span className="font-normal tracking-normal text-subtle-foreground normal-case">
            (обязательно)
          </span>
        )}
      </Label>
      {multiline ? (
        <Textarea
          {...shared}
          defaultValue={inputProps.defaultValue}
          placeholder={inputProps.placeholder}
          rows={3}
        />
      ) : (
        <Input {...shared} {...inputProps} />
      )}
      {error && (
        <p id={errorId} className="text-[0.8125rem] text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
