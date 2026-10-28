import { z } from "zod";

import type { ContactFrequency } from "@/db/schema";

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
};

// The form also holds the checked groups and the names typed into "Новая группа"
export type ContactFormValues = ContactFields & {
  groupIds: number[];
  newGroupNames: string[];
};

export type ContactFormState = {
  values?: ContactFormValues;
  // newGroupNames: a typed name the browser should have refused (e.g. over 50 characters)
  errors?: Partial<Record<keyof ContactFields | "newGroupNames", string[]>>;
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
