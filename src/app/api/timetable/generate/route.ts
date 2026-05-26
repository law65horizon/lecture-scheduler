import { createAdminClient } from '@/lib/supabase/admin'
import { createClient }      from '@/lib/supabase/server'
import { NextResponse }       from 'next/server'
import { generateTimetable }  from '@/lib/solver/solver'
import type { SolverInput, Semester } from '@/lib/types/domain'

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

// ─── POST /api/timetable/generate ────────────────────────────────────────────
//
// Admin-only. Fetches the full scheduling snapshot from the database, passes it
// to the pure CSP solver, and returns the proposed sessions WITHOUT writing
// anything to the database. The admin reviews the draft in the UI and then
// calls /api/timetable/commit to persist it.
//
// Body: { academic_year: string, semester: 1 | 2 }
//
// Response (success):
//   { sessions: ProposedSession[] }
//
// Response (solver failure):
//   { error: string, courseCode?: string }   (status 422)

export async function POST(request: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Parse and validate body ───────────────────────────────────────────────
  const body = await request.json()
  const { academic_year, semester } = body

  if (!academic_year?.trim()) {
    return NextResponse.json(
      { error: 'academic_year is required (e.g. "2025/2026")' },
      { status: 400 }
    )
  }
  if (semester !== 1 && semester !== 2) {
    return NextResponse.json(
      { error: 'semester must be 1 or 2' },
      { status: 400 }
    )
  }

  const admin   = createAdminClient()
  const supabase = await createClient()

  // ── Fetch snapshot: venues ────────────────────────────────────────────────
  const { data: venues, error: venueErr } = await supabase
    .from('venues')
    .select('id, name, capacity, venue_type, is_active')

  if (venueErr) return NextResponse.json({ error: venueErr.message }, { status: 500 })

  // ── Fetch snapshot: time slots ────────────────────────────────────────────
  const { data: timeSlots, error: slotErr } = await supabase
    .from('time_slots')
    .select('id, day_of_week, start_time, end_time, is_active')
    .order('day_of_week')
    .order('start_time')

  if (slotErr) return NextResponse.json({ error: slotErr.message }, { status: 500 })

  // ── Fetch snapshot: courses with cohorts and lecturer ─────────────────────
  // We need:
  //   course fields + is_repeat + required_venue_type
  //   cohorts (id + student_count) via course_cohorts
  //   lecturer_id via course_lecturers
  // Filter to the requested semester only.
  const { data: rawCourses, error: courseErr } = await supabase
    .from('courses')
    .select(`
      id,
      code,
      title,
      credit_units,
      semester,
      required_venue_type,
      is_repeat,
      course_cohorts (
        cohorts ( id, department_id, year_level, student_count )
      ),
      course_lecturers ( lecturer_id )
    `)
    .eq('semester', semester)

  if (courseErr) return NextResponse.json({ error: courseErr.message }, { status: 500 })

  // Reshape courses into the SolverInput shape
  const courses = (rawCourses ?? []).map((c: any) => ({
    id:                  c.id,
    code:                c.code,
    title:               c.title,
    credit_units:        c.credit_units,
    semester:            c.semester,
    required_venue_type: c.required_venue_type ?? null,
    is_repeat:           c.is_repeat,
    created_at:          '',
    // Flatten the nested cohorts from the junction table
    cohorts: (c.course_cohorts ?? [])
      .map((cc: any) => cc.cohorts)
      .filter(Boolean),
    // The solver expects a flat lecturer_id string on the course object
    lecturer_id: c.course_lecturers?.[0]?.lecturer_id ?? null,
  }))

  // ── Fetch snapshot: lecturer unavailability ───────────────────────────────
  // Returns Record<lecturerId, timeSlotId[]> — what the solver expects.
  const { data: unavailRows, error: unavailErr } = await admin
    .from('lecturer_unavailability')
    .select('lecturer_id, time_slot_id')

  if (unavailErr) return NextResponse.json({ error: unavailErr.message }, { status: 500 })

  const lecturerUnavailability: Record<string, string[]> = {}
  for (const row of unavailRows ?? []) {
    if (!lecturerUnavailability[row.lecturer_id]) {
      lecturerUnavailability[row.lecturer_id] = []
    }
    lecturerUnavailability[row.lecturer_id].push(row.time_slot_id)
  }

  // ── Build SolverInput and run solver ──────────────────────────────────────
  const input: SolverInput = {
    courses,
    venues:     venues ?? [],
    timeSlots:  timeSlots ?? [],
    academicYear: academic_year.trim(),
    semester:   semester as Semester,
    lecturerUnavailability,
  }

  const result = generateTimetable(input)

  if (!result.success) {
    // 422 Unprocessable Entity — the request was valid but the solver could not
    // find a feasible timetable with the current data.
    return NextResponse.json(
      { error: result.reason, courseCode: result.courseCode ?? null },
      { status: 422 }
    )
  }

  return NextResponse.json({ sessions: result.sessions })
}