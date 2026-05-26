import { createAdminClient } from '@/lib/supabase/admin'
import { createClient }      from '@/lib/supabase/server'
import { NextResponse }       from 'next/server'

// ─── Helper ───────────────────────────────────────────────────────────────────

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'ADMIN') return null
  return user
}

// ─── POST /api/timetable/publish ─────────────────────────────────────────────
//
// Admin-only. Bulk-publishes or bulk-unpublishes every session for a given
// academic_year + semester. Used by the "Publish timetable" / "Unpublish"
// toggle on the admin timetable page.
//
// Body: { academic_year: string, semester: 1 | 2, publish: boolean }
//
// Response: { count: number }  — rows updated

export async function POST(request: Request) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { academic_year, semester, publish } = body

  if (!academic_year?.trim()) {
    return NextResponse.json({ error: 'academic_year is required' }, { status: 400 })
  }
  if (semester !== 1 && semester !== 2) {
    return NextResponse.json({ error: 'semester must be 1 or 2' }, { status: 400 })
  }
  if (typeof publish !== 'boolean') {
    return NextResponse.json({ error: 'publish must be a boolean' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('timetable_sessions')
    .update({ is_published: publish, updated_at: new Date().toISOString() })
    .eq('academic_year', academic_year.trim())
    .eq('semester', semester)
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ count: (data ?? []).length })
}