"use client"

import { useEffect, useState } from "react"
import { useCourses } from "@/hooks/useCourses"
import { useVenues } from "@/hooks/useVenues"
import { useLecturers } from "@/hooks/useLecturers"
import { useTimeSlots } from "@/hooks/useTimeSlots"
import { useCreateEntry, useUpdateEntry, useDeleteEntry, SessionRow } from "@/hooks/useTimetable"
import { Button } from "@/components/ui/Button"
import { cn } from "@/lib/utils/cn"
import { SHORT_DAY_NAMES, formatTimeSlot } from "@/lib/utils/days"
import { X, Check, Trash2 } from "lucide-react"
import type { Semester } from "@/lib/types/domain"

interface Props {
  open: boolean
  onClose: () => void
  /** null = add mode, otherwise edit mode for this existing session */
  editing?: SessionRow | null
  academicYear: string
  semester: Semester
}

const inputCls = cn(
  "w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm bg-white",
  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
  "placeholder:text-gray-400 disabled:bg-gray-50 disabled:text-gray-400"
)

// ─── Entry modal ────────────────────────────────────────────────────────────
//
// Lets an admin manually add a single session, or edit/delete an existing
// one. Every submission is checked against the same H1–H5 hard constraints
// the solver uses, server-side, before it is written.

export function EntryModal({ open, onClose, editing, academicYear, semester }: Props) {
  const { data: courses = [] } = useCourses()
  const { data: venues = [] } = useVenues()
  const { data: lecturers = [] } = useLecturers()
  const { data: timeSlots = [] } = useTimeSlots()

  const [courseId, setCourseId] = useState("")
  const [lecturerId, setLecturerId] = useState("")
  const [venueId, setVenueId] = useState("")
  const [timeSlotId, setTimeSlotId] = useState("")
  const [cohortIds, setCohortIds] = useState<string[]>([])
  const [confirmDelete, setConfirmDelete] = useState(false)

  const create = useCreateEntry()
  const update = useUpdateEntry()
  const del = useDeleteEntry()
  const loading = create.isPending || update.isPending

  const selectedCourse = courses.find((c) => c.id === courseId)

  // Populate form when editing, reset when adding — same pattern as
  // CourseModal / LecturerModal.
  useEffect(() => {
    if (editing) {
      setCourseId(editing.course_id)
      setLecturerId(editing.lecturer_id)
      setVenueId(editing.venue_id)
      setTimeSlotId(editing.time_slot_id)
      setCohortIds(editing.cohorts.map((c) => c.id))
    } else {
      setCourseId("")
      setLecturerId("")
      setVenueId("")
      setTimeSlotId("")
      setCohortIds([])
    }
    setConfirmDelete(false)
  }, [editing, open])

  // When adding a new session, picking a course pre-fills its usual lecturer
  // and cohorts — the admin can still override venue/time slot/cohorts.
  function handleCourseChange(id: string) {
    setCourseId(id)
    const course = courses.find((c) => c.id === id)
    if (course) {
      setLecturerId(course.lecturer?.id ?? "")
      setCohortIds(course.cohorts.map((c) => c.id))
    }
  }

  function toggleCohort(id: string) {
    setCohortIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      course_id: courseId,
      lecturer_id: lecturerId,
      venue_id: venueId,
      time_slot_id: timeSlotId,
      academic_year: academicYear,
      semester,
      cohort_ids: cohortIds,
    }
    if (editing) {
      await update.mutateAsync({ id: editing.id, ...payload })
    } else {
      await create.mutateAsync(payload)
    }
    onClose()
  }

  async function handleDelete() {
    if (!editing) return
    await del.mutateAsync(editing.id)
    onClose()
  }

  if (!open) return null

  const sortedSlots = timeSlots
    .slice()
    .sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-semibold text-gray-900">
            {editing ? "Edit session" : "Add session"}
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto px-6 py-5 space-y-5 flex-1">
          {/* Course */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Course</label>
            <select
              required
              disabled={!!editing}
              value={courseId}
              onChange={(e) => handleCourseChange(e.target.value)}
              className={inputCls}
            >
              <option value="" disabled>Select a course…</option>
              {courses
                .slice()
                .sort((a, b) => a.code.localeCompare(b.code))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.title}
                  </option>
                ))}
            </select>
            {editing && (
              <p className="text-xs text-gray-400 mt-1">
                Course can&apos;t be changed here — delete and re-add to schedule a different course.
              </p>
            )}
          </div>

          {/* Lecturer + venue */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Lecturer</label>
              <select
                required
                value={lecturerId}
                onChange={(e) => setLecturerId(e.target.value)}
                className={inputCls}
              >
                <option value="" disabled>Select…</option>
                {lecturers.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.profiles?.full_name ?? "Unknown"} ({l.staff_id})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Venue</label>
              <select
                required
                value={venueId}
                onChange={(e) => setVenueId(e.target.value)}
                className={inputCls}
              >
                <option value="" disabled>Select…</option>
                {venues
                  .filter((v) => v.is_active)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} (cap. {v.capacity})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Time slot */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Time slot</label>
            <select
              required
              value={timeSlotId}
              onChange={(e) => setTimeSlotId(e.target.value)}
              className={inputCls}
            >
              <option value="" disabled>Select…</option>
              {sortedSlots.map((s) => (
                <option key={s.id} value={s.id} disabled={!s.is_active}>
                  {SHORT_DAY_NAMES[s.day_of_week]} · {formatTimeSlot(s.start_time, s.end_time)}
                  {!s.is_active ? " (inactive)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Cohorts */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Cohorts attending
              {cohortIds.length > 0 && (
                <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700">
                  {cohortIds.length} selected
                </span>
              )}
            </label>
            {!selectedCourse ? (
              <p className="text-sm text-gray-400 py-2">Select a course to choose cohorts.</p>
            ) : selectedCourse.cohorts.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">This course has no cohorts assigned.</p>
            ) : (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                {selectedCourse.cohorts.map((cohort) => {
                  const selected = cohortIds.includes(cohort.id)
                  return (
                    <button
                      key={cohort.id}
                      type="button"
                      onClick={() => toggleCohort(cohort.id)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2.5 text-left",
                        "border-b border-gray-50 last:border-0 transition-colors duration-100",
                        selected ? "bg-blue-50" : "hover:bg-gray-50"
                      )}
                    >
                      <span
                        className={cn(
                          "w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-colors",
                          selected ? "bg-blue-600 border-blue-600" : "border-gray-300 bg-white"
                        )}
                      >
                        {selected && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                      </span>
                      <span className={cn("text-sm", selected ? "text-blue-900 font-medium" : "text-gray-700")}>
                        {cohort.departments?.code}/{cohort.year_level * 100} — {cohort.departments?.name}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
            {cohortIds.length === 0 && (
              <p className="text-xs text-red-500 mt-1">Select at least one cohort.</p>
            )}
          </div>

          {editing && confirmDelete && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-3">
              <p className="text-sm text-red-700 mb-2.5">Delete this session permanently?</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  className="flex-1"
                  loading={del.isPending}
                  onClick={handleDelete}
                >
                  Delete
                </Button>
              </div>
            </div>
          )}
        </form>

        <div className="flex items-center gap-2 px-6 py-4 border-t border-gray-100 shrink-0">
          {editing && !confirmDelete && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="p-2.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
              title="Delete session"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            className="flex-1"
            loading={loading}
            onClick={handleSubmit}
            disabled={!courseId || !lecturerId || !venueId || !timeSlotId || cohortIds.length === 0}
          >
            {editing ? "Save changes" : "Add session"}
          </Button>
        </div>
      </div>
    </div>
  )
}
