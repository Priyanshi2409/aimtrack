/**
 * Date helpers. All calendar dates are ISO strings ('YYYY-MM-DD') so they are
 * timezone-free; conversion from instants happens once, via the user's timezone.
 */
export type ISODate = string;

const DAY_MS = 86_400_000;

export function toISODate(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

/** Calendar date of an instant in a given IANA timezone. */
export function localDate(instant: Date | string | number, timeZone = "Asia/Kolkata"): ISODate {
  const d = new Date(instant);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  return parts; // en-CA formats as YYYY-MM-DD
}

export function todayIn(timeZone = "Asia/Kolkata", now: Date = new Date()): ISODate {
  return localDate(now, timeZone);
}

function parse(d: ISODate): number {
  const [y, m, day] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, day);
}

export function addDays(d: ISODate, n: number): ISODate {
  return toISODate(new Date(parse(d) + n * DAY_MS));
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((parse(a) - parse(b)) / DAY_MS);
}

/** 0 = Monday … 6 = Sunday */
export function weekdayIndex(d: ISODate): number {
  return (new Date(parse(d)).getUTCDay() + 6) % 7;
}

export function startOfWeek(d: ISODate): ISODate {
  return addDays(d, -weekdayIndex(d));
}

export function startOfMonth(d: ISODate): ISODate {
  return d.slice(0, 8) + "01";
}

export function rangeDays(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function formatDate(d: ISODate, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) {
  return new Date(parse(d)).toLocaleDateString("en-IN", { ...opts, timeZone: "UTC" });
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${Math.round(min)}m`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
