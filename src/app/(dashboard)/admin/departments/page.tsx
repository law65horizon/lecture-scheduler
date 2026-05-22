"use client"

import { useState } from "react"
import { useDepartments, useDeleteDepartment } from "@/hooks/useDepartments"
import { DepartmentModal } from "@/components/departments/DepartmentModal"
import { PageHeader } from "@/components/ui/PageHeader"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { EmptyState } from "@/components/ui/EmptyState"
import { Department } from "@/lib/types/domain"
import { Plus, Layers, Pencil, Trash2 } from "lucide-react"
import { format } from "date-fns"

export default function DepartmentsPage() {
  const { data: departments, isLoading } = useDepartments()
  const deleteDept = useDeleteDepartment()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Department | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Department | null>(null)

  function openCreate() {
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(dept: Department) {
    setEditing(dept)
    setModalOpen(true)
  }

  async function handleDelete() {
    if (!confirmDelete) return
    await deleteDept.mutateAsync(confirmDelete.id)
    setConfirmDelete(null)
  }

  return (
    <>
      <PageHeader
        title="Departments"
        description="The five departments in the Faculty of Computing"
        action={
          <Button icon={Plus} onClick={openCreate}>
            Add department
          </Button>
        }
      />

      <Card>
        {isLoading ? (
          <div className="px-5 py-12 text-center text-sm text-gray-400">
            Loading...
          </div>
        ) : !departments?.length ? (
          <EmptyState
            icon={Layers}
            title="No departments yet"
            description="Add the five Faculty of Computing departments to get started."
            action={
              <Button icon={Plus} onClick={openCreate}>
                Add department
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
                  Code
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">
                  Created
                </th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {departments.map((dept) => (
                <tr key={dept.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-gray-900">
                    {dept.name}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-medium bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200">
                      {dept.code}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-400">
                    {format(new Date(dept.created_at), "dd MMM yyyy")}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(dept)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(dept)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
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
      <DepartmentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
      />

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setConfirmDelete(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-2">
              Delete department?
            </h2>
            <p className="text-sm text-gray-500 mb-5">
              <span className="font-medium text-gray-700">
                {confirmDelete.name}
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
                loading={deleteDept.isPending}
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