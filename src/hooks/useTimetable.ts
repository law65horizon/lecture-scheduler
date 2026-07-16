import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import type { Semester, VenueType, DayOfWeek } from '@/lib/types/domain'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SessionCohort {
  id: string
  year_level: number
  student_count: number
  departments: { name: string; code: string } | null
}

export interface SessionRow {
  id: string
  course_id: string
  lecturer_id: string
  venue_id: string
  time_slot_id: string
  academic_year: string
  semester: Semester
  is_published: boolean
  created_at: string
  course: {
    id: string
    code: string
    title: string
    credit_units: number
    semester: Semester
    required_venue_type: VenueType | null
    is_repeat: boolean
  } | null
  venue: {
    id: string
    name: string
    capacity: number
    venue_type: VenueType
    is_active: boolean
  } | null
  time_slot: {
    id: string
    day_of_week: DayOfWeek
    start_time: string
    end_time: string
    is_active: boolean
  } | null
  lecturer: {
    id: string
    staff_id: string
    full_name: string | null
  } | null
  cohorts: SessionCohort[]
}

export interface ProposedSessionRow {
  course_id: string
  lecturer_id: string
  venue_id: string
  time_slot_id: string
  academic_year: string
  semester: Semester
  cohort_ids: string[]
}

// ─── Query key factory ────────────────────────────────────────────────────────

export const timetableKeys = {
  entries: (year: string, sem: number) =>
    ['timetable', 'entries', year, sem] as const,
}

// ─── Fetchers ─────────────────────────────────────────────────────────────────

async function fetchEntries(academic_year: string, semester: number): Promise<SessionRow[]> {
  const params = new URLSearchParams({
    academic_year,
    semester: String(semester),
  })
  const res = await fetch(`/api/timetable/entries?${params}`)
  if (!res.ok) throw new Error('Failed to fetch timetable entries')
  return res.json()
}

async function generateDraft(academic_year: string, semester: number): Promise<ProposedSessionRow[]> {
  const res = await fetch('/api/timetable/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ academic_year, semester }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Solver failed')
  return data.sessions
}

async function commitDraft(payload: {
  sessions: ProposedSessionRow[]
  academic_year: string
  semester: number
}): Promise<{ count: number }> {
  const res = await fetch('/api/timetable/commit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Commit failed')
  return data
}

async function publishAll(payload: {
  academic_year: string
  semester: number
  publish: boolean
}): Promise<{ count: number }> {
  const res = await fetch('/api/timetable/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Publish failed')
  return data
}

export interface EntryMutationPayload {
  course_id: string
  lecturer_id: string
  venue_id: string
  time_slot_id: string
  academic_year: string
  semester: Semester
  cohort_ids: string[]
}

async function createEntry(payload: EntryMutationPayload): Promise<{ id: string }> {
  const res = await fetch('/api/timetable/entries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Failed to add session')
  return data
}

async function updateEntry({ id, ...payload }: EntryMutationPayload & { id: string }): Promise<{ id: string }> {
  const res = await fetch(`/api/timetable/entries/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Failed to update session')
  return data
}

async function deleteEntry(id: string): Promise<void> {
  const res = await fetch(`/api/timetable/entries/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error ?? 'Delete failed')
  }
}

async function patchPublish(payload: { id: string; is_published: boolean }): Promise<void> {
  const res = await fetch(`/api/timetable/entries/${payload.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_published: payload.is_published }),
  })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error ?? 'Failed to update publish status')
  }
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useTimetableEntries(academic_year: string, semester: number) {
  return useQuery({
    queryKey: timetableKeys.entries(academic_year, semester),
    queryFn: () => fetchEntries(academic_year, semester),
    // Don't fetch until year and semester are set
    enabled: !!academic_year && (semester === 1 || semester === 2),
  })
}

export function useGenerateTimetable() {
  return useMutation({
    mutationFn: ({ academic_year, semester }: { academic_year: string; semester: number }) =>
      generateDraft(academic_year, semester),
    // No automatic toast — the caller handles the UI flow (modal stays open)
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useCommitTimetable() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: commitDraft,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: timetableKeys.entries(variables.academic_year, variables.semester),
      })
      toast.success(`${data.count} sessions committed`)
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function usePublishTimetable() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: publishAll,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: timetableKeys.entries(variables.academic_year, variables.semester),
      })
      toast.success(
        variables.publish
          ? `Timetable published (${data.count} sessions)`
          : `Timetable unpublished`
      )
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useCreateEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable'] })
      toast.success('Session added')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable'] })
      toast.success('Session updated')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable'] })
      toast.success('Session removed')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function usePatchPublish() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: patchPublish,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}