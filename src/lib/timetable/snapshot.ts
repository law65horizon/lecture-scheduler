/**
 * snapshot.ts
 *
 * Builds the constraint-checking snapshot used by the manual-entry API routes
 * (POST /api/timetable/entries and PUT /api/timetable/entries/[id]).
 *
 * Extracted from the two route files to avoid duplication and drift.
 */

import type { Venue, Cohort, ProposedSession, Semester } from '@/lib/types/domain'
import type { createAdminClient } from '@/lib/supabase/admin'

export async function buildConstraintSnapshot(
  admin: ReturnType<typeof createAdminClient>,
  academic_year: string,
  semester: number,
  /** For PUT: exclude the session being edited so it doesn't clash with itself */
  excludeSessionId?: string,
) {
  // All existing committed sessions for this year+semester (as ProposedSessions)
  let query = admin
    .from('timetable_sessions')
    .select(`id, course_id, lecturer_id, venue_id, time_slot_id, session_cohorts(cohort_id)`)
    .eq('academic_year', academic_year)
    .eq('semester', semester)

  if (excludeSessionId) {
    query = query.neq('id', excludeSessionId)
  }

  const { data: sessions, error: sessErr } = await query
  if (sessErr) return { error: sessErr.message }

  const committed: ProposedSession[] = (sessions ?? []).map((s: any) => ({
    course_id:     s.course_id,
    lecturer_id:   s.lecturer_id,
    venue_id:      s.venue_id,
    time_slot_id:  s.time_slot_id,
    academic_year,
    semester:      semester as Semester,
    cohort_ids:    (s.session_cohorts ?? []).map((sc: any) => sc.cohort_id),
  }))

  const { data: venues, error: venueErr } = await admin
    .from('venues')
    .select('id, name, capacity, venue_type, is_active')
  if (venueErr) return { error: venueErr.message }

  const { data: cohorts, error: cohortErr } = await admin
    .from('cohorts')
    .select('id, department_id, year_level, student_count')
  if (cohortErr) return { error: cohortErr.message }

  const cohortMap = new Map<string, Cohort>(
    (cohorts ?? []).map((c: any) => [c.id, c as Cohort])
  )

  const { data: unavailRows } = await admin
    .from('lecturer_unavailability')
    .select('lecturer_id, time_slot_id')

  const unavailableSlots = new Set<string>(
    (unavailRows ?? []).map((r: any) => `${r.lecturer_id}|${r.time_slot_id}`)
  )

  return { committed, venues: (venues ?? []) as Venue[], cohortMap, unavailableSlots }
}