import { z } from "zod";

import type { ContactFrequency } from "@/db/schema";

// By default zod tries Function("") to see whether it may build faster parsers with eval. The
// Content Security Policy (next.config.ts) forbids eval, so the browser would log a violation
// on every page that loads this file. With jitless zod does not try and uses its plain parsers
z.config({ jitless: true });

// Frequency switch values in the order of its buttons; "none" is stored as NULL
export const frequencyChoices = ["none", "week", "month", "quarter", "year"] as const;

export type FrequencyChoice = (typeof frequencyChoices)[number];

// Raw form values exactly as the user typed them
export type ContactFields = {
  name: string;
  about: string;
  howWeMet: string;
  phone: string;
  email: string;
  // The three parts of the birth date as typed: day, month number from the list, year
  birthDay: string;
  birthMonth: string;
  birthYear: string;
};

// The form also holds the checked groups and the names typed into "Новая группа"
export type ContactFormValues = ContactFields & {
  groupIds: number[];
  newGroupNames: string[];
};

export type ContactFormState = {
  values?: ContactFormValues;
  // newGroupNames: a typed name the browser should have refused (e.g. over 50 characters).
  // birthDate: one error for the whole date, shown under its three parts
  errors?: Partial<
    Record<
      | Exclude<keyof ContactFields, "birthDay" | "birthMonth" | "birthYear">
      | "birthDate"
      | "newGroupNames",
      string[]
    >
  >;
  message?: string;
};

export type NoteFormState = {
  body?: string;
  error?: string;
};

// Create and rename forms of a group; "name" brings the typed text back after an error
export type GroupFormState = {
  name?: string;
  error?: string;
};

export type FrequencyFormState = {
  error?: string;
};

// "Связались" was saved: what the undo needs to put the old value back. Moments are ISO strings
export type ContactedMark = {
  contactId: number;
  name: string;
  previous: string | null;
  markedAt: string;
};

export type MarkContactedResult = { mark: ContactedMark } | { error: string };

export type UndoContactedResult = { error?: string };

export const emptyContactFields: ContactFormValues = {
  name: "",
  about: "",
  howWeMet: "",
  phone: "",
  email: "",
  birthDay: "",
  birthMonth: "",
  birthYear: "",
  groupIds: [],
  newGroupNames: [],
};

// Empty optional fields are stored as NULL
function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max, `Не больше ${max} символов`)
    .transform((value) => value || null);
}

export const contactSchema = z.object({
  name: z.string().trim().min(1, "Укажите имя").max(200, "Не больше 200 символов"),
  about: optionalText(500),
  howWeMet: optionalText(1000),
  phone: optionalText(50).refine(
    (value) => value === null || /^[\d\s+()-]+$/.test(value),
    "Телефон может содержать только цифры, пробелы и символы + ( ) -",
  ),
  email: optionalText(200).refine(
    (value) => value === null || z.email().safeParse(value).success,
    "Проверьте адрес почты, например: name@example.com",
  ),
});

// Birth date as it is stored: day and month always, the year when it is known; null - not set
export type BirthDate = { day: number; month: number; year: number | null };

export const BIRTH_DATE_INCOMPLETE = "Укажите день и месяц";
export const BIRTH_DATE_IMPOSSIBLE = "Такой даты нет";
export const BIRTH_YEAR_OUT_OF_RANGE = "Год — от 1900 до текущего";

export const FIRST_BIRTH_YEAR = 1900;

const isLeapYear = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

// February has 29 days when the year is unknown: a person born on February 29 is still born
function daysInMonth(month: number, year: number | null) {
  if (month === 2) return year === null || isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

// The three raw parts of the form -> a date, null for empty fields, or one of three messages.
// Used by the add and edit forms and by a request that goes around them alike
export const birthDateSchema = z
  .object({ birthDay: z.string(), birthMonth: z.string(), birthYear: z.string() })
  .transform((raw, ctx): BirthDate | null => {
    const [day, month, year] = [raw.birthDay, raw.birthMonth, raw.birthYear].map((part) =>
      part.trim(),
    );
    const fail = (message: string) => {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    };

    if (!day && !month && !year) return null;
    if (!day || !month) return fail(BIRTH_DATE_INCOMPLETE);

    // Only digits: no signs, no decimals, no spaces inside
    if (!/^\d+$/.test(day) || !/^\d+$/.test(month) || (year && !/^\d+$/.test(year))) {
      return fail(BIRTH_DATE_IMPOSSIBLE);
    }
    const dayNumber = Number(day);
    const monthNumber = Number(month);
    const yearNumber = year ? Number(year) : null;

    if (monthNumber < 1 || monthNumber > 12 || dayNumber < 1) return fail(BIRTH_DATE_IMPOSSIBLE);
    if (dayNumber > daysInMonth(monthNumber, null)) return fail(BIRTH_DATE_IMPOSSIBLE);

    if (yearNumber !== null) {
      if (yearNumber < FIRST_BIRTH_YEAR || yearNumber > new Date().getFullYear()) {
        return fail(BIRTH_YEAR_OUT_OF_RANGE);
      }
      // February 29 of a year that is not a leap one
      if (dayNumber > daysInMonth(monthNumber, yearNumber)) return fail(BIRTH_DATE_IMPOSSIBLE);
    }

    return { day: dayNumber, month: monthNumber, year: yearNumber };
  });

export const noteSchema = z
  .string()
  .trim()
  .min(1, "Напишите текст заметки")
  .max(5000, "Не больше 5000 символов");

export const groupNameSchema = z
  .string()
  .trim()
  .min(1, "Укажите название")
  .max(50, "Не больше 50 символов");

// The same key as the unique index on groups: case and "ё" / "е" do not tell names apart.
// Keep it in step with lower(translate(name, 'ёЁ', 'еЕ')) in src/db/schema.ts
export function groupNameKey(name: string) {
  return name.replace(/ё/g, "е").replace(/Ё/g, "Е").toLocaleLowerCase("ru");
}

// Shown on the login page, so they stay in Russian
export const LOGIN_EMAIL_INVALID = "Проверь адрес почты";
export const LOGIN_TOO_OFTEN = "Слишком часто, попробуй через несколько минут";

// The address as it is stored and compared everywhere: no spaces at the edges, lower case.
// The form and the server check it the same way, so a request that bypasses the form gets
// no further than a typed one
export const loginEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, LOGIN_EMAIL_INVALID)
  .pipe(z.email(LOGIN_EMAIL_INVALID));

// The login form: the typed address comes back after an error; sentTo is set once the email is sent
export type LoginFormState = {
  email?: string;
  error?: string;
  sentTo?: string;
};

export const frequencySchema = z
  .enum(frequencyChoices)
  .transform((value): ContactFrequency | null => (value === "none" ? null : value));

export const idSchema = z.number().int().positive().max(2147483647);

// A moment from Date.toISOString(), e.g. "2026-10-22T09:15:00.000Z"
export const momentSchema = z.iso.datetime();

// Route segment "/contacts/42" -> 42; anything else -> null
export function parseContactId(segment: string) {
  if (!/^\d{1,10}$/.test(segment)) return null;
  const parsed = idSchema.safeParse(Number(segment));
  return parsed.success ? parsed.data : null;
}

// ?group=5 -> 5; a missing, repeated or malformed value -> null
export function parseGroupId(value: string | string[] | undefined) {
  return typeof value === "string" ? parseContactId(value) : null;
}
