"use client"

import { useState } from "react"
import { useCohorts, useDeleteCohort } from "@/hooks/useCohorts"
import { CohortModal } from "@/components/cohorts/CohortModal"
import { PageHeader } from "@/components/ui/PageHeader"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { EmptyState } from "@/components/ui/EmptyState"
import { Cohort } from "@/lib/types/domain"
import { Plus, Users, Pencil, Trash2 } from "lucide-react"

// Year level display helpers
const YEAR_LABEL: Record<number, string> = {
  1: "Year 1",
  2: "Year 2",
  3: "Year 3",
  4: "Year 4",
}

const LEVEL_BADGE: Record<number, string> = {
  1: "bg-violet-50 text-violet-700 ring-violet-200",
  2: "bg-blue-50 text-blue-700 ring-blue-200",
  3: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  4: "bg-amber-50 text-amber-700 ring-amber-200",
}

export default function CohortsPage() {
  const { data: cohorts, isLoading } = useCohorts()
  console.log({cohorts})
  const deleteCohort = useDeleteCohort()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Cohort | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Cohort | null>(null)

  function openCreate() {
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(cohort: Cohort) {
    setEditing(cohort)
    setModalOpen(true)
  }

  async function handleDelete() {
    if (!confirmDelete) return
    await deleteCohort.mutateAsync(confirmDelete.id)
    setConfirmDelete(null)
  }

  // ── Group cohorts by department name for display ───────────────────────────
  const grouped = (cohorts ?? []).reduce<Record<string, Cohort[]>>((acc, c) => {
    // The department name comes from the join: c.department?.name
    const key = c.departments?.name ?? "Unknown department"
    if (!acc[key]) acc[key] = []
    acc[key].push(c)
    return acc
  }, {})

  const departmentNames = Object.keys(grouped).sort()

  // Total cohort count and total student count for the header description
  const totalCohorts = cohorts?.length ?? 0
  const totalStudents = (cohorts ?? []).reduce(
    (sum, c) => sum + c.student_count,
    0
  )

  return (
    <>
      <PageHeader
        title="Cohorts"
        description={
          totalCohorts > 0
            ? `${totalCohorts} cohort${totalCohorts !== 1 ? "s" : ""} · ${totalStudents.toLocaleString()} students total`
            : "Define year-level groups within each department"
        }
        action={
          <Button icon={Plus} onClick={openCreate}>
            Add cohort
          </Button>
        }
      />

      <Card>
        {isLoading ? (
          <div className="px-5 py-12 text-center text-sm text-gray-400">
            Loading…
          </div>
        ) : totalCohorts === 0 ? (
          <EmptyState
            icon={Users}
            title="No cohorts yet"
            description="Add cohorts to define the year-level groups within each department. Each cohort is the atomic unit the timetable is built around."
            action={
              <Button icon={Plus} onClick={openCreate}>
                Add cohort
              </Button>
            }
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">
                  Department
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">
                  Year level
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">
                  Students
                </th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {departmentNames.map((deptName) => {
                const deptCohorts = grouped[deptName].sort(
                  (a, b) => a.year_level - b.year_level
                )

                return deptCohorts.map((cohort, idx) => (
                  <tr
                    key={cohort.id}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    {/* Department cell — only shown on the first row of a group */}
                    <td className="px-5 py-3.5 font-medium text-gray-900 align-top">
                      {0 === 0 ? (
                        <div className="flex items-center gap-2">
                          <span>{deptName}</span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-medium bg-gray-100 text-gray-500">
                            {cohort.departments?.code}
                          </span>
                        </div>
                      ) : null}
                    </td>

                    {/* Year level badge */}
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ring-1 ring-inset ${
                          LEVEL_BADGE[cohort.year_level]
                        }`}
                      >
                        {YEAR_LABEL[cohort.year_level]}
                      </span>
                    </td>

                    {/* Student count */}
                    <td className="px-5 py-3.5 text-gray-600">
                      {cohort.student_count.toLocaleString()}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(cohort)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                          title="Edit cohort"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(cohort)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                          title="Delete cohort"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              })}
            </tbody>
          </table>
        )}
      </Card>

      {/* Add / Edit modal */}
      <CohortModal
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
              Delete cohort?
            </h2>
            <p className="text-sm text-gray-500 mb-5">
              <span className="font-medium text-gray-700">
                {confirmDelete.departments?.name} —{" "}
                {YEAR_LABEL[confirmDelete.year_level]}
              </span>{" "}
              will be permanently deleted. This cannot be undone.
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
                loading={deleteCohort.isPending}
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