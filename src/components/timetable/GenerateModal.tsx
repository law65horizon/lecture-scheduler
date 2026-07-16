"use client"

import { useMemo, useState } from "react"
import { useCourses } from "@/hooks/useCourses"
import { useVenues } from "@/hooks/useVenues"
import { useLecturers } from "@/hooks/useLecturers"
import { useTimeSlots } from "@/hooks/useTimeSlots"
import {
  useGenerateTimetable,
  useCommitTimetable,
  ProposedSessionRow,
  SessionRow,
} from "@/hooks/useTimetable"
import { TimetableGrid } from "@/components/timetable/TimetableGrid"
import { Button } from "@/components/ui/Button"
import { X, Wand2, AlertTriangle, CheckCircle2 } from "lucide-react"
import type { Semester } from "@/lib/types/domain"

interface Props {
  open: boolean
  onClose: () => void
  academicYear: string
  semester: Semester
}

type Phase = "form" | "preview"

// ─── Generate modal ─────────────────────────────────────────────────────────
//
// Admin runs the backtracking CSP solver against the current data, reviews
// the proposed draft in a read-only grid, then either commits it (writes to
// timetable_sessions as unpublished sessions) or discards it and closes.

export function GenerateModal({ open, onClose, academicYear, semester }: Props) {
  const { data: courses = [] } = useCourses()
  const { data: venues = [] } = useVenues()
  const { data: lecturers = [] } = useLecturers()
  const { data: timeSlots = [] } = useTimeSlots()

  const [phase, setPhase] = useState<Phase>("form")
  const [proposed, setProposed] = useState<ProposedSessionRow[]>([])
  const [failure, setFailure] = useState<{ reason: string; courseCode?: string | null } | null>(null)

  const generate = useGenerateTimetable()
  const commit = useCommitTimetable()

  // Build display-shaped SessionRow objects from the proposed (id-only) rows
  // by joining against the reference data already cached client-side.
  const previewSessions: SessionRow[] = useMemo(() => {
    const courseMap = new Map(courses.map((c) => [c.id, c]))
    const venueMap = new Map(venues.map((v) => [v.id, v]))
    const lecturerMap = new Map(lecturers.map((l) => [l.id, l]))
    const slotMap = new Map(timeSlots.map((s) => [s.id, s]))
    const cohortMap = new Map(
      courses.flatMap((c) => c.cohorts.map((co) => [co.id, co] as const))
    )

    return proposed.map((p, i) => {
      const course = courseMap.get(p.course_id)
      const lecturer = lecturerMap.get(p.lecturer_id)
      return {
        id: `draft-${i}`,
        course_id: p.course_id,
        lecturer_id: p.lecturer_id,
        venue_id: p.venue_id,
        time_slot_id: p.time_slot_id,
        academic_year: p.academic_year,
        semester: p.semester,
        is_published: false,
        created_at: "",
        course: course
          ? {
              id: course.id,
              code: course.code,
              title: course.title,
              credit_units: course.credit_units,
              semester: course.semester,
              required_venue_type: course.required_venue_type,
              is_repeat: course.is_repeat,
            }
          : null,
        venue: venueMap.get(p.venue_id) ?? null,
        time_slot: slotMap.get(p.time_slot_id) ?? null,
        lecturer: lecturer
          ? { id: lecturer.id, staff_id: lecturer.staff_id, full_name: lecturer.profiles?.full_name ?? null }
          : null,
        cohorts: p.cohort_ids
          .map((id) => cohortMap.get(id))
          .filter((c): c is NonNullable<typeof c> => !!c),
      }
    })
  }, [proposed, courses, venues, lecturers, timeSlots])

  async function handleGenerate() {
    setFailure(null)
    try {
      const sessions = await generate.mutateAsync({ academic_year: academicYear, semester })
      setProposed(sessions)
      setPhase("preview")
    } catch (err) {
      // useGenerateTimetable already toasts the error; also surface it inline
      // with the course code if the solver identified where it got stuck.
      setFailure({ reason: (err as Error).message })
      setPhase("preview")
    }
  }

  async function handleCommit() {
    await commit.mutateAsync({ sessions: proposed, academic_year: academicYear, semester })
    handleClose()
  }

  function handleClose() {
    setPhase("form")
    setProposed([])
    setFailure(null)
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Generate timetable</h2>
            <p className="text-xs text-gray-400 mt-0.5">{academicYear} · Semester {semester}</p>
          </div>
          <button
            onClick={handleClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5">
          {phase === "form" && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-4">
                <Wand2 className="w-6 h-6 text-blue-600" />
              </div>
              <p className="text-sm font-medium text-gray-900 mb-1">
                Run the constraint solver
              </p>
              <p className="text-sm text-gray-400 max-w-sm">
                This schedules every course for {academicYear}, Semester {semester} against
                venues and lecturers, respecting all hard constraints. Nothing is saved until
                you review and confirm.
              </p>
            </div>
          )}

          {phase === "preview" && failure && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <p className="text-sm font-medium text-gray-900 mb-1">Solver could not find a valid timetable</p>
              <p className="text-sm text-gray-500 max-w-md">{failure.reason}</p>
              {failure.courseCode && (
                <p className="text-xs text-gray-400 mt-2 font-mono">
                  Stuck on: {failure.courseCode}
                </p>
              )}
            </div>
          )}

          {phase === "preview" && !failure && (
            <div>
              <div className="flex items-center gap-2 mb-4 px-3.5 py-2.5 rounded-lg bg-emerald-50 text-emerald-700 text-sm">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {proposed.length} session{proposed.length !== 1 ? "s" : ""} proposed. Review below,
                then confirm to save as an unpublished draft.
              </div>
              <TimetableGrid sessions={previewSessions} timeSlots={timeSlots} />
            </div>
          )}
        </div>

        <div className="flex gap-2 px-6 py-4 border-t border-gray-100 shrink-0">
          {phase === "form" && (
            <>
              <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                type="button"
                icon={Wand2}
                className="flex-1"
                loading={generate.isPending}
                onClick={handleGenerate}
              >
                Generate
              </Button>
            </>
          )}
          {phase === "preview" && (
            <>
              <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>
                Discard
              </Button>
              {failure ? (
                <Button type="button" className="flex-1" onClick={() => setPhase("form")}>
                  Try again
                </Button>
              ) : (
                <Button
                  type="button"
                  className="flex-1"
                  loading={commit.isPending}
                  onClick={handleCommit}
                >
                  Confirm and save draft
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
