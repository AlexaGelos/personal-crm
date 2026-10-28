// Calendar days ("YYYY-MM-DD") in the zone the app shows dates in, for putting due dates
// into the database and checking them. Shared by Vitest and Playwright
import { appTimeZone } from "@/lib/format";

const DAY_MS = 24 * 60 * 60 * 1000;

// "en-CA" writes a date as "YYYY-MM-DD"
const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: appTimeZone() });

export function today() {
  return dayFormat.format(new Date());
}

// A moment on that day: noon UTC is the same calendar day in any zone, as in formatDay()
export function onDay(day: string) {
  return new Date(`${day}T12:00:00Z`);
}

export function addDays(day: string, days: number) {
  return new Date(onDay(day).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

// Calendar months, as the database adds them: Jan 31 + 1 month = Feb 28
export function addMonths(day: string, months: number) {
  const [year, month, date] = day.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDate = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
  first.setUTCDate(Math.min(date, lastDate.getUTCDate()));
  return first.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string) {
  return Math.round((onDay(to).getTime() - onDay(from).getTime()) / DAY_MS);
}
