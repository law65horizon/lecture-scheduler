"use client"

import { useEffect, useState } from "react"
import { Department } from "@/lib/types/domain"
import { useCreateDepartment, useUpdateDepartment } from "@/hooks/useDepartments"
import { Button } from "@/components/ui/Button"
import { cn } from "@/lib/utils/cn"
import { X } from "lucide-react"

interface Props {
  open: boolean
  onClose: () => void
  editing?: Department | null
}

export function DepartmentModal({ open, onClose, editing }: Props) {
  const [name, setName] = useState("")
  const [code, setCode] = useState("")

  const create = useCreateDepartment()
  const update = useUpdateDepartment()
  const loading = create.isPending || update.isPending

  useEffect(() => {
    if (editing) {
      setName(editing.name)
      setCode(editing.code)
    } else {
      setName("")
      setCode("")
    }
  }, [editing, open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (editing) {
      await update.mutateAsync({ id: editing.id, name, code })
    } else {
      await create.mutateAsync({ name, code })
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

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-900">
            {editing ? "Edit department" : "Add department"}
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Department name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Computer Science"
              className={cn(
                "w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm",
                "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                "placeholder:text-gray-400"
              )}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Department code
            </label>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. CSC"
              maxLength={10}
              className={cn(
                "w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm",
                "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                "placeholder:text-gray-400 uppercase"
              )}
            />
            <p className="text-xs text-gray-400 mt-1">
              Short code used throughout the system
            </p>
          </div>

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
              {editing ? "Save changes" : "Add department"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}