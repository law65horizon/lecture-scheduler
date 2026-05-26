"use client"

import { useEffect, useState } from "react"
import { Venue, VenueType } from "@/lib/types/domain"
import { useCreateVenue, useUpdateVenue } from "@/hooks/useVenues"
import { Button } from "@/components/ui/Button"
import { cn } from "@/lib/utils/cn"
import { X } from "lucide-react"

interface Props {
  open: boolean
  onClose: () => void
  editing?: Venue | null
}

const VENUE_TYPE_OPTIONS: { value: VenueType; label: string; description: string }[] = [
  {
    value: "LECTURE_HALL",
    label: "Lecture Hall",
    description: "Large room for whole-class lectures",
  },
  {
    value: "LAB",
    label: "Laboratory",
    description: "Computer or science lab with equipment",
  },
  {
    value: "SEMINAR_ROOM",
    label: "Seminar Room",
    description: "Small room for tutorials and seminars",
  },
]

const inputCls = cn(
  "w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm bg-white",
  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
  "placeholder:text-gray-400"
)

export function VenueModal({ open, onClose, editing }: Props) {
  const [name, setName] = useState("")
  const [capacity, setCapacity] = useState<string>("")
  const [venueType, setVenueType] = useState<VenueType>("LECTURE_HALL")
  const [isActive, setIsActive] = useState(true)

  const create = useCreateVenue()
  const update = useUpdateVenue()
  const loading = create.isPending || update.isPending

  useEffect(() => {
    if (editing) {
      setName(editing.name)
      setCapacity(String(editing.capacity))
      setVenueType(editing.venue_type)
      setIsActive(editing.is_active)
    } else {
      setName("")
      setCapacity("")
      setVenueType("LECTURE_HALL")
      setIsActive(true)
    }
  }, [editing, open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const payload = {
      name,
      capacity: Number(capacity),
      venue_type: venueType,
      is_active: isActive,
    }

    if (editing) {
      console.log({ payload })
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
            {editing ? "Edit venue" : "Add venue"}
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
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Venue name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. LT-1, Computer Lab A"
              className={inputCls}
            />
          </div>

          {/* Capacity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Seating capacity
            </label>
            <input
              type="number"
              required
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="e.g. 200"
              className={inputCls}
            />
            <p className="text-xs text-gray-400 mt-1">
              The solver will only assign this venue when total cohort enrollment
              does not exceed this number.
            </p>
          </div>

          {/* Venue type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Venue type
            </label>
            <div className="space-y-2">
              {VENUE_TYPE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  style={{ padding: "5px" }}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border cursor-pointer transition-colors mb-2",
                    venueType === opt.value
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:bg-gray-50"
                  )}
                >
                  <input
                    type="radio"
                    name="venue_type"
                    value={opt.value}
                    checked={venueType === opt.value}
                    onChange={() => setVenueType(opt.value)}
                    className="mt-0.5 accent-blue-600"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{opt.label}</p>
                    <p className="text-xs text-gray-400">{opt.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Active toggle — uses data-* attributes to avoid Tailwind purge */}
          <div className="flex items-center justify-between py-2 px-3.5 rounded-lg border border-gray-200 bg-gray-50">
            <div className="pr-4">
              <p className="text-sm font-medium text-gray-700">Active</p>
              <p className="text-xs text-gray-400">
                Inactive venues are excluded from timetable generation.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isActive}
              data-active={isActive}
              onClick={() => setIsActive((v) => !v)}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent",
                "transition-colors duration-200 ease-in-out",
                "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                // Explicit strings — not computed, so Tailwind always includes them
                isActive ? "bg-blue-600" : "bg-gray-300"
              )}
            >
              <span
                style={{
                  // Inline style for the transform — bypasses purge entirely
                  transform: isActive ? "translateX(1rem)" : "translateX(0)",
                }}
                className={cn(
                  "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow",
                  "transition-transform duration-200 ease-in-out"
                )}
              />
            </button>
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
              {editing ? "Save changes" : "Add venue"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}