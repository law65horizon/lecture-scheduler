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

// ─── GET /api/venues ──────────────────────────────────────────────────────────
// Returns all venues (active and inactive) ordered by name.
// Accessible to any authenticated user — lecturers and students need the
// venue name when viewing their timetable.

export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("venues")
    .select("*")
    .order("name")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// ─── POST /api/venues ─────────────────────────────────────────────────────────
// Creates a new venue. Admin only.
// Body: { name, capacity, venue_type, is_active? }

export async function POST(request: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { name, capacity, venue_type, is_active = true } = body

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

  // ── Insert ──────────────────────────────────────────────────────────────────
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("venues")
    .insert({
      name: name.trim(),
      capacity: cap,
      venue_type,
      is_active: Boolean(is_active),
    })
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

  return NextResponse.json(data, { status: 201 })
}