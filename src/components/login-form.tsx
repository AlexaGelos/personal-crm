"use client";

import { useActionState, useId } from "react";

import { sendLoginLink } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// The address field and «Получить ссылку». A plain form, so it works before JavaScript loads,
// like the other forms. noValidate: the server checks the address, and one text of the error is
// shown, not the browser's own. After «sent» the field and the button stay: to ask for a new link
export function LoginForm() {
  const id = useId();
  const messageId = `${id}-message`;
  const [state, formAction, pending] = useActionState(sendLoginLink, {});
  // After an action React resets the form, so what was typed comes back via defaultValue
  const email = state.email ?? state.sentTo ?? "";

  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate>
      <Label htmlFor={id}>Почта</Label>
      <Input
        id={id}
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        defaultValue={email}
        aria-invalid={state.error ? true : undefined}
        aria-describedby={state.error || state.sentTo ? messageId : undefined}
      />
      {state.error && (
        <p id={messageId} role="alert" className="text-[0.8125rem] text-destructive">
          {state.error}
        </p>
      )}
      {state.sentTo && (
        <p
          id={messageId}
          role="status"
          className="text-[0.9375rem] break-words text-soft-foreground"
        >
          Ссылка для входа отправлена на {state.sentTo}
        </p>
      )}
      <Button type="submit" disabled={pending} size="lg" className="mt-1 w-full">
        {pending ? "Отправляем…" : "Получить ссылку"}
      </Button>
    </form>
  );
}
