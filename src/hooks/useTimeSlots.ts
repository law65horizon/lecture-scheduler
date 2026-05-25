import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { TimeSlot } from "@/lib/types/domain"
import toast from "react-hot-toast"

// ─── Fetcher functions ────────────────────────────────────────────────────────

async function fetchTimeSlots(): Promise<TimeSlot[]> {
  const res = await fetch("/api/timeslots")
  if (!res.ok) throw new Error("Failed to fetch time slots")
  return res.json()
}

async function toggleTimeSlot({
  id,
  is_active,
}: {
  id: string
  is_active: boolean
}): Promise<TimeSlot> {
  const res = await fetch(`/api/timeslots/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_active }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error)
  }
  return res.json()
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useTimeSlots() {
  return useQuery({
    queryKey: ["timeslots"],
    queryFn: fetchTimeSlots,
  })
}

export function useToggleTimeSlot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: toggleTimeSlot,
    // Optimistic update — flip the flag in cache immediately so the toggle
    // feels instant; if the request fails the cache is rolled back by React Query.
    onMutate: async ({ id, is_active }) => { 
      await queryClient.cancelQueries({ queryKey: ["timeslots"] })
      console.log('query canceled')
      const previous = queryClient.getQueryData<TimeSlot[]>(["timeslots"])
      queryClient.setQueryData<TimeSlot[]>(["timeslots"], (old) =>
        old?.map((s) => (s.id === id ? { ...s, is_active } : s)) ?? []
      )
      return { previous }
    },
    onError: (err: Error, _vars, context) => {
      // Roll back the optimistic update
      if (context?.previous) {
        queryClient.setQueryData(["timeslots"], context.previous)
      }
      toast.error(err.message)
    },
    onSuccess: (_data, { is_active }) => {
      // No need to invalidate — the cache was already updated optimistically.
      // Just show a brief confirmation.
      toast.success(is_active ? "Slot activated" : "Slot deactivated")
    },
  })
}