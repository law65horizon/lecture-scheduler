"use client"

import { cn } from "@/lib/utils/cn"
import { SHORT_DAY_NAMES, formatTimeSlot } from "@/lib/utils/days"
import { EntryCard } from "@/components/timetable/EntryCard"
import { EmptyState } from "@/components/ui/EmptyState"
import { CalendarX2 } from "lucide-react"
import type { DayOfWeek, TimeSlot } from "@/lib/types/domain"
import type { SessionRow } from "@/hooks/useTimetable"

interface Props {
  sessions: SessionRow[]
  timeSlots: TimeSlot[]
  showLecturer?: boolean
  showCohorts?: boolean
  editable?: boolean
  onEntryClick?: (session: SessionRow) => void
  emptyTitle?: string
  emptyDescription?: string
}

const DAYS: DayOfWeek[] = [1, 2, 3, 4, 5]

// ─── Timetable grid ─────────────────────────────────────────────────────────
//
// Days (Mon–Fri) run across the top, distinct time ranges run down the side.
// Each cell can hold more than one card — different courses can occupy the
// same time slot in different venues simultaneously, so cells stack cards
// rather than assuming a single session per slot.

export function TimetableGrid({
  sessions,
  timeSlots,
  showLecturer = true,
  showCohorts = true,
  editable = false,
  onEntryClick,
  emptyTitle = "No sessions scheduled",
  emptyDescription = "There is nothing on the timetable for this academic year and semester yet.",
}: Props) {
  if (timeSlots.length === 0) {
    return (
      <EmptyState
        icon={CalendarX2}
        title="No time slots configured"
        description="Ask an admin to set up time slots before a timetable can be displayed."
      />
    )
  }

  // Distinct time ranges, sorted — these become the rows.
  const rowMap = new Map<string, { start: string; end: string }>()
  for (const slot of timeSlots) {
    const key = `${slot.start_time}-${slot.end_time}`
    if (!rowMap.has(key)) rowMap.set(key, { start: slot.start_time, end: slot.end_time })
  }
  const rows = [...rowMap.values()].sort((a, b) => a.start.localeCompare(b.start))

  // slot lookup: "day-start" -> TimeSlot
  const slotLookup = new Map<string, TimeSlot>()
  for (const slot of timeSlots) {
    slotLookup.set(`${slot.day_of_week}-${slot.start_time}`, slot)
  }

  // sessions grouped by time_slot_id
  const sessionsBySlot = new Map<string, SessionRow[]>()
  for (const s of sessions) {
    if (!s.time_slot_id) continue
    const arr = sessionsBySlot.get(s.time_slot_id) ?? []
    arr.push(s)
    sessionsBySlot.set(s.time_slot_id, arr)
  }

  if (sessions.length === 0) {
    return <EmptyState icon={CalendarX2} title={emptyTitle} description={emptyDescription} />
  }

  return (
    <div className="overflow-x-auto">
      <div
        className="grid min-w-[860px]"
        style={{ gridTemplateColumns: `100px repeat(5, minmax(150px, 1fr))` }}
      >
        {/* Header row */}
        <div className="sticky left-0 bg-white" />
        {DAYS.map((day) => (
          <div
            key={day}
            className="px-2 py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100"
          >
            {SHORT_DAY_NAMES[day]}
          </div>
        ))}

        {/* Body rows */}
        {rows.map((row, rowIdx) => (
          <RowFragment key={row.start} rowIdx={rowIdx}>
            <div className="sticky left-0 bg-white px-2 py-3 text-[11px] text-gray-400 border-b border-gray-50 flex items-start">
              {formatTimeSlot(row.start, row.end)}
            </div>
            {DAYS.map((day) => {
              const slot = slotLookup.get(`${day}-${row.start}`)
              const cellSessions = slot ? sessionsBySlot.get(slot.id) ?? [] : []
              return (
                <div
                  key={day}
                  className={cn(
                    "px-1.5 py-1.5 border-b border-l border-gray-50 min-h-[70px] space-y-1.5",
                    slot && !slot.is_active && "bg-gray-50/60"
                  )}
                >
                  {cellSessions.map((s) => (
                    <EntryCard
                      key={s.id}
                      session={s}
                      showLecturer={showLecturer}
                      showCohorts={showCohorts}
                      editable={editable}
                      onClick={onEntryClick ? () => onEntryClick(s) : undefined}
                    />
                  ))}
                </div>
              )
            })}
          </RowFragment>
        ))}
      </div>
    </div>
  )
}

// Small helper so each row's cells participate in the outer CSS grid
// (React requires a real wrapper element list, not a Fragment, for grid children).
function RowFragment({ children }: { rowIdx: number; children: React.ReactNode }) {
  return <>{children}</>
}
