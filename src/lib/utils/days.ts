import { DayOfWeek } from '@/lib/types/domain'

export const DAY_NAMES: Record<DayOfWeek, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
}

export const SHORT_DAY_NAMES: Record<DayOfWeek, string> = {
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
}

export function formatTimeSlot(start: string, end: string): string {
  return `${start.slice(0, 5)} – ${end.slice(0, 5)}`
}