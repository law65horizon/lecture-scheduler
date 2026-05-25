"use client"

import { useState } from "react"
import { useVenues, useDeleteVenue } from "@/hooks/useVenues"
import { VenueModal } from "@/components/venues/VenueModal"
import { PageHeader } from "@/components/ui/PageHeader"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { EmptyState } from "@/components/ui/EmptyState"
import { Venue, VenueType } from "@/lib/types/domain"
import { Plus, Building2, Pencil, Trash2 } from "lucide-react"

// ─── Display helpers ──────────────────────────────────────────────────────────

const TYPE_LABEL: Record<VenueType, string> = {
  LECTURE_HALL: "Lecture Hall",
  LAB: "Laboratory",
  SEMINAR_ROOM: "Seminar Room",
}

const TYPE_BADGE: Record<VenueType, string> = {
  LECTURE_HALL: "bg-blue-50 text-blue-700 ring-blue-200",
  LAB: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  SEMINAR_ROOM: "bg-violet-50 text-violet-700 ring-violet-200",
}

export default function VenuesPage() {
  const { data: venues, isLoading } = useVenues()
  const deleteVenue = useDeleteVenue()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Venue | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Venue | null>(null)

  function openCreate() {
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(venue: Venue) {
    setEditing(venue)
    setModalOpen(true)
  }

  async function handleDelete() {
    if (!confirmDelete) return
    await deleteVenue.mutateAsync(confirmDelete.id)
    setConfirmDelete(null)
  }

  const totalVenues = venues?.length ?? 0
  const activeVenues = venues?.filter((v) => v.is_active).length ?? 0

  return (
    <>
      <PageHeader
        title="Venues"
        description={
          totalVenues > 0
            ? `${totalVenues} venue${totalVenues !== 1 ? "s" : ""} · ${activeVenues} active`
            : "Add lecture halls, labs, and seminar rooms"
        }
        action={
          <Button icon={Plus} onClick={openCreate}>
            Add venue
          </Button>
        }
      />

      <Card>
        {isLoading ? (
          <div className="px-5 py-12 text-center text-sm text-gray-400">
            Loading…
          </div>
        ) : totalVenues === 0 ? (
          <EmptyState
            icon={Building2}
            title="No venues yet"
            description="Add the lecture halls, labs, and seminar rooms available to the faculty. The solver uses venue capacity and type when assigning sessions."
            action={
              <Button icon={Plus} onClick={openCreate}>
                Add venue
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
                  Type
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">
                  Capacity
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">
                  Status
                </th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {venues!
                // Sort: active first, then alphabetically
                .slice()
                .sort((a, b) => {
                  if (a.is_active !== b.is_active)
                    return a.is_active ? -1 : 1
                  return a.name.localeCompare(b.name)
                })
                .map((venue) => (
                  <tr
                    key={venue.id}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    {/* Name */}
                    <td
                      className={`px-5 py-3.5 font-medium ${
                        venue.is_active ? "text-gray-900" : "text-gray-400"
                      }`}
                    >
                      {venue.name}
                    </td>

                    {/* Type badge */}
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ring-1 ring-inset ${
                          TYPE_BADGE[venue.venue_type]
                        }`}
                      >
                        {TYPE_LABEL[venue.venue_type]}
                      </span>
                    </td>

                    {/* Capacity */}
                    <td className="px-5 py-3.5 text-gray-600 tabular-nums">
                      {venue.capacity.toLocaleString()}
                    </td>

                    {/* Active status */}
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                          venue.is_active
                            ? "text-emerald-600"
                            : "text-gray-400"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            venue.is_active ? "bg-emerald-500" : "bg-gray-300"
                          }`}
                        />
                        {venue.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(venue)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                          title="Edit venue"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(venue)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                          title="Delete venue"
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
      <VenueModal
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
              Delete venue?
            </h2>
            <p className="text-sm text-gray-500 mb-1">
              <span className="font-medium text-gray-700">
                {confirmDelete.name}
              </span>{" "}
              will be removed.
            </p>
            <p className="text-xs text-gray-400 mb-5">
              If this venue is referenced by existing timetable sessions it will
              be deactivated rather than permanently deleted.
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
                loading={deleteVenue.isPending}
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