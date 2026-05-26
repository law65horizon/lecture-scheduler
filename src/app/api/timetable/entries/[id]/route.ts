import { createAdminClient }      from '@/lib/supabase/admin'
import { createClient }           from '@/lib/supabase/server'
import { NextResponse }            from 'next/server'
import { checkHardConstraints }    from '@/lib/solver/constraints'
import type { Venue, Cohort, ProposedSession, Semester } from '@/lib/types/domain'

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

// ─── Shared: build constraint snapshot (excluding one session for PUT) ────────

async function buildConstraintSnapshot(
  admin: ReturnType<typeof createAdminClient>,
  academic_year: string,
  semester: number,
  excludeSessionId?: string,
) {
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

// ─── PUT /api/timetable/entries/[id] ─────────────────────────────────────────
//
// Admin-only. Edits a single timetable session.
// Runs a full hard-constraint check (excluding the session being edited from
// the committed set so it doesn't clash with itself).
// Replaces session_cohorts for that session.
//
// Body: {
//   lecturer_id, venue_id, time_slot_id,
//   academic_year, semester, cohort_ids: string[]
// }
//
// Note: course_id is intentionally not editable once a session is created.
// If the admin needs to change the course, they should delete and re-add.

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body   = await request.json()
  const { lecturer_id, venue_id, time_slot_id,
          academic_year, semester, cohort_ids, course_id } = body

  // ── Validation ─────────────────────────────────────────────────────────────
  if (!lecturer_id || !venue_id || !time_slot_id || !course_id) {
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
    return NextResponse.json(
      { error: 'cohort_ids must be a non-empty array' },
      { status: 400 }
    )
  }

  const admin = createAdminClient()

  // Confirm the session exists
  const { data: existing, error: fetchErr } = await admin
    .from('timetable_sessions')
    .select('id, course_id')
    .eq('id', id)
    .single()

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  // ── Hard-constraint check (exclude this session from committed set) ────────
  const snapshot = await buildConstraintSnapshot(
    admin,
    academic_year.trim(),
    semester,
    id,            // exclude self
  )
  if ('error' in snapshot) {
    return NextResponse.json({ error: snapshot.error }, { status: 500 })
  }

  const violation = checkHardConstraints(
    { course_id: existing.course_id, lecturer_id, venue_id, time_slot_id, cohort_ids },
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

  // ── Update the session row ─────────────────────────────────────────────────
  const { error: updateErr } = await admin
    .from('timetable_sessions')
    .update({
      lecturer_id,
      venue_id,
      time_slot_id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (updateErr) {
    if (updateErr.code === '23505') {
      return NextResponse.json(
        { error: 'This slot is already occupied (database constraint).' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  // ── Replace session_cohorts ───────────────────────────────────────────────
  // Delete existing rows then insert the new set.
  const { error: delCohortErr } = await admin
    .from('session_cohorts')
    .delete()
    .eq('session_id', id)

  if (delCohortErr) {
    return NextResponse.json({ error: delCohortErr.message }, { status: 500 })
  }

  const cohortRows = cohort_ids.map((cohort_id: string) => ({
    session_id:    id,
    cohort_id,
    time_slot_id,
    academic_year: academic_year.trim(),
    semester,
  }))

  const { error: insertCohortErr } = await admin
    .from('session_cohorts')
    .insert(cohortRows)

  if (insertCohortErr) {
    return NextResponse.json({ error: insertCohortErr.message }, { status: 500 })
  }

  return NextResponse.json({ id })
}

// ─── DELETE /api/timetable/entries/[id] ──────────────────────────────────────
//
// Admin-only. Deletes a single timetable session.
// session_cohorts rows cascade-delete via the FK on delete cascade.

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin   = createAdminClient()

  const { error } = await admin
    .from('timetable_sessions')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ id })
}

// ─── PATCH /api/timetable/entries/[id] ───────────────────────────────────────
//
// Admin-only. Toggles is_published for a single session.
// Called by the Publish/Unpublish toggle in the admin timetable UI.
// Body: { is_published: boolean }

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id }         = await params
  const { is_published } = await request.json()

  if (typeof is_published !== 'boolean') {
    return NextResponse.json(
      { error: 'is_published must be a boolean' },
      { status: 400 }
    )
  }

  const admin = createAdminClient()

  const { error } = await admin
    .from('timetable_sessions')
    .update({ is_published, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ id, is_published })
}