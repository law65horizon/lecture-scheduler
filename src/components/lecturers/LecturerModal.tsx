"use client"

import { useEffect, useState } from "react"
import { useDepartments } from "@/hooks/useDepartments"
import {
  useCreateLecturer,
  useUpdateLecturer,
  LecturerRow,
} from "@/hooks/useLecturers"
import { Button } from "@/components/ui/Button"
import { cn } from "@/lib/utils/cn"
import { X, Eye, EyeOff } from "lucide-react"

interface Props {
  open: boolean
  onClose: () => void
  editing?: LecturerRow | null
}

// Shared input class — consistent with all other modals in the project
const inputCls = cn(
  "w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm bg-white",
  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
  "placeholder:text-gray-400 disabled:bg-gray-50 disabled:text-gray-400"
)

export function LecturerModal({ open, onClose, editing }: Props) {
  const { data: departments = [] } = useDepartments()

  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [staffId, setStaffId] = useState("")
  const [departmentId, setDepartmentId] = useState("")

  const create = useCreateLecturer()
  const update = useUpdateLecturer()
  const loading = create.isPending || update.isPending

  // Populate form when editing, reset when creating
  useEffect(() => {
    if (editing) {
      setFullName(editing.profiles?.full_name ?? "")
      setEmail(editing.profiles?.email ?? "")
      setPassword("") // never pre-fill passwords
      setStaffId(editing.staff_id)
      setDepartmentId(editing.department_id)
    } else {
      setFullName("")
      setEmail("")
      setPassword("")
      setStaffId("")
      setDepartmentId("")
    }
    setShowPassword(false)
  }, [editing, open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (editing) {
      await update.mutateAsync({
        id: editing.id,
        full_name: fullName,
        staff_id: staffId,
        department_id: departmentId,
      })
    } else {
      await create.mutateAsync({
        full_name: fullName,
        email,
        password,
        staff_id: staffId,
        department_id: departmentId,
      })
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
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-900">
            {editing ? "Edit lecturer" : "Add lecturer"}
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
          {/* Full name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Full name
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Dr. Emeka Okafor"
              className={inputCls}
            />
          </div>

          {/* Email — read-only when editing (email is the Auth identity) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Email address
            </label>
            <input
              type="email"
              required={!editing}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. e.okafor@unidel.edu.ng"
              disabled={!!editing}
              className={inputCls}
            />
            {editing && (
              <p className="text-xs text-gray-400 mt-1">
                Email cannot be changed after account creation.
              </p>
            )}
          </div>

          {/* Password — only shown when creating */}
          {!editing && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className={cn(inputCls, "pr-10")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                The lecturer will use this password to sign in.
              </p>
            </div>
          )}

          {/* Staff ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Staff ID
            </label>
            <input
              type="text"
              required
              value={staffId}
              onChange={(e) => setStaffId(e.target.value.toUpperCase())}
              placeholder="e.g. UNIDEL/CSC/001"
              className={cn(inputCls, "uppercase")}
            />
          </div>

          {/* Department */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Department
            </label>
            <select
              required
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
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
              {editing ? "Save changes" : "Add lecturer"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}