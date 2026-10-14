import { addMonths, dateInMonth, diffDays, monthKey, type ISODate } from './dates';
import type { Bill } from '../data/types';

export interface Occurrence {
  bill: Bill;
  month: string;
  due: ISODate;
  paid: boolean;
  note?: string;
  /** Unpaid and past its due date. */
  missed: boolean;
  /** Reminder window has opened (due minus offset <= today) and still unpaid. */
  reminding: boolean;
}

/**
 * Occurrences to show: every unpaid month from the bill's start up to the current
 * month (missed ones stay visible), plus the current month even when paid.
 * Paying one month never touches another.
 */
export function visibleOccurrences(bill: Bill, today: ISODate): Occurrence[] {
  const current = monthKey(today);
  const out: Occurrence[] = [];
  for (let m = bill.start; m <= current; m = addMonths(m, 1)) {
    const pay = bill.payments[m];
    const paid = !!pay?.paid;
    if (paid && m !== current) continue;
    const due = dateInMonth(m, bill.dueDay);
    out.push({
      bill, month: m, due, paid, note: pay?.note,
      missed: !paid && diffDays(due, today) < 0,
      reminding: !paid && diffDays(due, today) - bill.reminderDays <= 0,
    });
  }
  return out;
}
