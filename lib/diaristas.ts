import { DateTime } from 'luxon';
import { TZ } from './dateRules';

export function totalDiaristaNoPeriodo(
  diariaSemana: number, diariaFimSemana: number, diasISO: string[]
) {
  let uteis = 0, fds = 0, total = 0;
  for (const d of diasISO) {
    const dt = DateTime.fromISO(d, { zone: TZ });
    const isFds = dt.weekday === 6 || dt.weekday === 7;
    if (isFds) { fds++; total += Number(diariaFimSemana); }
    else { uteis++; total += Number(diariaSemana); }
  }
  return { uteis, fds, total };
}
