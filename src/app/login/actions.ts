"use server";

import { headers } from "next/headers";

import { requestLoginLink } from "@/lib/login";
import type { LoginFormState } from "@/lib/validation";

// "Получить ссылку". All the rules (the address, the limit of emails, the one live link) are in
// requestLoginLink, so a request that bypasses the form meets the same ones. A failure to send
// the email is not caught: the page shows the general error screen, never "sent"
export async function sendLoginLink(
  _prevState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const value = formData.get("email");
  const email = typeof value === "string" ? value : "";

  const result = await requestLoginLink(email, await headers());
  if ("error" in result) {
    return { email, error: result.error };
  }

  return { sentTo: result.email };
}
