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

// ─── PATCH /api/timeslots/[id] ────────────────────────────────────────────────
// Toggles the is_active flag on a single time slot. Admin only.
// Only is_active may be changed — all other slot fields (day, times) are
// immutable because they are structural to the timetable model.
// Body: { is_active: boolean }

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await request.json()

  if (typeof body.is_active !== "boolean") {
    return NextResponse.json(
      { error: "is_active must be a boolean" },
      { status: 400 }
    )
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("time_slots")
    .update({ is_active: body.is_active })
    .eq("id", id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}