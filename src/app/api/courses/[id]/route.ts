import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// ─── Helper ───────────────────────────────────────────────────────────────────

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "ADMIN") return null
  return user
}

// ─── PUT /api/courses/[id] ────────────────────────────────────────────────────
// Updates course fields and replaces cohort + lecturer assignments entirely
// (delete existing junction rows, insert new ones). This is simpler and safer
// than diffing the sets — the operation is idempotent and avoids partial state.
// Body: { code, title, credit_units, semester, required_venue_type?,
//         is_repeat?, cohort_ids: string[], lecturer_id: string }

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const {
    code,
    title,
    credit_units,
    semester,
    required_venue_type = null,
    is_repeat = false,
    cohort_ids,
    lecturer_id,
  } = body

  // ── Validation ───────────────────────────────────────────────────────────────
  if (!code?.trim()) {
    return NextResponse.json({ error: "Course code is required" }, { status: 400 })
  }
  if (!title?.trim()) {
    return NextResponse.json({ error: "Course title is required" }, { status: 400 })
  }
  const units = Number(credit_units)
  if (!units || units < 1) {
    return NextResponse.json(
      { error: "Credit units must be a positive number" },
      { status: 400 }
    )
  }
  if (semester !== 1 && semester !== 2) {
    return NextResponse.json({ error: "Semester must be 1 or 2" }, { status: 400 })
  }
  if (!Array.isArray(cohort_ids) || cohort_ids.length === 0) {
    return NextResponse.json(
      { error: "At least one cohort must be assigned" },
      { status: 400 }
    )
  }
  if (!lecturer_id) {
    return NextResponse.json(
      { error: "A lecturer must be assigned" },
      { status: 400 }
    )
  }

  const admin = createAdminClient()

  // ── Step 1: Update the course row ─────────────────────────────────────────────
  const { error: courseError } = await admin
    .from("courses")
    .update({
      code: code.trim().toUpperCase(),
      title: title.trim(),
      credit_units: units,
      semester,
      required_venue_type: required_venue_type || null,
      is_repeat: Boolean(is_repeat),
    })
    .eq("id", id)

  if (courseError) {
    if (courseError.code === "23505") {
      return NextResponse.json(
        { error: "A course with this code already exists" },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: courseError.message }, { status: 500 })
  }

  // ── Step 2: Replace course_cohorts ────────────────────────────────────────────
  // Delete all existing rows for this course, then insert the new set.
  // course_cohorts has ON DELETE CASCADE from courses, but we're not deleting
  // the course — we need to manually replace the junction rows here.
  const { error: deleteCohortError } = await admin
    .from("course_cohorts")
    .delete()
    .eq("course_id", id)

  if (deleteCohortError) {
    return NextResponse.json({ error: deleteCohortError.message }, { status: 500 })
  }

  const { error: insertCohortError } = await admin
    .from("course_cohorts")
    .insert(cohort_ids.map((cohort_id: string) => ({ course_id: id, cohort_id })))

  if (insertCohortError) {
    return NextResponse.json({ error: insertCohortError.message }, { status: 500 })
  }

  // ── Step 3: Replace course_lecturers ──────────────────────────────────────────
  const { error: deleteLecturerError } = await admin
    .from("course_lecturers")
    .delete()
    .eq("course_id", id)

  if (deleteLecturerError) {
    return NextResponse.json({ error: deleteLecturerError.message }, { status: 500 })
  }

  const { error: insertLecturerError } = await admin
    .from("course_lecturers")
    .insert({ course_id: id, lecturer_id })

  if (insertLecturerError) {
    return NextResponse.json({ error: insertLecturerError.message }, { status: 500 })
  }

  // ── Step 4: Return the fully-joined updated course ────────────────────────────
  const { data: course, error: fetchError } = await admin
    .from("courses")
    .select(`
      id, code, title, credit_units, semester,
      required_venue_type, is_repeat, created_at,
      course_cohorts (
        cohort_id,
        cohorts (
          id, year_level, department_id, student_count,
          departments ( name, code )
        )
      ),
      course_lecturers (
        lecturer_id,
        lecturers (
          id, user_id, staff_id, department_id,
          departments ( name, code )
        )
      )
    `)
    .eq("id", id)
    .single()

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  // Fetch lecturer's profile name (bypasses RLS)
  const lecturerRow:any = course.course_lecturers[0]?.lecturers ?? null
  let lecturerProfile: { full_name: string } | null = null

  if (lecturerRow) {
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", lecturerRow.user_id)
      .single()
    lecturerProfile = profile ?? null
  }

  const cohorts = course.course_cohorts.map((cc) => cc.cohorts).filter(Boolean)
  const lecturer = lecturerRow ? { ...lecturerRow, profiles: lecturerProfile } : null

  return NextResponse.json({ ...course, cohorts, lecturer })
}

// ─── DELETE /api/courses/[id] ─────────────────────────────────────────────────
// Blocked if any timetable_sessions reference this course.
// Otherwise hard-deletes the course (junction rows cascade automatically).

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  // Guard: check for timetable sessions
  const { count } = await admin
    .from("timetable_sessions")
    .select("*", { count: "exact", head: true })
    .eq("course_id", id)

  if (count && count > 0) {
    return NextResponse.json(
      {
        error:
          "Cannot delete a course that has timetable sessions. Remove the sessions first.",
      },
      { status: 409 }
    )
  }

  // course_cohorts and course_lecturers cascade on DELETE, so one delete is enough
  const { error } = await admin.from("courses").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return new NextResponse(null, { status: 204 })
}