import { createAdminClient } from '@/lib/supabase/admin'
import { createClient }      from '@/lib/supabase/server'
import { NextResponse }       from 'next/server'
import { checkHardConstraints } from '@/lib/solver/constraints'
import { buildConstraintSnapshot } from '@/lib/timetable/snapshot'
import type { Semester } from '@/lib/types/domain'

// ─── Helper ───────────────────────────────────────────────────────────────────

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'ADMIN') return null
  return user
}

// ─── GET /api/timetable/entries ───────────────────────────────────────────────
//
// Returns all timetable sessions for a given academic_year + semester with all
// display joins. Non-admins only see published sessions (enforced by RLS).
//
// Query params: ?academic_year=2025/2026&semester=1

export async function GET(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)

  const academic_year = searchParams.get('academic_year')
  const semesterRaw   = searchParams.get('semester')

  if (!academic_year || !semesterRaw) {
    return NextResponse.json(
      { error: 'academic_year and semester query params are required' },
      { status: 400 }
    )
  }

  const semester = Number(semesterRaw)
  if (semester !== 1 && semester !== 2) {
    return NextResponse.json({ error: 'semester must be 1 or 2' }, { status: 400 })
  }

  const { data: sessions, error } = await supabase
    .from('timetable_sessions')
    .select(`
      id,
      course_id,
      lecturer_id,
      venue_id,
      time_slot_id,
      academic_year,
      semester,
      is_published,
      created_at,
      courses ( id, code, title, credit_units, semester, required_venue_type, is_repeat ),
      venues  ( id, name, capacity, venue_type, is_active ),
      time_slots ( id, day_of_week, start_time, end_time, is_active ),
      session_cohorts (
        cohort_id,
        cohorts (
          id, year_level, student_count,
          departments ( name, code )
        )
      )
    `)
    .eq('academic_year', academic_year)
    .eq('semester', semester)
    .order('time_slot_id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch lecturer names — same two-step pattern as /api/lecturers
  const admin = createAdminClient()

  const lecturerIds = [...new Set((sessions ?? []).map((s: any) => s.lecturer_id))]
  let lecturerMap = new Map<string, { id: string; staff_id: string; full_name: string | null }>()

  if (lecturerIds.length > 0) {
    const { data: lecturers } = await admin
      .from('lecturers')
      .select('id, user_id, staff_id')
      .in('id', lecturerIds)

    const userIds = (lecturers ?? []).map((l: any) => l.user_id)
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds)

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name]))

    lecturerMap = new Map(
      (lecturers ?? []).map((l: any) => [
        l.id,
        { id: l.id, staff_id: l.staff_id, full_name: profileMap.get(l.user_id) ?? null },
      ])
    )
  }

  const shaped = (sessions ?? []).map((s: any) => ({
    id:           s.id,
    course_id:    s.course_id,
    lecturer_id:  s.lecturer_id,
    venue_id:     s.venue_id,
    time_slot_id: s.time_slot_id,
    academic_year: s.academic_year,
    semester:     s.semester,
    is_published: s.is_published,
    created_at:   s.created_at,
    course:       s.courses ?? null,
    venue:        s.venues  ?? null,
    time_slot:    s.time_slots ?? null,
    lecturer:     lecturerMap.get(s.lecturer_id) ?? null,
    cohorts: (s.session_cohorts ?? [])
      .map((sc: any) => sc.cohorts)
      .filter(Boolean),
  }))

  return NextResponse.json(shaped)
}

// ─── POST /api/timetable/entries ─────────────────────────────────────────────
//
// Admin-only. Manually adds a single timetable session with a full hard-
// constraint check before writing to the database.
//
// Body: {
//   course_id, lecturer_id, venue_id, time_slot_id,
//   academic_year, semester, cohort_ids: string[]
// }

export async function POST(request: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { course_id, lecturer_id, venue_id, time_slot_id,
          academic_year, semester, cohort_ids } = body

  if (!course_id || !lecturer_id || !venue_id || !time_slot_id) {
    return NextResponse.json(
      { error: 'course_id, lecturer_id, venue_id, and time_slot_id are required' },
      { status: 400 }
    )
  }
  if (!academic_year?.trim()) {
    return NextResponse.json({ error: 'academic_year is required' }, { status: 400 })
  }
  if (semester !== 1 && semester !== 2) {
    return NextResponse.json({ error: 'semester must be 1 or 2' }, { status: 400 })
  }
  if (!Array.isArray(cohort_ids) || cohort_ids.length === 0) {
    return NextResponse.json({ error: 'cohort_ids must be a non-empty array' }, { status: 400 })
  }

  const admin = createAdminClient()

  const snapshot = await buildConstraintSnapshot(admin, academic_year.trim(), semester)
  if ('error' in snapshot) {
    return NextResponse.json({ error: snapshot.error }, { status: 500 })
  }

  const violation = checkHardConstraints(
    { course_id, lecturer_id, venue_id, time_slot_id, cohort_ids },
    snapshot.venues,
    snapshot.cohortMap,
    snapshot.committed,
    snapshot.unavailableSlots,
  )

  if (violation) {
    return NextResponse.json(
      { error: violation.reason, constraint: violation.constraint },
      { status: 409 }
    )
  }

  const { data: session, error: sessErr } = await admin
    .from('timetable_sessions')
    .insert({
      course_id,
      lecturer_id,
      venue_id,
      time_slot_id,
      academic_year: academic_year.trim(),
      semester,
      is_published: false,
      created_by:   user.id,
    })
    .select('id, time_slot_id')
    .single()

  if (sessErr) {
    if (sessErr.code === '23505') {
      return NextResponse.json(
        { error: 'This slot is already occupied (database constraint).' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: sessErr.message }, { status: 500 })
  }

  const cohortRows = cohort_ids.map((cohort_id: string) => ({
    session_id:    session.id,
    cohort_id,
    time_slot_id:  session.time_slot_id,
    academic_year: academic_year.trim(),
    semester,
  }))

  const { error: cohortErr } = await admin
    .from('session_cohorts')
    .insert(cohortRows)

  if (cohortErr) {
    await admin.from('timetable_sessions').delete().eq('id', session.id)
    return NextResponse.json({ error: cohortErr.message }, { status: 500 })
  }

  return NextResponse.json({ id: session.id }, { status: 201 })
}