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

const VALID_VENUE_TYPES = ["LECTURE_HALL", "LAB", "SEMINAR_ROOM"] as const

// ─── PUT /api/venues/[id] ─────────────────────────────────────────────────────
// Updates all editable venue fields. Admin only.
// Body: { name, capacity, venue_type, is_active }

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const { name, capacity, venue_type, is_active } = body

  // ── Validation ──────────────────────────────────────────────────────────────
  if (!name?.trim()) {
    return NextResponse.json({ error: "Venue name is required" }, { status: 400 })
  }

  const cap = Number(capacity)
  if (!cap || cap < 1) {
    return NextResponse.json(
      { error: "Capacity must be a positive number" },
      { status: 400 }
    )
  }

  if (!VALID_VENUE_TYPES.includes(venue_type)) {
    return NextResponse.json(
      { error: "Venue type must be LECTURE_HALL, LAB, or SEMINAR_ROOM" },
      { status: 400 }
    )
  }

  // ── Update ──────────────────────────────────────────────────────────────────
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("venues")
    .update({
      name: name.trim(),
      capacity: cap,
      venue_type,
      is_active: Boolean(is_active),
    })
    .eq("id", id)
    .select()
    .single()

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "A venue with this name already exists" },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

// ─── DELETE /api/venues/[id] ──────────────────────────────────────────────────
// Soft-deletes a venue by setting is_active = false.
// A hard delete is blocked if the venue is referenced by any timetable session,
// so soft delete is the safer and reversible approach here.
// If the venue has NO sessions at all, we do a hard delete to keep the DB clean.

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  // Check if this venue is used in any timetable session
  const { count } = await admin
    .from("timetable_sessions")
    .select("*", { count: "exact", head: true })
    .eq("venue_id", id)

  if (count && count > 0) {
    // Venue is in use — soft delete only (mark inactive, keep row)
    const { data, error } = await admin
      .from("venues")
      .update({ is_active: false })
      .eq("id", id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    // Return the updated row so the client can reflect the new status
    return NextResponse.json({ ...data, softDeleted: true })
  }

  // Venue has no sessions — hard delete
  const { error } = await admin.from("venues").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return new NextResponse(null, { status: 204 })
}