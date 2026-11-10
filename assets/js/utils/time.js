const DAY_MS = 86_400_000;

export function isValidTimezone(timezone) {
  try {
    Intl.DateTimeFormat("en", { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function todayInTimezone(timezone = "UTC", now = new Date()) {
  const safeZone = isValidTimezone(timezone) ? timezone : "UTC";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: safeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const pick = (type) => parts.find((part) => part.type === type)?.value;
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

function dateKeyToUtc(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return Number.NaN;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function calendarDayDifference(startDate, endDate) {
  const start = dateKeyToUtc(startDate);
  const end = dateKeyToUtc(endDate);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return Number.NaN;
  return Math.floor((end - start) / DAY_MS);
}

export function calculateChallengeDay({ startDate, now = new Date(), timezone = "UTC", maxDays = 30 }) {
  if (!startDate) return 0;
  const today = todayInTimezone(timezone, now);
  const difference = calendarDayDifference(startDate, today);
  if (!Number.isFinite(difference) || difference < 0) return 0;
  return Math.min(maxDays, difference + 1);
}

export function addCalendarDays(dateString, days) {
  const timestamp = dateKeyToUtc(dateString);
  if (!Number.isFinite(timestamp)) return "";
  return new Date(timestamp + days * DAY_MS).toISOString().slice(0, 10);
}

export function dateForChallengeDay(startDate, day) {
  return addCalendarDays(startDate, Math.max(0, Number(day) - 1));
}

export function daysUntilChallengeDay({ startDate, day, now = new Date(), timezone = "UTC" }) {
  const target = dateForChallengeDay(startDate, day);
  const today = todayInTimezone(timezone, now);
  return calendarDayDifference(today, target);
}
