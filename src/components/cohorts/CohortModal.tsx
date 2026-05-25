"use client"

import { useEffect, useState } from "react"
import { Cohort } from "@/lib/types/domain"
import { useCreateCohort, useUpdateCohort } from "@/hooks/useCohorts"
import { useDepartments } from "@/hooks/useDepartments"
import { Button } from "@/components/ui/Button"
import { cn } from "@/lib/utils/cn"
import { X } from "lucide-react"

interface Props {
  open: boolean
  onClose: () => void
  editing?: Cohort | null
}

const YEAR_LEVELS = [
  { value: 1, label: "Year 1 (100 Level)" },
  { value: 2, label: "Year 2 (200 Level)" },
  { value: 3, label: "Year 3 (300 Level)" },
  { value: 4, label: "Year 4 (400 Level)" },
]

// Shared input class — keeps styling consistent with DepartmentModal
const inputCls = cn(
  "w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm bg-white",
  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
  "placeholder:text-gray-400 disabled:bg-gray-50 disabled:text-gray-400"
)

export function CohortModal({ open, onClose, editing }: Props) {
  const { data: departments = [] } = useDepartments()

  const [departmentId, setDepartmentId] = useState("")
  const [yearLevel, setYearLevel] = useState<number>(1)
  const [studentCount, setStudentCount] = useState<string>("0")

  const create = useCreateCohort()
  const update = useUpdateCohort()
  const loading = create.isPending || update.isPending

  // Populate form when editing an existing cohort, or reset when creating
  useEffect(() => {
    if (editing) {
      setDepartmentId(editing.department_id)
      setYearLevel(editing.year_level)
      setStudentCount(String(editing.student_count))
    } else {
      setDepartmentId("")
      setYearLevel(1)
      setStudentCount("0")
    }
  }, [editing, open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const payload = {
      department_id: departmentId,
      year_level: yearLevel,
      student_count: Number(studentCount),
    }

    if (editing) {
      await update.mutateAsync({ id: editing.id, ...payload })
    } else {
      await create.mutateAsync(payload)
    }
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal card */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-900">
            {editing ? "Edit cohort" : "Add cohort"}
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Department — disabled when editing (changing dept = different cohort) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Department
            </label>
            <select
              required
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              disabled={!!editing}
              className={inputCls}
            >
              <option value="" disabled>
                Select a department…
              </option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
            {editing && (
              <p className="text-xs text-gray-400 mt-1">
                Department cannot be changed after creation.
              </p>
            )}
          </div>

          {/* Year level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Year level
            </label>
            <select
              required
              value={yearLevel}
              onChange={(e) => setYearLevel(Number(e.target.value))}
              className={inputCls}
            >
              {YEAR_LEVELS.map((y) => (
                <option key={y.value} value={y.value}>
                  {y.label}
                </option>
              ))}
            </select>
          </div>

          {/* Student count */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Student count
            </label>
            <input
              type="number"
              required
              min={0}
              value={studentCount}
              onChange={(e) => setStudentCount(e.target.value)}
              placeholder="e.g. 120"
              className={inputCls}
            />
            <p className="text-xs text-gray-400 mt-1">
              Used for venue capacity checks during timetable generation.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
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
            >
              {editing ? "Save changes" : "Add cohort"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}