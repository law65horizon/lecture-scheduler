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

// ─── PUT /api/lecturers/[id] ──────────────────────────────────────────────────
// Updates a lecturer's profile (full_name) and lecturer row (staff_id,
// department_id). Email is not editable — it is the Supabase Auth identity.
// Body: { full_name, staff_id, department_id }

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const { full_name, staff_id, department_id } = body

  // ── Validation ───────────────────────────────────────────────────────────────
  if (!full_name?.trim()) {
    return NextResponse.json({ error: "Full name is required" }, { status: 400 })
  }
  if (!staff_id?.trim()) {
    return NextResponse.json({ error: "Staff ID is required" }, { status: 400 })
  }
  if (!department_id) {
    return NextResponse.json({ error: "Department is required" }, { status: 400 })
  }

  const admin = createAdminClient()

  // Fetch the lecturer's user_id so we can update the profiles row
  const { data: existing, error: fetchError } = await admin
    .from("lecturers")
    .select("user_id")
    .eq("id", id)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Lecturer not found" }, { status: 404 })
  }

  // ── Step 1: Update profiles.full_name ────────────────────────────────────────
  const { error: profileError } = await admin
    .from("profiles")
    .update({ full_name: full_name.trim() })
    .eq("id", existing.user_id)

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  // ── Step 2: Update the lecturers row ─────────────────────────────────────────
  const { data: updatedLecturer, error: lecturerError } = await admin
    .from("lecturers")
    .update({
      staff_id: staff_id.trim().toUpperCase(),
      department_id,
    })
    .eq("id", id)
    .select(`
      id,
      user_id,
      staff_id,
      department_id,
      departments ( name, code )
    `)
    .single()

  if (lecturerError) {
    if (lecturerError.code === "23505") {
      return NextResponse.json(
        { error: "A lecturer with this staff ID already exists" },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: lecturerError.message }, { status: 500 })
  }

  // ── Step 3: Fetch the freshly-updated profile and merge ──────────────────────
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, email")
    .eq("id", existing.user_id)
    .single()

  return NextResponse.json({ ...updatedLecturer, profiles: profile ?? null })
}

// ─── DELETE /api/lecturers/[id] ───────────────────────────────────────────────
// Blocks deletion if the lecturer has any assigned courses or timetable
// sessions. Otherwise deletes the lecturers row AND the Auth user (which
// cascades to the profiles row via the FK).

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  // Fetch the lecturer so we have their user_id for Auth cleanup
  const { data: existing, error: fetchError } = await admin
    .from("lecturers")
    .select("user_id")
    .eq("id", id)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Lecturer not found" }, { status: 404 })
  }

  // ── Guard: check for assigned courses ────────────────────────────────────────
  const { count: courseCount } = await admin
    .from("course_lecturers")
    .select("*", { count: "exact", head: true })
    .eq("lecturer_id", id)

  if (courseCount && courseCount > 0) {
    return NextResponse.json(
      {
        error:
          "Cannot delete a lecturer who is assigned to courses. Remove their course assignments first.",
      },
      { status: 409 }
    )
  }

  // ── Guard: check for timetable sessions ──────────────────────────────────────
  const { count: sessionCount } = await admin
    .from("timetable_sessions")
    .select("*", { count: "exact", head: true })
    .eq("lecturer_id", id)

  if (sessionCount && sessionCount > 0) {
    return NextResponse.json(
      {
        error:
          "Cannot delete a lecturer who has timetable sessions. Remove their sessions first.",
      },
      { status: 409 }
    )
  }

  // ── Delete the lecturers row ──────────────────────────────────────────────────
  // The schema has: lecturers.user_id references auth.users ON DELETE CASCADE,
  // so deleting the auth user would cascade here. We go the other direction:
  // delete the lecturers row first, then delete the auth user (which cascades
  // to profiles via profiles.id → auth.users ON DELETE CASCADE).
  const { error: deleteError } = await admin
    .from("lecturers")
    .delete()
    .eq("id", id)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  // ── Delete the Supabase Auth user (cascades to profiles) ─────────────────────
  const { error: authDeleteError } = await admin.auth.admin.deleteUser(
    existing.user_id
  )

  if (authDeleteError) {
    // Lecturer row is gone — log but don't surface this to the admin
    console.error("Failed to delete auth user:", authDeleteError.message)
  }

  return new NextResponse(null, { status: 204 })
}