import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Venue } from "@/lib/types/domain"
import toast from "react-hot-toast"

// ─── Fetcher functions ────────────────────────────────────────────────────────

async function fetchVenues(): Promise<Venue[]> {
  const res = await fetch("/api/venues")
  if (!res.ok) throw new Error("Failed to fetch venues")
  return res.json()
}

async function createVenue(body: {
  name: string
  capacity: number
  venue_type: string
  is_active: boolean
}) {
  const res = await fetch("/api/venues", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error)
  }
  return res.json()
}

async function updateVenue({
  id,
  ...body
}: {
  id: string
  name: string
  capacity: number
  venue_type: string
  is_active: boolean
}) {
  const res = await fetch(`/api/venues/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error)
  }
  return res.json()
}

async function deleteVenue(id: string): Promise<{ softDeleted?: boolean } | void> {
  const res = await fetch(`/api/venues/${id}`, { method: "DELETE" })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error)
  }
  // 204 = hard deleted, 200 = soft deleted (venue had sessions)
  if (res.status === 200) return res.json()
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useVenues() {
  return useQuery({
    queryKey: ["venues"],
    queryFn: fetchVenues,
  })
}

export function useCreateVenue() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createVenue,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["venues"] })
      toast.success("Venue created")
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateVenue() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateVenue,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["venues"] })
      toast.success("Venue updated")
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteVenue() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteVenue,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["venues"] })
      // Distinguish between a hard delete and a soft delete for the user
      if (result && (result as { softDeleted?: boolean }).softDeleted) {
        toast.success("Venue deactivated (it is referenced by existing sessions)")
      } else {
        toast.success("Venue deleted")
      }
    },
    onError: (err: Error) => toast.error(err.message),
  })
}