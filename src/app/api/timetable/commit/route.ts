import { createAdminClient } from '@/lib/supabase/admin'
import { createClient }      from '@/lib/supabase/server'
import { NextResponse }       from 'next/server'
import type { ProposedSession } from '@/lib/types/domain'

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

// ─── POST /api/timetable/commit ───────────────────────────────────────────────
//
// Admin-only. Receives the array of ProposedSessions returned by /generate,
// then writes them all to timetable_sessions + session_cohorts in a single
// Supabase operation. The DB unique constraints (H1, H2, H3) act as a final
// safety net at the database level.
//
// Before inserting, we DELETE any existing UNPUBLISHED sessions for the same
// academic_year + semester so the admin can regenerate freely without
// accumulating stale drafts. Published sessions are never touched.
//
// Body: { sessions: ProposedSession[], academic_year: string, semester: 1 | 2 }
//
// Response: { count: number }  — number of sessions committed

export async function POST(request: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Parse and validate body ───────────────────────────────────────────────
  const body = await request.json()
  const { sessions, academic_year, semester } = body

  if (!Array.isArray(sessions) || sessions.length === 0) {
    return NextResponse.json(
      { error: 'sessions must be a non-empty array' },
      { status: 400 }
    )
  }
  if (!academic_year?.trim()) {
    return NextResponse.json(
      { error: 'academic_year is required' },
      { status: 400 }
    )
  }
  if (semester !== 1 && semester !== 2) {
    return NextResponse.json(
      { error: 'semester must be 1 or 2' },
      { status: 400 }
    )
  }

  const admin = createAdminClient()

  // ── Step 1: Delete existing UNPUBLISHED sessions for this year + semester ──
  // This lets the admin regenerate a timetable without manual cleanup.
  // Published sessions (is_published = true) are deliberately left untouched —
  // an admin must unpublish manually before regenerating if they want a clean
  // slate that replaces a live timetable.
  const { error: deleteErr } = await admin
    .from('timetable_sessions')
    .delete()
    .eq('academic_year', academic_year.trim())
    .eq('semester', semester)
    .eq('is_published', false)

  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 })
  }

  // ── Step 2: Insert all timetable_sessions rows ────────────────────────────
  const sessionRows = (sessions as ProposedSession[]).map((s) => ({
    course_id:     s.course_id,
    lecturer_id:   s.lecturer_id,
    venue_id:      s.venue_id,
    time_slot_id:  s.time_slot_id,
    academic_year: academic_year.trim(),
    semester,
    is_published:  false,       // always starts as draft; admin publishes later
    created_by:    user.id,
  }))

  const { data: insertedSessions, error: sessionErr } = await admin
    .from('timetable_sessions')
    .insert(sessionRows)
    .select('id, course_id, lecturer_id, venue_id, time_slot_id')

  if (sessionErr) {
    // The DB unique constraints will catch any double-booking that slipped past
    // the solver (shouldn't happen, but belt-and-braces).
    if (sessionErr.code === '23505') {
      return NextResponse.json(
        {
          error:
            'A scheduling conflict was detected when writing to the database. ' +
            'This should not normally happen — please regenerate the timetable.',
        },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: sessionErr.message }, { status: 500 })
  }

  // ── Step 3: Insert all session_cohorts rows ───────────────────────────────
  // Map each inserted session back to its cohort_ids from the proposed sessions.
  // We rely on insertion order being preserved (Supabase/Postgres guarantees
  // returning rows in insert order when no ORDER BY is applied to a bulk insert).
  const cohortRows: {
    session_id:    string
    cohort_id:     string
    time_slot_id:  string
    academic_year: string
    semester:      number
  }[] = []

  for (let i = 0; i < (insertedSessions ?? []).length; i++) {
    const dbSession      = insertedSessions![i]
    const proposed       = (sessions as ProposedSession[])[i]

    for (const cohort_id of proposed.cohort_ids) {
      cohortRows.push({
        session_id:    dbSession.id,
        cohort_id,
        time_slot_id:  dbSession.time_slot_id,
        academic_year: academic_year.trim(),
        semester,
      })
    }
  }

  if (cohortRows.length > 0) {
    const { error: cohortErr } = await admin
      .from('session_cohorts')
      .insert(cohortRows)

    if (cohortErr) {
      // Cohort insert failed — roll back the sessions we just inserted so we
      // don't leave orphaned timetable_sessions rows (Supabase JS has no
      // savepoints, so we do a manual cleanup).
      const sessionIds = (insertedSessions ?? []).map((s) => s.id)
      await admin
        .from('timetable_sessions')
        .delete()
        .in('id', sessionIds)

      return NextResponse.json({ error: cohortErr.message }, { status: 500 })
    }
  }

  return NextResponse.json({ count: (insertedSessions ?? []).length }, { status: 201 })
}