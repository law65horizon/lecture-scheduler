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

// ─── GET /api/courses ─────────────────────────────────────────────────────────
// Returns all courses with their assigned cohorts and lecturer.
// Accessible to any authenticated user.
//
// Join structure:
//   courses
//     → course_cohorts → cohorts → departments   (one course has many cohorts)
//     → course_lecturers → lecturers              (one course has one lecturer)
//
// The lecturer's name lives in profiles (sibling to lecturers via auth.users),
// so — same as in /api/lecturers — we fetch profiles separately with the
// admin client to bypass the "read own profile" RLS policy.

export async function GET() {
  const supabase = await createClient()
  const admin = createAdminClient()

  // Step 1: fetch courses with cohort and lecturer id joins
  const { data: courses, error: coursesError } = await supabase
    .from("courses")
    .select(`
      id,
      code,
      title,
      credit_units,
      semester,
      required_venue_type,
      is_repeat,
      created_at,
      course_cohorts (
        cohort_id,
        cohorts (
          id,
          year_level,
          department_id,
          student_count,
          departments ( name, code )
        )
      ),
      course_lecturers (
        lecturer_id,
        lecturers (
          id,
          user_id,
          staff_id,
          department_id,
          departments ( name, code )
        )
      )
    `)
    .order("code")

  if (coursesError) {
    return NextResponse.json({ error: coursesError.message }, { status: 500 })
  }

  if (!courses || courses.length === 0) {
    return NextResponse.json([])
  }

  // Step 2: collect all unique lecturer user_ids so we can fetch their names
  const lecturerUserIds = [
    ...new Set(
      courses
        .flatMap((c:any) => c.course_lecturers)
        .map((cl) => cl.lecturers?.user_id)
        .filter((id): id is string => !!id)
    ),
  ]

  let profileMap = new Map<string, { full_name: string }>()

  if (lecturerUserIds.length > 0) {
    const { data: profiles, error: profileError } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", lecturerUserIds)

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    profileMap = new Map((profiles ?? []).map((p) => [p.id, { full_name: p.full_name }]))
  }

  // Step 3: reshape into a clean flat structure the client expects
  const shaped = courses.map((course) => {
    // Flatten cohorts — each course_cohort row wraps a cohort object
    const cohorts = course.course_cohorts
      .map((cc) => cc.cohorts)
      .filter(Boolean)

    // There is at most one lecturer per course (course_lecturers is 1:1 in practice)
    const clRow = course.course_lecturers[0] ?? null
    const lecturerRow:any = clRow?.lecturers ?? null
    const lecturerProfile = lecturerRow
      ? (profileMap.get(lecturerRow.user_id) ?? null)
      : null

    const lecturer = lecturerRow
      ? {
          id: lecturerRow.id,
          user_id: lecturerRow.user_id,
          staff_id: lecturerRow.staff_id,
          department_id: lecturerRow.department_id,
          departments: lecturerRow.departments,
          profiles: lecturerProfile,
        }
      : null

    return {
      id: course.id,
      code: course.code,
      title: course.title,
      credit_units: course.credit_units,
      semester: course.semester,
      required_venue_type: course.required_venue_type,
      is_repeat: course.is_repeat,
      created_at: course.created_at,
      cohorts,
      lecturer,
    }
  })

  return NextResponse.json(shaped)
}

// ─── POST /api/courses ────────────────────────────────────────────────────────
// Creates a course then inserts into course_cohorts and course_lecturers.
// All three inserts must succeed; if either junction table insert fails we
// delete the course row to avoid orphans (Supabase JS SDK has no savepoint
// support, so we do manual rollback).
// Body: { code, title, credit_units, semester, required_venue_type?,
//         is_repeat?, cohort_ids: string[], lecturer_id: string }

export async function POST(request: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

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
    return NextResponse.json(
      { error: "Semester must be 1 or 2" },
      { status: 400 }
    )
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

  // ── Step 1: Insert the course ─────────────────────────────────────────────────
  const { data: course, error: courseError } = await admin
    .from("courses")
    .insert({
      code: code.trim().toUpperCase(),
      title: title.trim(),
      credit_units: units,
      semester,
      required_venue_type: required_venue_type || null,
      is_repeat: Boolean(is_repeat),
    })
    .select("id")
    .single()

  if (courseError) {
    if (courseError.code === "23505") {
      return NextResponse.json(
        { error: "A course with this code already exists" },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: courseError.message }, { status: 500 })
  }

  const courseId = course.id

  // ── Step 2: Insert course_cohorts (one row per cohort) ────────────────────────
  const { error: cohortError } = await admin.from("course_cohorts").insert(
    cohort_ids.map((cohort_id: string) => ({ course_id: courseId, cohort_id }))
  )

  if (cohortError) {
    await admin.from("courses").delete().eq("id", courseId) // rollback
    return NextResponse.json({ error: cohortError.message }, { status: 500 })
  }

  // ── Step 3: Insert course_lecturers ───────────────────────────────────────────
  const { error: lecturerError } = await admin
    .from("course_lecturers")
    .insert({ course_id: courseId, lecturer_id })

  if (lecturerError) {
    await admin.from("courses").delete().eq("id", courseId) // rollback (cascades to course_cohorts)
    return NextResponse.json({ error: lecturerError.message }, { status: 500 })
  }

  // ── Return the full shaped course (re-use GET logic via a targeted fetch) ─────
  return fetchOneCourse(courseId, admin)
}

// ─── Shared helper: fetch one fully-joined course by id ───────────────────────
// Used by both POST (return the created course) and PUT (return the updated one)
// to avoid duplicating the join + profile-merge logic.

async function fetchOneCourse(courseId: string, admin: ReturnType<typeof createAdminClient>) {
  const { data: course, error } = await admin
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
    .eq("id", courseId)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Fetch lecturer profile
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
  const lecturer = lecturerRow
    ? { ...lecturerRow, profiles: lecturerProfile }
    : null

  return NextResponse.json(
    { ...course, cohorts, lecturer, course_cohorts: undefined, course_lecturers: undefined },
    { status: 201 }
  )
}