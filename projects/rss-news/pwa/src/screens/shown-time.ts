// How an Item's time is shown, in the owner's locale, on every screen.
export const shownTime = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

// The day only, for Inbox rows older than a week.
export const shownDate = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
});

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// A short age for Inbox rows ("now", "5m", "3h", "6d"), then the date from a week back.
export function relativeTime(when: Date, now: Date): string {
  const age = now.getTime() - when.getTime();
  if (age < MINUTE) return "now";
  if (age < HOUR) return `${String(Math.floor(age / MINUTE))}m`;
  if (age < DAY) return `${String(Math.floor(age / HOUR))}h`;
  if (age < 7 * DAY) return `${String(Math.floor(age / DAY))}d`;
  return shownDate.format(when);
}
