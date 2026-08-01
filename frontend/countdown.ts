import { pluralForm, t } from "./locale";

const RESET_WEEKDAY = 3;
const RESET_HOUR = 1;

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  millis: number;
}

export function nextReset(from: Date): Date {
  const slot = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), RESET_HOUR, 0, 0, 0),
  );
  let advance = (RESET_WEEKDAY - slot.getUTCDay() + 7) % 7;
  if (advance === 0 && slot.getTime() <= from.getTime()) advance = 7;
  slot.setUTCDate(slot.getUTCDate() + advance);
  return slot;
}

export function countdownTo(target: Date, from: Date): Countdown {
  const millis = Math.max(0, target.getTime() - from.getTime());
  return {
    millis,
    days: Math.floor(millis / 86_400_000),
    hours: Math.floor(millis / 3_600_000) % 24,
    minutes: Math.floor(millis / 60_000) % 60,
    seconds: Math.floor(millis / 1_000) % 60,
  };
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function shortForm(c: Countdown): string {
  const clock = `${pad(c.hours)}:${pad(c.minutes)}:${pad(c.seconds)}`;
  return c.days > 0 ? `${c.days}${t("dayShort")} ${clock}` : clock;
}

export function longForm(c: Countdown): string {
  const piece = (value: number, unit: string) => `${value} ${pluralForm(unit, value)}`;
  return [
    piece(c.days, "day"),
    piece(c.hours, "hour"),
    piece(c.minutes, "minute"),
    piece(c.seconds, "second"),
  ].join(", ");
}

export function localStamp(d: Date, locale: string): string {
  return d.toLocaleString(locale, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
