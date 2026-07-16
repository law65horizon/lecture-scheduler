import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'

// ─── useTimetableSSE ────────────────────────────────────────────────────────
//
// Subscribes to Supabase Realtime changes on `timetable_sessions`. Whenever
// any row is inserted, updated, or deleted — by anyone, from any client —
// this invalidates both the admin and "my timetable" query caches so every
// open tab picks up the change automatically, and shows a subtle toast.
//
// Mount this once per timetable page (admin, lecturer, student).

export function useTimetableSSE() {
  const queryClient = useQueryClient()
  const mounted = useRef(false)

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('timetable-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'timetable_sessions' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['timetable'] })
          queryClient.invalidateQueries({ queryKey: ['my-timetable'] })

          // Skip the toast on the very first callback some setups fire on
          // initial subscribe — only announce genuine live updates.
          if (mounted.current) {
            toast('Timetable updated', { icon: '🔄' })
          }
          mounted.current = true
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])
}
