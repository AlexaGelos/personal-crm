const dateTimeFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const dateFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function formatDateTime(date: Date) {
  return dateTimeFormat.format(date);
}

export function formatDate(date: Date) {
  return dateFormat.format(date);
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
