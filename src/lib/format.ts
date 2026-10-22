import type { FrequencyChoice } from "@/lib/validation";

// Time zone the dates are shown in: the zone of the Node process (TZ in deploy/compose.yaml).
// The database counts "today" and the due date in the same zone, so they match the note dates
export function appTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

const dateTimeFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: appTimeZone(),
});

const dateFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: appTimeZone(),
});

export function formatDateTime(date: Date) {
  return dateTimeFormat.format(date);
}

export function formatDate(date: Date) {
  return dateFormat.format(date);
}

// A calendar day as "YYYY-MM-DD" -> "15 ноября 2026 г.". Noon UTC is the same day in any zone
export function formatDay(day: string) {
  return formatDate(new Date(`${day}T12:00:00Z`));
}

// 1234 -> "1 234"
export function formatNumber(value: number) {
  return value.toLocaleString("ru-RU");
}

const pluralRules = new Intl.PluralRules("ru-RU");

// pluralize(5, ["контакт", "контакта", "контактов"]) -> "5 контактов"
export function pluralize(count: number, forms: [string, string, string]) {
  const rule = pluralRules.select(count);
  const word = rule === "one" ? forms[0] : rule === "few" ? forms[1] : forms[2];
  return `${formatNumber(count)} ${word}`;
}

export const CONTACT_FORMS: [string, string, string] = ["контакт", "контакта", "контактов"];

export const frequencyLabels: Record<FrequencyChoice, string> = {
  none: "Не задано",
  week: "Раз в неделю",
  month: "Раз в месяц",
  quarter: "Раз в квартал",
  year: "Раз в год",
};

// 3 -> "просрочено на 3 дня"
export function formatOverdue(days: number) {
  return `просрочено на ${pluralize(days, ["день", "дня", "дней"])}`;
}
