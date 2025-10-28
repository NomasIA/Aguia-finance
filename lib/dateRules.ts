import { DateTime } from 'luxon';
export const TZ = 'America/Sao_Paulo';

export function isWeekend(dt: DateTime) {
  const w = dt.weekday; // 1=Mon ... 7=Sun
  return w === 6 || w === 7;
}

export function nextBusinessDay(dt: DateTime, holidaySet: Set<string>) {
  let d = dt;
  while (isWeekend(d) || holidaySet.has(d.toISODate()!)) d = d.plus({ days: 1 });
  return d;
}

export function applyBusinessRules(rawISO: string, holidaySet: Set<string>): Date {
  const raw = DateTime.fromISO(rawISO, { zone: TZ });
  const adjusted = (isWeekend(raw) || holidaySet.has(raw.toISODate()!)) ? nextBusinessDay(raw, holidaySet) : raw;
  return adjusted.toJSDate();
}
