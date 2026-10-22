import { getDaysInMonth, isSameMonth, parseISO } from 'date-fns';

export const PAYROLL_BASE_DAYS = 30;

// Saved unpaid payslips take their days from attendance only from this month ('yyyy-MM'); earlier months stay as saved.
export const LIVE_ATTENDANCE_FROM = '2026-09';

export const WEEK_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// An employee's own weekend replaces the company weekend; empty/unset means "use company weekend".
export function employeeWeekendDays(employee: { weekendDays?: string[] | null }, companyWeekendDays: string[]) {
  return employee.weekendDays?.length ? employee.weekendDays : companyWeekendDays;
}

export function calculatePayableAmount(
  salary: number,
  presentDays: number,
  providentFund: number,
  adj: { incentive?: number; fine?: number; trainingFee?: number; advance?: number } = {}
) {
  return (salary / PAYROLL_BASE_DAYS) * presentDays
    + (adj.incentive || 0) - (adj.fine || 0) - providentFund - (adj.trainingFee || 0) - (adj.advance || 0);
}

// Weekends are paid off-days; each weekend check-in (app or manual) adds one day on top of the 30-day base (e.g. 31).
export function calculatePayrollDays(records: { date: string; status?: string }[], weekendDays: string[], month: Date) {
  const weekendIndexes = new Set((weekendDays || []).map(day => WEEK_DAYS.indexOf(day)));

  let workingDays = 0;
  for (let d = 1; d <= getDaysInMonth(month); d++) {
    if (!weekendIndexes.has(new Date(month.getFullYear(), month.getMonth(), d).getDay())) workingDays++;
  }

  const regularDates = new Set<string>();
  const weekendDates = new Set<string>();
  let lateDays = 0;
  for (const record of records) {
    const date = parseISO(record.date);
    if (!isSameMonth(date, month) || record.status === 'Absent') continue;
    if (weekendIndexes.has(date.getDay())) {
      // Leave or a marked weekend on a paid off-day is not extra work.
      if (record.status !== 'Paid Leave' && record.status !== 'Weekend') weekendDates.add(record.date);
    } else {
      regularDates.add(record.date);
    }
    if (record.status === 'Late') lateDays++;
  }

  const absentDays = Math.max(0, workingDays - regularDates.size);
  return {
    presentDays: Math.max(0, PAYROLL_BASE_DAYS - absentDays) + weekendDates.size,
    absentDays,
    lateDays,
  };
}
