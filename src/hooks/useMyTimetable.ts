import { useQuery } from '@tanstack/react-query'
import type { SessionRow } from '@/hooks/useTimetable'

async function fetchMyTimetable(academic_year: string, semester: number): Promise<SessionRow[]> {
  const params = new URLSearchParams({
    academic_year,
    semester: String(semester),
  })
  const res = await fetch(`/api/my/timetable?${params}`)
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? 'Failed to fetch your timetable')
  }
  return res.json()
}

export const myTimetableKeys = {
  entries: (year: string, sem: number) => ['my-timetable', year, sem] as const,
}

export function useMyTimetable(academic_year: string, semester: number) {
  return useQuery({
    queryKey: myTimetableKeys.entries(academic_year, semester),
    queryFn: () => fetchMyTimetable(academic_year, semester),
    enabled: !!academic_year && (semester === 1 || semester === 2),
  })
}
