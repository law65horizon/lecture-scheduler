"use client"

import { useState } from "react"
import { useMyTimetable } from "@/hooks/useMyTimetable"
import { useTimeSlots } from "@/hooks/useTimeSlots"
import { useTimetableSSE } from "@/hooks/useTimetableSSE"
import { TimetableGrid } from "@/components/timetable/TimetableGrid"
import { PeriodSelector } from "@/components/timetable/PeriodSelector"
import { PageHeader } from "@/components/ui/PageHeader"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Printer } from "lucide-react"
import type { Semester } from "@/lib/types/domain"

export default function LecturerTimetablePage() {
  useTimetableSSE()

  const [academicYear, setAcademicYear] = useState("2025/2026")
  const [semester, setSemester] = useState<Semester>(1)

  const { data: sessions = [], isLoading } = useMyTimetable(academicYear, semester)
  const { data: timeSlots = [] } = useTimeSlots()

  return (
    <>
      <PageHeader
        title="My timetable"
        description={
          sessions.length > 0
            ? `${sessions.length} session${sessions.length !== 1 ? "s" : ""} this semester`
            : "Your published teaching sessions will appear here"
        }
        action={
          <Button variant="secondary" icon={Printer} onClick={() => window.print()} className="print:hidden">
            Print
          </Button>
        }
      />

      <PeriodSelector
        academicYear={academicYear}
        onAcademicYearChange={setAcademicYear}
        semester={semester}
        onSemesterChange={setSemester}
        className="mb-4"
      />

      <Card className="p-4">
        {isLoading ? (
          <div className="px-5 py-12 text-center text-sm text-gray-400">Loading…</div>
        ) : (
          <TimetableGrid
            sessions={sessions}
            timeSlots={timeSlots}
            showLecturer={false}
            emptyTitle="No published sessions"
            emptyDescription={`Nothing has been published for ${academicYear}, Semester ${semester} yet. Check back once the admin publishes the timetable.`}
          />
        )}
      </Card>
    </>
  )
}
