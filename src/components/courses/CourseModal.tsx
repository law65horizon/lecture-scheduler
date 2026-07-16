"use client"

import { useEffect, useState } from "react"
import { useCohorts } from "@/hooks/useCohorts"
import { useLecturers } from "@/hooks/useLecturers"
import { useCreateCourse, useUpdateCourse, CourseRow } from "@/hooks/useCourses"
import { Button } from "@/components/ui/Button"
import { cn } from "@/lib/utils/cn"
import { X, Check } from "lucide-react"
import { VenueType, Semester } from "@/lib/types/domain"

interface Props {
  open: boolean
  onClose: () => void
  editing?: CourseRow | null
}

const VENUE_TYPE_OPTIONS: { value: VenueType; label: string }[] = [
  { value: "LECTURE_HALL", label: "Lecture Hall" },
  { value: "LAB", label: "Laboratory" },
  { value: "SEMINAR_ROOM", label: "Seminar Room" },
]

const YEAR_LABEL: Record<number, string> = {
  1: "Year 1",
  2: "Year 2",
  3: "Year 3",
  4: "Year 4",
}

// Year-level badge colours — consistent with cohorts page
const LEVEL_BADGE: Record<number, string> = {
  1: "bg-violet-50 text-violet-700 ring-violet-200",
  2: "bg-blue-50 text-blue-700 ring-blue-200",
  3: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  4: "bg-amber-50 text-amber-700 ring-amber-200",
}

const inputCls = cn(
  "w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm bg-white",
  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
  "placeholder:text-gray-400 disabled:bg-gray-50 disabled:text-gray-400"
)

export function CourseModal({ open, onClose, editing }: Props) {
  const { data: cohorts = [] } = useCohorts()
  const { data: lecturers = [] } = useLecturers()

  // ── Form state ────────────────────────────────────────────────────────────────
  const [code, setCode] = useState("")
  const [title, setTitle] = useState("")
  const [creditUnits, setCreditUnits] = useState("3")
  const [semester, setSemester] = useState<Semester>(1)
  const [requiredVenueType, setRequiredVenueType] = useState<VenueType | "">("")
  const [isRepeat, setIsRepeat] = useState(false)
  const [selectedCohortIds, setSelectedCohortIds] = useState<string[]>([])
  const [lecturerId, setLecturerId] = useState("")

  const create = useCreateCourse()
  const update = useUpdateCourse()
  const loading = create.isPending || update.isPending

  // Populate form when editing, reset when creating
  useEffect(() => {
    if (editing) {
      setCode(editing.code)
      setTitle(editing.title)
      setCreditUnits(String(editing.credit_units))
      setSemester(editing.semester)
      setRequiredVenueType(editing.required_venue_type ?? "")
      setIsRepeat(editing.is_repeat)
      setSelectedCohortIds(editing.cohorts.map((c) => c.id))
      setLecturerId(editing.lecturer?.id ?? "")
    } else {
      setCode("")
      setTitle("")
      setCreditUnits("3")
      setSemester(1)
      setRequiredVenueType("")
      setIsRepeat(false)
      setSelectedCohortIds([])
      setLecturerId("")
    }
  }, [editing, open])

  // ── Cohort multi-select toggle ────────────────────────────────────────────────
  function toggleCohort(cohortId: string) {
    setSelectedCohortIds((prev) =>
      prev.includes(cohortId)
        ? prev.filter((id) => id !== cohortId)
        : [...prev, cohortId]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const payload = {
      code,
      title,
      credit_units: Number(creditUnits),
      semester,
      required_venue_type: (requiredVenueType as VenueType) || null,
      is_repeat: isRepeat,
      cohort_ids: selectedCohortIds,
      lecturer_id: lecturerId,
    }

    if (editing) {
      await update.mutateAsync({ id: editing.id, ...payload })
    } else {
      await create.mutateAsync(payload)
    }
    onClose()
  }

  // ── Group cohorts by department for the multi-select UI ───────────────────────
  const groupedCohorts = cohorts.reduce<
    Record<string, { deptName: string; deptCode: string; items: typeof cohorts }>
  >((acc, cohort) => {
    const key = cohort.department_id
    if (!acc[key]) {
      acc[key] = {
        deptName: cohort.departments?.name ?? "Unknown",
        deptCode: cohort.departments?.code ?? "",
        items: [],
      }
    }
    acc[key].items.push(cohort)
    return acc
  }, {})

  const deptGroups = Object.entries(groupedCohorts).sort(([, a], [, b]) =>
    a.deptName.localeCompare(b.deptName)
  )

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal card — taller than other modals due to cohort multi-select */}
      <div style={{height: '90%', overflowY: 'scroll'}} className="relative bg-white rounded-2xl shadow-xl w-full max-w-xl mx-4 p-6 max-h-[90vh] overflow-y-scroll">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-semibold text-gray-900">
            {editing ? "Edit course" : "Add course"}
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Scrollable form body */}
        <form
        style={{paddingLeft: '10px', gap: '5px', display: 'flex', flexDirection:'column'}}
          onSubmit={handleSubmit}
          className="overflow-y-auto px-6 py-5 space-y-5 flex-1"
        >
          {/* Row: code + credit units */}
          <div className="p-2grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Course code
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. CSC 301"
                className={cn(inputCls, "uppercase")}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Credit units
              </label>
              <input
                type="number"
                required
                min={1}
                max={6}
                value={creditUnits}
                onChange={(e) => setCreditUnits(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Course title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Data Structures and Algorithms"
              className={inputCls}
            />
          </div>

          {/* Row: semester + venue type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Semester
              </label>
              <select
                value={semester}
                onChange={(e) => setSemester(Number(e.target.value) as Semester)}
                className={inputCls}
              >
                <option value={1}>Semester 1</option>
                <option value={2}>Semester 2</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Required venue type
              </label>
              <select
                value={requiredVenueType}
                onChange={(e) => setRequiredVenueType(e.target.value as VenueType | "")}
                className={inputCls}
              >
                <option value="">Any venue</option>
                {VENUE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Repeat toggle */}
          <div className="flex items-center justify-between py-2 px-3.5 rounded-lg border border-gray-200 bg-gray-50">
            <div>
              <p className="text-sm font-medium text-gray-700">Repeat course</p>
              <p className="text-xs text-gray-400">
                Repeat courses are scheduled twice per week instead of once.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isRepeat}
              onClick={() => setIsRepeat((v) => !v)}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent",
                "transition-colors duration-200 ease-in-out",
                "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                isRepeat ? "bg-blue-600" : "bg-gray-300"
              )}
            >
              <span
                style={{ transform: isRepeat ? "translateX(1rem)" : "translateX(0)" }}
                className="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ease-in-out"
              />
            </button>
          </div>

          {/* Lecturer single-select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Lecturer
            </label>
            <select
              required
              value={lecturerId}
              onChange={(e) => setLecturerId(e.target.value)}
              className={inputCls}
            >
              <option value="" disabled>
                Select a lecturer…
              </option>
              {lecturers
                .slice()
                .sort((a, b) =>
                  (a.profiles?.full_name ?? "").localeCompare(
                    b.profiles?.full_name ?? ""
                  )
                )
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.profiles?.full_name ?? "Unknown"} ({l.staff_id})
                  </option>
                ))}
            </select>
          </div>

          {/* Cohort multi-select — grouped by department */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Assigned cohorts
              {selectedCohortIds.length > 0 && (
                <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700">
                  {selectedCohortIds.length} selected
                </span>
              )}
            </label>

            {cohorts.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">
                No cohorts found. Add cohorts first.
              </p>
            ) : (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                {deptGroups.map(([deptId, group], groupIdx) => (
                  <div key={deptId}>
                    {/* Department header row */}
                    <div
                      
                      className={cn(
                        "px-3 py-2 bg-gray-50 border-b border-gray-100",
                        groupIdx > 0 && "border-t border-gray-100"
                      )}
                    >
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {group.deptName}
                      </span>
                      <span className="ml-2 text-xs text-gray-400">
                        ({group.deptCode})
                      </span>
                    </div>

                    {/* Cohort rows within this department */}
                    {group.items
                      .slice()
                      .sort((a, b) => a.year_level - b.year_level)
                      .map((cohort) => {
                        const selected = selectedCohortIds.includes(cohort.id)
                        return (
                          <button
                            key={cohort.id}
                            type="button"
                            onClick={() => toggleCohort(cohort.id)}
                            className={cn(
                              "w-full flex items-center justify-between px-3 py-2.5 text-left",
                              "border-b border-gray-50 last:border-0",
                              "transition-colors duration-100",
                              selected
                                ? "bg-blue-50"
                                : "hover:bg-gray-50"
                            )}
                          >
                            <div style={{gap: 5}} className="flex items-center gap-2.5">
                              {/* Checkbox indicator */}
                              <span
                                className={cn(
                                  "w-4 h-4 rounded flex items-center justify-center shrink-0",
                                  "border transition-colors",
                                  selected
                                    ? "bg-blue-600 border-blue-600"
                                    : "border-gray-300 bg-white"
                                )}
                              >
                                {selected && (
                                  <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                                )}
                              </span>
                              <span
                                className={cn(
                                  "text-sm",
                                  selected ? "text-blue-900 font-medium" : "text-gray-700"
                                )}
                              >
                                {YEAR_LABEL[cohort.year_level]}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span
                                style={{padding: '5px'}}
                                className={cn(
                                  "inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ring-1 ring-inset",
                                  LEVEL_BADGE[cohort.year_level]
                                )}
                              >
                                {cohort.year_level * 100} Level
                              </span>
                              <span className="text-xs text-gray-400">
                                {cohort.student_count} students
                              </span>
                            </div>
                          </button>
                        )
                      })}
                  </div>
                ))}
              </div>
            )}

            {selectedCohortIds.length === 0 && (
              <p className="text-xs text-red-500 mt-1">
                Select at least one cohort.
              </p>
            )}
          </div>
        </form>

        {/* Sticky footer with actions */}
        <div className="flex gap-2 px-6 py-4 border-t border-gray-100 shrink-0">
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            className="flex-1"
            loading={loading}
            onClick={handleSubmit}
            disabled={selectedCohortIds.length === 0 || !lecturerId}
          >
            {editing ? "Save changes" : "Add course"}
          </Button>
        </div>
      </div>
    </div>
  )
}