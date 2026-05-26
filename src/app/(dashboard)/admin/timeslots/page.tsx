"use client"

import { useTimeSlots, useToggleTimeSlot } from "@/hooks/useTimeSlots"
import { PageHeader } from "@/components/ui/PageHeader"
import { Card } from "@/components/ui/Card"
import { TimeSlot, DayOfWeek } from "@/lib/types/domain"
import { DAY_NAMES, formatTimeSlot } from "@/lib/utils/days"
import { cn } from "@/lib/utils/cn"

// The 5 fixed time blocks that appear as row headers (08:00–18:00, 2-hr slots)
const TIME_BLOCKS = [
  { start: "08:00:00", end: "10:00:00", label: "08:00 – 10:00" },
  { start: "10:00:00", end: "12:00:00", label: "10:00 – 12:00" },
  { start: "12:00:00", end: "14:00:00", label: "12:00 – 14:00" },
  { start: "14:00:00", end: "16:00:00", label: "14:00 – 16:00" },
  { start: "16:00:00", end: "18:00:00", label: "16:00 – 18:00" },
]

const DAYS: DayOfWeek[] = [1, 2, 3, 4, 5] 

export default function TimeSlotsPage() {
  const { data: slots, isLoading } = useTimeSlots()
  const toggle = useToggleTimeSlot()

  // Build a lookup: "day-start" → TimeSlot for O(1) cell access
  const slotMap = new Map<string, TimeSlot>()
  slots?.forEach((s) => {
    slotMap.set(`${s.day_of_week}-${s.start_time}`, s)
  })

  const activeCount = slots?.filter((s) => s.is_active).length ?? 0
  const totalCount = slots?.length ?? 0

  return (
    <>
      <PageHeader
        title="Time Slots"
        description={
          totalCount > 0
            ? `${activeCount} of ${totalCount} slots active — inactive slots are excluded from timetable generation`
            : "Configure which weekly time slots are available for scheduling"
        }
      />

      <Card>
        {isLoading ? (
          <div className="px-5 py-12 text-center text-sm text-gray-400">
            Loading…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {/* Row header column */}
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide w-32">
                    Time
                  </th>
                  {DAYS.map((day) => (
                    <th
                      key={day}
                      className="px-3 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide text-center"
                    >
                      {DAY_NAMES[day]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {TIME_BLOCKS.map((block) => (
                  <tr key={block.start} className="hover:bg-gray-50/30 transition-colors">
                    {/* Time label */}
                    <td className="px-5 py-3 text-xs font-medium text-gray-500 whitespace-nowrap">
                      {block.label}
                    </td>

                    {/* One toggle cell per day */}
                    {DAYS.map((day) => {
                      const slot = slotMap.get(`${day}-${block.start}`)
                      if (!slot) {
                        // Shouldn't happen with a full seed, but handle gracefully
                        return (
                          <td key={day} className="px-3 py-3 text-center">
                            <span className="text-xs text-gray-300">—</span>
                          </td>
                        )
                      }

                      const isPending =
                        toggle.isPending &&
                        toggle.variables?.id === slot.id

                      return (
                        <td key={day} className="px-3 py-3 text-center">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={slot.is_active}
                            aria-label={`${DAY_NAMES[day]} ${formatTimeSlot(slot.start_time, slot.end_time)} — ${slot.is_active ? "active" : "inactive"}`}
                            disabled={isPending}
                            onClick={() =>
                            {
                              toggle.mutate({
                                id: slot.id,
                                is_active: !slot.is_active,
                              })
                            }
                            }
                            className={cn(
                              "mx-auto flex items-center justify-center w-8 h-8 rounded-lg border transition-colors duration-100",
                              "focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500",
                              "disabled:opacity-40 disabled:cursor-not-allowed",
                              slot.is_active
                                ? "bg-blue-600 border-blue-600 hover:bg-blue-700 text-white"
                                : "bg-white border-gray-200 hover:bg-gray-50 text-gray-300"
                            )}
                          >
                            {isPending ? (
                              // Tiny spinner while the PATCH is in-flight
                              <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <span
                                className={cn(
                                  "w-2 h-2 rounded-full",
                                  slot.is_active ? "bg-white" : "bg-gray-300"
                                )}
                              />
                            )}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Legend */}
            <div className="flex items-center gap-4 px-5 py-3 border-t border-gray-100 mt-1">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="w-4 h-4 rounded bg-blue-600 inline-block" />
                Active — available for scheduling
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="w-4 h-4 rounded bg-white border border-gray-200 inline-block" />
                Inactive — excluded from generation
              </div>
            </div>
          </div>
        )}
      </Card>
    </>
  )
}