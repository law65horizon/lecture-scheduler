import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Cohort } from "@/lib/types/domain"
import toast from "react-hot-toast"

// ─── Fetcher functions ────────────────────────────────────────────────────────

async function fetchCohorts(): Promise<Cohort[]> {
  const res = await fetch("/api/cohorts")
  if (!res.ok) throw new Error("Failed to fetch cohorts")
  return res.json()
}

async function createCohort(body: {
  department_id: string
  year_level: number
  student_count: number
}) {
  const res = await fetch("/api/cohorts", {
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

async function updateCohort({
  id,
  ...body
}: {
  id: string
  year_level: number
  student_count: number
}) {
  const res = await fetch(`/api/cohorts/${id}`, {
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

async function deleteCohort(id: string) {
  const res = await fetch(`/api/cohorts/${id}`, { method: "DELETE" })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error)
  }
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useCohorts() {
  return useQuery({
    queryKey: ["cohorts"],
    queryFn: fetchCohorts,
  })
}

export function useCreateCohort() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createCohort,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cohorts"] })
      toast.success("Cohort created")
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateCohort() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateCohort,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cohorts"] })
      toast.success("Cohort updated")
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteCohort() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteCohort,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cohorts"] })
      toast.success("Cohort deleted")
    },
    onError: (err: Error) => toast.error(err.message),
  })
}