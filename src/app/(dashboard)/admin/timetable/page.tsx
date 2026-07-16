"use client"

import { useState } from "react"
import { useTimetableEntries, usePublishTimetable, SessionRow } from "@/hooks/useTimetable"
import { useTimeSlots } from "@/hooks/useTimeSlots"
import { useTimetableSSE } from "@/hooks/useTimetableSSE"
import { TimetableGrid } from "@/components/timetable/TimetableGrid"
import { GenerateModal } from "@/components/timetable/GenerateModal"
import { EntryModal } from "@/components/timetable/EntryModal"
import { PeriodSelector } from "@/components/timetable/PeriodSelector"
import { PageHeader } from "@/components/ui/PageHeader"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { Wand2, Plus, UploadCloud, EyeOff } from "lucide-react"
import type { Semester } from "@/lib/types/domain"

export default function AdminTimetablePage() {
  useTimetableSSE()

  const [academicYear, setAcademicYear] = useState("2025/2026")
  const [semester, setSemester] = useState<Semester>(1)

  const { data: sessions = [], isLoading } = useTimetableEntries(academicYear, semester)
  const { data: timeSlots = [] } = useTimeSlots()
  const publish = usePublishTimetable()

  const [generateOpen, setGenerateOpen] = useState(false)
  const [entryModalOpen, setEntryModalOpen] = useState(false)
  const [editing, setEditing] = useState<SessionRow | null>(null)

  function openAdd() {
    setEditing(null)
    setEntryModalOpen(true)
  }

  function openEdit(session: SessionRow) {
    setEditing(session)
    setEntryModalOpen(true)
  }

  const publishedCount = sessions.filter((s) => s.is_published).length
  const allPublished = sessions.length > 0 && publishedCount === sessions.length

  function handleTogglePublish() {
    publish.mutate({ academic_year: academicYear, semester, publish: !allPublished })
  }

  return (
    <>
      <PageHeader
        title="Timetable"
        description={
          sessions.length > 0
            ? `${sessions.length} session${sessions.length !== 1 ? "s" : ""} · ${publishedCount} published`
            : "Generate a draft with the solver, or add sessions manually"
        }
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" icon={Plus} onClick={openAdd}>
              Add session
            </Button>
            <Button icon={Wand2} onClick={() => setGenerateOpen(true)}>
              Generate
            </Button>
          </div>
        }
      />

      <div className="flex items-center justify-between mb-4">
        <PeriodSelector
          academicYear={academicYear}
          onAcademicYearChange={setAcademicYear}
          semester={semester}
          onSemesterChange={setSemester}
        />

        {sessions.length > 0 && (
          <Button
            variant={allPublished ? "secondary" : "primary"}
            icon={allPublished ? EyeOff : UploadCloud}
            loading={publish.isPending}
            onClick={handleTogglePublish}
          >
            {allPublished ? "Unpublish" : "Publish timetable"}
          </Button>
        )}
      </div>

      <Card className="p-4">
        {isLoading ? (
          <div className="px-5 py-12 text-center text-sm text-gray-400">Loading…</div>
        ) : (
          <TimetableGrid
            sessions={sessions}
            timeSlots={timeSlots}
            editable
            onEntryClick={openEdit}
            emptyTitle="No sessions for this period"
            emptyDescription={`Generate a draft with the solver, or add sessions manually for ${academicYear}, Semester ${semester}.`}
          />
        )}
      </Card>

      <GenerateModal
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        academicYear={academicYear}
        semester={semester}
      />

      <EntryModal
        open={entryModalOpen}
        onClose={() => setEntryModalOpen(false)}
        editing={editing}
        academicYear={academicYear}
        semester={semester}
      />
    </>
  )
}
