import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// ─── Helper ──────────────────────────────────────────────────────────────────

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

// ─── PUT /api/cohorts/[id] ────────────────────────────────────────────────────
// Updates year_level and/or student_count for a cohort.
// department_id is intentionally not editable after creation (changing
// department would make the cohort semantically a different cohort).

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const { year_level, student_count } = body

  // ── Validation ──────────────────────────────────────────────────────────────
  const level = Number(year_level)
  if (!level || level < 1 || level > 4) {
    return NextResponse.json(
      { error: "Year level must be 1, 2, 3, or 4" },
      { status: 400 }
    )
  }

  const count = Number(student_count)
  if (isNaN(count) || count < 0) {
    return NextResponse.json(
      { error: "Student count must be a non-negative number" },
      { status: 400 }
    )
  }

  // ── Update ──────────────────────────────────────────────────────────────────
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("cohorts")
    .update({ year_level: level, student_count: count })
    .eq("id", id)
    .select("*, departments(name, code)")
    .single()

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "A cohort for this department and year level already exists" },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

// ─── DELETE /api/cohorts/[id] ─────────────────────────────────────────────────
// Deletes a cohort. Blocked if the cohort is referenced by course_cohorts
// (i.e. courses are assigned to it) or by the students table.

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  // Check: any courses assigned to this cohort?
  const { count: courseCount } = await admin
    .from("course_cohorts")
    .select("*", { count: "exact", head: true })
    .eq("cohort_id", id)

  if (courseCount && courseCount > 0) {
    return NextResponse.json(
      {
        error:
          "Cannot delete this cohort — it is assigned to one or more courses. Remove those course assignments first.",
      },
      { status: 409 }
    )
  }

  // Check: any students enrolled in this cohort?
  const { count: studentCount } = await admin
    .from("students")
    .select("*", { count: "exact", head: true })
    .eq("cohort_id", id)

  if (studentCount && studentCount > 0) {
    return NextResponse.json(
      {
        error:
          "Cannot delete this cohort — it has enrolled students. Remove the students first.",
      },
      { status: 409 }
    )
  }

  // Safe to delete
  const { error } = await admin.from("cohorts").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return new NextResponse(null, { status: 204 })
}