"use client"

import { cn } from "@/lib/utils/cn"
import type { Semester } from "@/lib/types/domain"

interface Props {
  academicYear: string
  onAcademicYearChange: (value: string) => void
  semester: Semester
  onSemesterChange: (value: Semester) => void
  className?: string
}

const inputCls = cn(
  "px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white",
  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
  "placeholder:text-gray-400"
)

// ─── Period selector ────────────────────────────────────────────────────────
//
// A small pair of controls — academic year (free text, e.g. "2025/2026") and
// semester (1 or 2) — used to scope which timetable is being viewed. Shared
// across the admin, lecturer, and student timetable pages so the UX stays
// consistent everywhere a "which timetable" question needs answering.

export function PeriodSelector({
  academicYear,
  onAcademicYearChange,
  semester,
  onSemesterChange,
  className,
}: Props) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <input
        type="text"
        value={academicYear}
        onChange={(e) => onAcademicYearChange(e.target.value)}
        placeholder="2025/2026"
        className={cn(inputCls, "w-32 print:hidden")}
      />
      <select
        value={semester}
        onChange={(e) => onSemesterChange(Number(e.target.value) as Semester)}
        className={cn(inputCls, "print:hidden")}
      >
        <option value={1}>Semester 1</option>
        <option value={2}>Semester 2</option>
      </select>
    </div>
  )
}
