import "server-only";

import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

// Where the emails go is decided by the settings, not by the code: the same build sends to the
// Mailpit stand-in on the computer and in the tests and to Resend on the server. Resend speaks
// plain SMTP, so one library serves both. The settings are read when an email is sent, not when
// the module loads: "next build" runs without them

// The sender name; the address comes from EMAIL_FROM
const SENDER_NAME = "Личная CRM";
const SUBJECT = "Вход в Личную CRM";
// Must match the lifetime of the link set in src/lib/auth.ts
export const LOGIN_LINK_MINUTES = 15;

// Short timeouts: the login form waits for the email, and a mail service that does not answer
// must not keep it hanging for minutes
const CONNECTION_TIMEOUT_MS = 5_000;
const GREETING_TIMEOUT_MS = 5_000;
const SOCKET_TIMEOUT_MS = 10_000;

type Settings = Record<string, string | undefined>;

// Reads the SMTP settings; says all that is wrong at once
export function transportOptions(env: Settings = process.env): SMTPTransport.Options {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD, EMAIL_FROM } = env;

  const missing = [
    ["SMTP_HOST", SMTP_HOST],
    ["SMTP_PORT", SMTP_PORT],
    ["EMAIL_FROM", EMAIL_FROM],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(`Email settings are missing: set ${missing.join(", ")}`);
  }

  const port = Number(SMTP_PORT);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`SMTP_PORT is not a port number: "${SMTP_PORT}"`);
  }

  // The stand-in takes no login; a service like Resend needs both the login and the key
  if (SMTP_USER && !SMTP_PASSWORD) throw new Error("SMTP_PASSWORD is missing: SMTP_USER is set");
  if (SMTP_PASSWORD && !SMTP_USER) throw new Error("SMTP_USER is missing: SMTP_PASSWORD is set");

  return {
    host: SMTP_HOST,
    port,
    secure: SMTP_SECURE === "true",
    auth: SMTP_USER && SMTP_PASSWORD ? { user: SMTP_USER, pass: SMTP_PASSWORD } : undefined,
    connectionTimeout: CONNECTION_TIMEOUT_MS,
    greetingTimeout: GREETING_TIMEOUT_MS,
    socketTimeout: SOCKET_TIMEOUT_MS,
  };
}

// Colors as plain values, not design tokens: mail programs do not support CSS variables. The
// only place in the project where this is so; the values follow the tokens of globals.css
const COLORS = {
  page: "#0c0b0b",
  card: "#110f0f",
  border: "#221f1e",
  text: "#d9d1c5",
  heading: "#e3dbcf",
  muted: "#948a80",
  button: "#5c0e18",
  buttonText: "#ece4d8",
} as const;

const IGNORE_LINE = "Если вы не запрашивали вход - просто проигнорируйте письмо";
const VALIDITY_LINE = `Ссылка работает один раз и ${LOGIN_LINK_MINUTES} минут.`;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function loginHtml(url: string) {
  const link = escapeHtml(url);
  return `<!doctype html>
<html lang="ru">
  <body style="margin:0;padding:24px;background:${COLORS.page};color:${COLORS.text};font-family:Georgia,'Times New Roman',serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:100%;background:${COLORS.card};border:1px solid ${COLORS.border};">
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 16px;font-size:26px;font-weight:normal;color:${COLORS.heading};">Вход в Личную CRM</h1>
                <p style="margin:0 0 24px;font-size:16px;line-height:1.5;">Нажмите кнопку, чтобы войти.</p>
                <p style="margin:0 0 24px;"><a href="${link}" style="display:inline-block;padding:12px 28px;background:${COLORS.button};color:${COLORS.buttonText};font-size:16px;text-decoration:none;">Войти</a></p>
                <p style="margin:0 0 8px;font-size:14px;line-height:1.5;color:${COLORS.muted};">${VALIDITY_LINE}</p>
                <p style="margin:0;font-size:14px;line-height:1.5;color:${COLORS.muted};">${IGNORE_LINE}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
}

function loginText(url: string) {
  return `Вход в Личную CRM

Чтобы войти, откройте ссылку:
${url}

${VALIDITY_LINE}
${IGNORE_LINE}
`;
}

export async function sendLoginEmail({ to, url }: { to: string; url: string }) {
  const options = transportOptions();
  const transport = nodemailer.createTransport(options);

  try {
    await transport.sendMail({
      from: { name: SENDER_NAME, address: process.env.EMAIL_FROM! },
      to,
      subject: SUBJECT,
      text: loginText(url),
      html: loginHtml(url),
    });
  } finally {
    transport.close();
  }
}
