import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import toast from "react-hot-toast"
import { Semester, VenueType } from "@/lib/types/domain"
import { LecturerRow } from "@/hooks/useLecturers"

// ─── Types ────────────────────────────────────────────────────────────────────

// Shape of a cohort as returned inside a course from the API
export interface CourseCohor {
  id: string
  year_level: number
  department_id: string
  student_count: number
  departments: { name: string; code: string } | null
}

// Full course row as returned by GET /api/courses and POST/PUT responses
export interface CourseRow {
  id: string
  code: string
  title: string
  credit_units: number
  semester: Semester
  required_venue_type: VenueType | null
  is_repeat: boolean
  created_at: string
  cohorts: CourseCohor[]
  lecturer: LecturerRow | null
}

// Payload for create and update mutations
export interface CourseMutationPayload {
  code: string
  title: string
  credit_units: number
  semester: Semester
  required_venue_type: VenueType | null
  is_repeat: boolean
  cohort_ids: string[]
  lecturer_id: string
}

// ─── Fetcher functions ────────────────────────────────────────────────────────

async function fetchCourses(): Promise<CourseRow[]> {
  const res = await fetch("/api/courses")
  if (!res.ok) throw new Error("Failed to fetch courses")
  return res.json()
}

async function createCourse(body: CourseMutationPayload): Promise<CourseRow> {
  const res = await fetch("/api/courses", {
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

async function updateCourse({
  id,
  ...body
}: CourseMutationPayload & { id: string }): Promise<CourseRow> {
  const res = await fetch(`/api/courses/${id}`, {
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

async function deleteCourse(id: string): Promise<void> {
  const res = await fetch(`/api/courses/${id}`, { method: "DELETE" })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error)
  }
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useCourses() {
  return useQuery({
    queryKey: ["courses"],
    queryFn: fetchCourses,
  })
}

export function useCreateCourse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createCourse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] })
      toast.success("Course created")
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateCourse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateCourse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] })
      toast.success("Course updated")
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteCourse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteCourse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] })
      toast.success("Course deleted")
    },
    onError: (err: Error) => toast.error(err.message),
  })
}