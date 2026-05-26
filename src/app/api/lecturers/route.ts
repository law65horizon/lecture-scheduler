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

// ─── GET /api/lecturers ───────────────────────────────────────────────────────
// Returns all lecturers with their department and profile (full_name, email).
// Accessible to any authenticated user.
//
// WHY TWO QUERIES:
// lecturers.user_id → auth.users ← profiles.id
// Both tables are siblings under auth.users, not parent/child. PostgREST can
// only follow declared foreign keys, so there is no direct FK from lecturers
// to profiles. We fetch each table separately and merge by user_id in code.

export async function GET() {
  const supabase = await createClient()
  // adminClient is needed for the profiles fetch — the RLS policy on profiles
  // is "read own profile only" (id = auth.uid()), so a regular client would
  // silently return an empty array for every row except the admin's own profile.
  const admin = createAdminClient()

  // Step 1: fetch all lecturers with their department
  const { data: lecturers, error: lecturerError } = await supabase
    .from("lecturers")
    .select(`
      id,
      user_id,
      staff_id,
      department_id,
      departments ( name, code )
    `)
    .order("staff_id")

  if (lecturerError) {
    return NextResponse.json({ error: lecturerError.message }, { status: 500 })
  }

  if (!lecturers || lecturers.length === 0) {
    return NextResponse.json([])
  }

  // Step 2: fetch profiles for all those user_ids — must use admin client to
  // bypass the "read own profile" RLS policy
  const userIds = lecturers.map((l) => l.user_id)
  const { data: profiles, error: profileError } = await admin
    .from("profiles")
    .select("id, full_name, email")
    .in("id", userIds)

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  // Step 3: build a lookup map keyed by user_id and merge
  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, { full_name: p.full_name, email: p.email }])
  )

  const merged = lecturers.map((l) => ({
    ...l,
    profiles: profileMap.get(l.user_id) ?? null,
  }))

  return NextResponse.json(merged)
}

// ─── POST /api/lecturers ──────────────────────────────────────────────────────
// Creates a Supabase Auth user (role: LECTURER) then inserts into lecturers.
// The handle_new_user trigger automatically creates the profiles row.
// Body: { full_name, email, password, staff_id, department_id }

export async function POST(request: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { full_name, email, password, staff_id, department_id } = body

  // ── Validation ───────────────────────────────────────────────────────────────
  if (!full_name?.trim()) {
    return NextResponse.json({ error: "Full name is required" }, { status: 400 })
  }
  if (!email?.trim()) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 })
  }
  if (!password || password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters" },
      { status: 400 }
    )
  }
  if (!staff_id?.trim()) {
    return NextResponse.json({ error: "Staff ID is required" }, { status: 400 })
  }
  if (!department_id) {
    return NextResponse.json({ error: "Department is required" }, { status: 400 })
  }

  const admin = createAdminClient()

  // ── Step 1: Create the Supabase Auth user ────────────────────────────────────
  // user_metadata is picked up by the handle_new_user trigger to populate
  // profiles.full_name and profiles.role.
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password,
    email_confirm: true, // skip confirmation email for admin-created accounts
    user_metadata: {
      full_name: full_name.trim(),
      role: "LECTURER",
    },
  })

  if (authError) {
    if (authError.message.toLowerCase().includes("already been registered")) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: authError.message }, { status: 500 })
  }

  const newUserId = authData.user.id

  // ── Step 2: Insert into lecturers table ──────────────────────────────────────
  const { data: newLecturer, error: lecturerError } = await admin
    .from("lecturers")
    .insert({
      user_id: newUserId,
      staff_id: staff_id.trim().toUpperCase(),
      department_id,
    })
    .select(`
      id,
      user_id,
      staff_id,
      department_id,
      departments ( name, code )
    `)
    .single()

  if (lecturerError) {
    // Auth user was created but the DB insert failed — clean up the orphaned auth user
    await admin.auth.admin.deleteUser(newUserId)

    if (lecturerError.code === "23505") {
      return NextResponse.json(
        { error: "A lecturer with this staff ID already exists" },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: lecturerError.message }, { status: 500 })
  }

  // ── Step 3: Fetch the profile the trigger just created ───────────────────────
  // Small delay is not needed — the trigger is synchronous, so by the time the
  // insert returns the profile row already exists.
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, email")
    .eq("id", newUserId)
    .single()

  return NextResponse.json(
    { ...newLecturer, profiles: profile ?? null },
    { status: 201 }
  )
}