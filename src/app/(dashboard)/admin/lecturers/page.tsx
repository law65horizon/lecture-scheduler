"use client"

import { useState } from "react"
import { useLecturers, useDeleteLecturer, LecturerRow } from "@/hooks/useLecturers"
import { LecturerModal } from "@/components/lecturers/LecturerModal"
import { PageHeader } from "@/components/ui/PageHeader"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { EmptyState } from "@/components/ui/EmptyState"
import { Plus, Users, Pencil, Trash2 } from "lucide-react"

export default function AdminLecturersPage() {
  const { data: lecturers, isLoading } = useLecturers()
  const deleteLecturer = useDeleteLecturer()
  console.log({lecturers})

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<LecturerRow | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<LecturerRow | null>(null)

  function openCreate() {
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(lecturer: LecturerRow) {
    setEditing(lecturer)
    setModalOpen(true)
  }

  async function handleDelete() {
    if (!confirmDelete) return
    await deleteLecturer.mutateAsync(confirmDelete.id)
    setConfirmDelete(null)
  }

  const total = lecturers?.length ?? 0

  return (
    <>
      <PageHeader
        title="Lecturers"
        description={
          total > 0
            ? `${total} lecturer${total !== 1 ? "s" : ""} across the faculty`
            : "Add the lecturers who will be assigned to courses"
        }
        action={
          <Button icon={Plus} onClick={openCreate}>
            Add lecturer
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
            icon={Users}
            title="No lecturers yet"
            description="Add lecturers to the system before creating courses. Each lecturer will receive login credentials to view their own timetable."
            action={
              <Button icon={Plus} onClick={openCreate}>
                Add lecturer
              </Button>
            }
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">
                  Name
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">
                  Staff ID
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">
                  Department
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">
                  Email
                </th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {lecturers!
                .slice()
                .sort((a, b) =>
                  (a.profiles?.full_name ?? "").localeCompare(
                    b.profiles?.full_name ?? ""
                  )
                )
                .map((lecturer) => (
                  <tr
                    key={lecturer.id}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    {/* Name */}
                    <td className="px-5 py-3.5 font-medium text-gray-900">
                      {lecturer.profiles?.full_name ?? (
                        <span className="text-gray-400 italic">Unknown</span>
                      )}
                    </td>

                    {/* Staff ID */}
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-medium bg-gray-100 text-gray-600">
                        {lecturer.staff_id}
                      </span>
                    </td>

                    {/* Department */}
                    <td className="px-5 py-3.5">
                      {lecturer.departments ? (
                        <span className="inline-flex items-center gap-1.5 text-gray-700">
                          {lecturer.departments.name}
                          <span className="text-xs text-gray-400">
                            ({lecturer.departments.code})
                          </span>
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>

                    {/* Email */}
                    <td className="px-5 py-3.5 text-gray-500">
                      {lecturer.profiles?.email ?? (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(lecturer)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                          title="Edit lecturer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(lecturer)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                          title="Delete lecturer"
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
      <LecturerModal
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
              Delete lecturer?
            </h2>
            <p className="text-sm text-gray-500 mb-1">
              <span className="font-medium text-gray-700">
                {confirmDelete.profiles?.full_name ?? "This lecturer"}
              </span>{" "}
              will be permanently removed, including their login account.
            </p>
            <p className="text-xs text-gray-400 mb-5">
              This is blocked if they are assigned to any courses or timetable
              sessions. Remove those assignments first.
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
                loading={deleteLecturer.isPending}
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