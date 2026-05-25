import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// ─── GET /api/timeslots ───────────────────────────────────────────────────────
// Returns all 25 pre-seeded time slots ordered by day then start time.
// Accessible to any authenticated user — the timetable grid and solver both
// need the full slot list regardless of role.
// No POST or DELETE: slots are fixed at seed time and never created/destroyed.

export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("time_slots")
    .select("*")
    .order("day_of_week")
    .order("start_time")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}