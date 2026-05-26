import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Lecturer } from "@/lib/types/domain"
import toast from "react-hot-toast"

// ─── Types ────────────────────────────────────────────────────────────────────

// The shape returned by the API — profiles and departments are nested objects
// from the Supabase join, so we extend Lecturer with those concrete fields.
export interface LecturerRow extends Omit<Lecturer, "full_name" | "department"> {
  profiles: { full_name: string; email: string } | null
  departments: { name: string; code: string } | null
}

// ─── Fetcher functions ────────────────────────────────────────────────────────

async function fetchLecturers(): Promise<LecturerRow[]> {
  const res = await fetch("/api/lecturers")
  if (!res.ok) throw new Error("Failed to fetch lecturers")
  return res.json()
}

async function createLecturer(body: {
  full_name: string
  email: string
  password: string
  staff_id: string
  department_id: string
}): Promise<LecturerRow> {
  const res = await fetch("/api/lecturers", {
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

async function updateLecturer({
  id,
  ...body
}: {
  id: string
  full_name: string
  staff_id: string
  department_id: string
}): Promise<LecturerRow> {
  const res = await fetch(`/api/lecturers/${id}`, {
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

async function deleteLecturer(id: string): Promise<void> {
  const res = await fetch(`/api/lecturers/${id}`, { method: "DELETE" })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error)
  }
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useLecturers() {
  return useQuery({
    queryKey: ["lecturers"],
    queryFn: fetchLecturers,
  })
}

export function useCreateLecturer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createLecturer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lecturers"] })
      toast.success("Lecturer created")
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateLecturer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateLecturer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lecturers"] })
      toast.success("Lecturer updated")
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteLecturer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteLecturer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lecturers"] })
      toast.success("Lecturer deleted")
    },
    onError: (err: Error) => toast.error(err.message),
  })
}