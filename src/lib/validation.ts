import { z } from "zod";

// Raw form values exactly as the user typed them
export type ContactFields = {
  name: string;
  about: string;
  howWeMet: string;
  phone: string;
  email: string;
};

export type ContactFormState = {
  values?: ContactFields;
  errors?: Partial<Record<keyof ContactFields, string[]>>;
  message?: string;
};

export type NoteFormState = {
  body?: string;
  error?: string;
};

export const emptyContactFields: ContactFields = {
  name: "",
  about: "",
  howWeMet: "",
  phone: "",
  email: "",
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
  name: z
    .string()
    .trim()
    .min(1, "Укажите имя")
    .max(200, "Не больше 200 символов"),
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

export const idSchema = z.number().int().positive().max(2147483647);

// Route segment "/contacts/42" -> 42; anything else -> null
export function parseContactId(segment: string) {
  if (!/^\d{1,10}$/.test(segment)) return null;
  const parsed = idSchema.safeParse(Number(segment));
  return parsed.success ? parsed.data : null;
}
