"use client"

import { useState } from "react"
import { useCourses, useDeleteCourse, CourseRow } from "@/hooks/useCourses"
import { CourseModal } from "@/components/courses/CourseModal"
import { PageHeader } from "@/components/ui/PageHeader"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { EmptyState } from "@/components/ui/EmptyState"
import { Plus, BookOpen, Pencil, Trash2, RefreshCw } from "lucide-react"
import { VenueType, Semester } from "@/lib/types/domain"
import { cn } from "@/lib/utils/cn"

// ─── Display helpers ──────────────────────────────────────────────────────────

const VENUE_LABEL: Record<VenueType, string> = {
  LECTURE_HALL: "Lecture Hall",
  LAB: "Lab",
  SEMINAR_ROOM: "Seminar",
}

const SEMESTER_BADGE: Record<Semester, string> = {
  1: "bg-sky-50 text-sky-700 ring-sky-200",
  2: "bg-orange-50 text-orange-700 ring-orange-200",
}

const YEAR_BADGE: Record<number, string> = {
  1: "bg-violet-50 text-violet-700",
  2: "bg-blue-50 text-blue-700",
  3: "bg-emerald-50 text-emerald-700",
  4: "bg-amber-50 text-amber-700",
}

export default function AdminCoursesPage() {
  const { data: courses, isLoading } = useCourses()
  const deleteCourse = useDeleteCourse()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CourseRow | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<CourseRow | null>(null)

  function openCreate() {
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(course: CourseRow) {
    setEditing(course)
    setModalOpen(true)
  }

  async function handleDelete() {
    if (!confirmDelete) return
    await deleteCourse.mutateAsync(confirmDelete.id)
    setConfirmDelete(null)
  }

  const total = courses?.length ?? 0

  return (
    <>
      <PageHeader
        title="Courses"
        description={
          total > 0
            ? `${total} course${total !== 1 ? "s" : ""} across both semesters`
            : "Add courses and assign them to cohorts and lecturers"
        }
        action={
          <Button icon={Plus} onClick={openCreate}>
            Add course
          </Button>
        }
      />

      <Card>
        {isLoading ? (
          <div className="px-5 py-12 text-center text-sm text-gray-400">
            Loading…
          </div>
        ) : total === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No courses yet"
            description="Add courses and assign them to cohorts and a lecturer. Courses are the building blocks the timetable solver schedules around."
            action={
              <Button icon={Plus} onClick={openCreate}>
                Add course
              </Button>
            }
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">
                  Code
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">
                  Title
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">
                  Sem
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">
                  Cohorts
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">
                  Lecturer
                </th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {courses!
                .slice()
                .sort((a, b) => a.code.localeCompare(b.code))
                .map((course) => (
                  <tr
                    key={course.id}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    {/* Code + repeat indicator */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-medium text-gray-900">
                          {course.code}
                        </span>
                        {course.is_repeat && (
                          <span
                            title="Repeat course — scheduled twice per week"
                            className="text-gray-400"
                          >
                            <RefreshCw className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {course.credit_units} unit{course.credit_units !== 1 ? "s" : ""}
                        {course.required_venue_type && (
                          <span className="ml-1.5">
                            · {VENUE_LABEL[course.required_venue_type]}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Title */}
                    <td className="px-5 py-3.5 text-gray-700 max-w-[200px]">
                      <span className="line-clamp-2">{course.title}</span>
                    </td>

                    {/* Semester badge */}
                    <td className="px-5 py-3.5">
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ring-1 ring-inset",
                          SEMESTER_BADGE[course.semester]
                        )}
                      >
                        S{course.semester}
                      </span>
                    </td>

                    {/* Cohort badges */}
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap gap-1 max-w-[180px]">
                        {course.cohorts.length === 0 ? (
                          <span className="text-gray-400 text-xs">None</span>
                        ) : (
                          course.cohorts
                            .slice()
                            .sort((a, b) => {
                              const deptA = a.departments?.code ?? ""
                              const deptB = b.departments?.code ?? ""
                              if (deptA !== deptB) return deptA.localeCompare(deptB)
                              return a.year_level - b.year_level
                            })
                            .map((cohort) => (
                              <span
                                key={cohort.id}
                                className={cn(
                                  "inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium",
                                  YEAR_BADGE[cohort.year_level]
                                )}
                                title={`${cohort.departments?.name} — Year ${cohort.year_level}`}
                              >
                                {cohort.departments?.code}/{cohort.year_level * 100}
                              </span>
                            ))
                        )}
                      </div>
                    </td>

                    {/* Lecturer */}
                    <td className="px-5 py-3.5 text-gray-600">
                      {course.lecturer ? (
                        <div>
                          <p className="text-sm text-gray-700">
                            {course.lecturer.profiles?.full_name ?? "Unknown"}
                          </p>
                          <p className="text-xs text-gray-400">
                            {course.lecturer.staff_id}
                          </p>
                        </div>
                      ) : (
                        <span className="text-gray-400">Unassigned</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(course)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                          title="Edit course"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(course)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                          title="Delete course"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Add / Edit modal */}
      <CourseModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
      />

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setConfirmDelete(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-2">
              Delete course?
            </h2>
            <p className="text-sm text-gray-500 mb-1">
              <span className="font-mono font-medium text-gray-700">
                {confirmDelete.code}
              </span>{" "}
              — {confirmDelete.title} will be permanently deleted.
            </p>
            <p className="text-xs text-gray-400 mb-5">
              This is blocked if the course has timetable sessions. Remove
              those sessions first.
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setConfirmDelete(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                loading={deleteCourse.isPending}
                onClick={handleDelete}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}