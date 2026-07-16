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
// then writes them all to timetable_sessions + session_cohorts.
//
// Before inserting, we DELETE any existing UNPUBLISHED sessions for the same
// academic_year + semester so the admin can regenerate freely. Published
// sessions are never touched.
//
// Body: { sessions: ProposedSession[], academic_year: string, semester: 1 | 2 }
// Response: { count: number }

export async function POST(request: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { sessions, academic_year, semester } = body

  if (!Array.isArray(sessions) || sessions.length === 0) {
    return NextResponse.json({ error: 'sessions must be a non-empty array' }, { status: 400 })
  }
  if (!academic_year?.trim()) {
    return NextResponse.json({ error: 'academic_year is required' }, { status: 400 })
  }
  if (semester !== 1 && semester !== 2) {
    return NextResponse.json({ error: 'semester must be 1 or 2' }, { status: 400 })
  }

  const admin = createAdminClient()

  // ── Step 1: Delete existing UNPUBLISHED sessions for this year + semester ──
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
    is_published:  false,
    created_by:    user.id,
  }))

  const { data: insertedSessions, error: sessionErr } = await admin
    .from('timetable_sessions')
    .insert(sessionRows)
    .select('id, course_id, lecturer_id, venue_id, time_slot_id')

  if (sessionErr) {
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
  //
  // FIX: We match each inserted DB session back to its proposed session using
  // course_id + time_slot_id as a composite key — NOT by array index.
  //
  // Relying on array-index alignment is unsafe: PostgREST/Postgres does not
  // guarantee that bulk-insert RETURNING rows come back in the same order as
  // the input.  Mis-alignment would silently assign the wrong cohorts to the
  // wrong sessions — a silent data-corruption bug.
  //
  // course_id + time_slot_id is a safe key here because the solver guarantees
  // each course appears at most once per slot (H4), so the pair is unique
  // within any single commit batch.
  const dbSessionIndex = new Map<string, { id: string; time_slot_id: string }>(
    (insertedSessions ?? []).map((s) => [`${s.course_id}|${s.time_slot_id}`, s])
  )

  const cohortRows: {
    session_id:    string
    cohort_id:     string
    time_slot_id:  string
    academic_year: string
    semester:      number
  }[] = []

  for (const proposed of sessions as ProposedSession[]) {
    const key       = `${proposed.course_id}|${proposed.time_slot_id}`
    const dbSession = dbSessionIndex.get(key)

    if (!dbSession) {
      // Should never happen — every proposed session was just inserted above.
      // If it does, roll back cleanly rather than leaving orphaned rows.
      const sessionIds = (insertedSessions ?? []).map((s) => s.id)
      await admin.from('timetable_sessions').delete().in('id', sessionIds)
      return NextResponse.json(
        {
          error:
            `Could not match inserted session for course ${proposed.course_id} ` +
            `at slot ${proposed.time_slot_id}. Rolled back.`,
        },
        { status: 500 }
      )
    }

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
      // Roll back timetable_sessions so we don't leave orphaned rows.
      const sessionIds = (insertedSessions ?? []).map((s) => s.id)
      await admin.from('timetable_sessions').delete().in('id', sessionIds)
      return NextResponse.json({ error: cohortErr.message }, { status: 500 })
    }
  }

  return NextResponse.json({ count: (insertedSessions ?? []).length }, { status: 201 })
}