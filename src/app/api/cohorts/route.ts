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

// ─── GET /api/cohorts ─────────────────────────────────────────────────────────
// Returns all cohorts joined with their department (name + code).
// Accessible to any authenticated user (students, lecturers, admins all need
// the cohort list for display purposes).

export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("cohorts")
    .select("*, departments(name, code)")
    .order("department_id")
    .order("year_level")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// ─── POST /api/cohorts ────────────────────────────────────────────────────────
// Creates a new cohort. Admin only.
// Body: { department_id: string, year_level: 1|2|3|4, student_count: number }

export async function POST(request: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { department_id, year_level, student_count } = body

  // ── Validation ──────────────────────────────────────────────────────────────
  if (!department_id) {
    return NextResponse.json({ error: "Department is required" }, { status: 400 })
  }

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

  // ── Insert ──────────────────────────────────────────────────────────────────
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("cohorts")
    .insert({ department_id, year_level: level, student_count: count })
    .select("*, departments(name, code)")
    .single()

  if (error) {
    // Unique constraint: (department_id, year_level)
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "A cohort for this department and year level already exists" },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}