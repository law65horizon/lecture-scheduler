import { createAdminClient } from '@/lib/supabase/admin'
import { createClient }      from '@/lib/supabase/server'
import { NextResponse }       from 'next/server'

// ─── GET /api/my/timetable ────────────────────────────────────────────────────
//
// Returns the signed-in user's own timetable:
//   - LECTURER: sessions where lecturer_id matches their lecturers row
//   - STUDENT:  sessions where their cohort appears via session_cohorts
//   - ADMIN:    not applicable here — admins use /api/timetable/entries
//
// RLS already restricts non-admins to is_published = true rows, but we filter
// explicitly too so an unpublished draft never even reaches this response.
//
// Query params: ?academic_year=2025/2026&semester=1

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'LECTURER' && profile.role !== 'STUDENT')) {
    return NextResponse.json(
      { error: 'Only lecturers and students have a personal timetable. Admins should use /api/timetable/entries.' },
      { status: 403 }
    )
  }

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

  const admin = createAdminClient()

  // ── Resolve which sessions belong to this user ─────────────────────────────
  let sessionIdFilter: string[] | null = null

  if (profile.role === 'LECTURER') {
    const { data: lecturer } = await admin
      .from('lecturers')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!lecturer) return NextResponse.json([])

    const { data: sessions } = await admin
      .from('timetable_sessions')
      .select('id')
      .eq('lecturer_id', lecturer.id)
      .eq('academic_year', academic_year)
      .eq('semester', semester)
      .eq('is_published', true)

    sessionIdFilter = (sessions ?? []).map((s) => s.id)
  } else {
    const { data: student } = await admin
      .from('students')
      .select('cohort_id')
      .eq('user_id', user.id)
      .single()

    if (!student) return NextResponse.json([])

    const { data: cohortSessions } = await admin
      .from('session_cohorts')
      .select('session_id')
      .eq('cohort_id', student.cohort_id)
      .eq('academic_year', academic_year)
      .eq('semester', semester)

    sessionIdFilter = [...new Set((cohortSessions ?? []).map((s) => s.session_id))]
  }

  if (sessionIdFilter.length === 0) return NextResponse.json([])

  const { data: sessions, error } = await admin
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
    .in('id', sessionIdFilter)
    .eq('is_published', true)
    .order('time_slot_id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Same two-step lecturer-name lookup pattern used by /api/timetable/entries
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
