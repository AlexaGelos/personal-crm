// Reads the emails the tests sent from Mailpit (the stand-in for the mail service) over its
// HTTP API. Shared by Vitest and Playwright. Vitest and Playwright may run at the same time on
// the same Mailpit, so nothing here empties the whole mailbox: every test uses addresses of its
// own (uniqueAddress()) and deletes only the emails to them

const API = "http://127.0.0.1:8025/api/v1";

export type MailpitMessage = {
  id: string;
  from: { name: string; address: string };
  to: string[];
  subject: string;
  html: string;
  text: string;
};

// A made-up address nobody else uses, so one test never sees the emails of another
export function uniqueAddress(prefix = "user") {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}@example.com`;
}

async function call(path: string, init?: RequestInit) {
  const response = await fetch(`${API}${path}`, init);
  if (!response.ok) {
    throw new Error(
      `Mailpit answered ${response.status} for ${path}: is it running? (docker compose up -d)`,
    );
  }
  return response;
}

type Summary = { ID: string };

// The emails to an address, the oldest first. Mailpit lists the newest first, in the order they
// arrived: the Date header of an email has seconds only and says nothing about the order within one
export async function messagesTo(address: string): Promise<MailpitMessage[]> {
  const query = encodeURIComponent(`to:"${address}"`);
  const { messages } = (await (await call(`/search?query=${query}&limit=200`)).json()) as {
    messages: Summary[];
  };

  return Promise.all(
    [...messages].reverse().map(async ({ ID }) => {
      const raw = (await (await call(`/message/${ID}`)).json()) as {
        From: { Name: string; Address: string };
        To: { Address: string }[];
        Subject: string;
        HTML: string;
        Text: string;
      };
      return {
        id: ID,
        from: { name: raw.From.Name, address: raw.From.Address },
        to: raw.To.map((recipient) => recipient.Address),
        subject: raw.Subject,
        html: raw.HTML,
        text: raw.Text,
      };
    }),
  );
}

// Waits until at least `count` emails to the address have arrived
export async function waitForMessages(address: string, count = 1, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const messages = await messagesTo(address);
    if (messages.length >= count) return messages;
    if (Date.now() > deadline) {
      throw new Error(
        `Waited ${timeoutMs} ms for ${count} email(s) to ${address}, got ${messages.length}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

export async function deleteMessagesTo(address: string) {
  const query = encodeURIComponent(`to:"${address}"`);
  await call(`/search?query=${query}`, { method: "DELETE" });
}

// The login link from the newest email to the address
export async function latestLoginLink(address: string) {
  const messages = await waitForMessages(address);
  const text = messages[messages.length - 1].text;
  const link = text.match(/https?:\/\/\S+/)?.[0];
  if (!link) throw new Error(`No link in the email to ${address}:\n${text}`);
  return link;
}
