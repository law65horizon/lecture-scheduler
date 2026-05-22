import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Department } from "@/lib/types/domain"
import toast from "react-hot-toast"

async function fetchDepartments(): Promise<Department[]> {
  const res = await fetch("/api/departments")
  if (!res.ok) throw new Error("Failed to fetch departments")
  return res.json()
}

async function createDepartment(body: { name: string; code: string }) {
  console.log({body})
  const res = await fetch("/api/departments", {
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

async function updateDepartment({
  id,
  ...body
}: {
  id: string
  name: string
  code: string
}) {
  const res = await fetch(`/api/departments/${id}`, {
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

async function deleteDepartment(id: string) {
  const res = await fetch(`/api/departments/${id}`, { method: "DELETE" })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error)
  }
}

export function useDepartments() {
  return useQuery({
    queryKey: ["departments"],
    queryFn: fetchDepartments,
  })
}

export function useCreateDepartment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createDepartment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] })
      toast.success("Department created")
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateDepartment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] })
      toast.success("Department updated")
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteDepartment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteDepartment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] })
      toast.success("Department deleted")
    },
    onError: (err: Error) => toast.error(err.message),
  })
}