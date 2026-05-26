/**
 * solver.ts
 *
 * Constraint-satisfaction timetable generator for the Faculty of Computing,
 * University of Delta (UNIDEL).
 *
 * Algorithm: backtracking search with:
 *   • MRV heuristic  — most-constrained variable first (shared courses,
 *                      i.e. those with more cohorts, are scheduled first
 *                      because they have fewer valid slots available)
 *   • Forward checking — hard constraints checked before each assignment
 *                        so invalid branches are pruned immediately
 *   • Soft-constraint ordering — valid candidates are sorted by ascending
 *                        penalty score so the solver explores better
 *                        placements first and finds good solutions faster
 *
 * This module has ZERO imports from Next.js, Supabase, or any runtime library.
 * It is a pure TypeScript function: same inputs always produce the same output.
 *
 * Entry point: generateTimetable(input: SolverInput): SolverResult
 */

import type {
  SolverInput,
  SolverResult,
  ProposedSession,
  Venue,
  TimeSlot,
  Cohort,
  Semester,
} from '@/lib/types/domain'

import { checkHardConstraints, type Candidate } from './constraints'
import { scoreSoftConstraints }                  from './scoring'

// ─── Internal scheduling unit ─────────────────────────────────────────────────

/**
 * A SchedulingUnit is the atom the solver works with.
 * For a normal course this is 1:1 with the course.
 * For a repeat course (`is_repeat = true`) two units are created so the solver
 * places two independent sessions — one labelled `_r1`, one `_r2` — each
 * appearing exactly once in the output.
 */
interface SchedulingUnit {
  /** Unique id for this unit; for repeat courses: courseId + '_r1' / '_r2' */
  unit_id: string
  /** The real course id written into the timetable session */
  course_id: string
  lecturer_id: string
  cohort_ids: string[]
  required_venue_type: string | null
  /** Label used in error messages */
  course_code: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a Set<string> of "lecturerId|timeSlotId" from the
 * lecturerUnavailability record so H1 lookups are O(1).
 */
function buildUnavailableSet(
  unavailability: Record<string, string[]>,
): Set<string> {
  const set = new Set<string>()
  for (const [lecturerId, slotIds] of Object.entries(unavailability)) {
    for (const slotId of slotIds) {
      set.add(`${lecturerId}|${slotId}`)
    }
  }
  return set
}

/**
 * Build a Map<cohortId, Cohort> for fast capacity lookups (H5).
 */
function buildCohortMap(units: SchedulingUnit[], allCohorts: Cohort[]): Map<string, Cohort> {
  // We only need cohorts that actually appear in the scheduling units.
  const neededIds = new Set(units.flatMap((u) => u.cohort_ids))
  const map = new Map<string, Cohort>()
  for (const c of allCohorts) {
    if (neededIds.has(c.id)) map.set(c.id, c)
  }
  return map
}

/**
 * Build a Map<timeSlotId, TimeSlot> for O(1) day/time lookups.
 */
function buildTimeSlotMap(slots: TimeSlot[]): Map<string, TimeSlot> {
  return new Map(slots.map((s) => [s.id, s]))
}

// ─── Core recursive backtracker ───────────────────────────────────────────────

/**
 * solve — recursive backtracking over the ordered list of scheduling units.
 *
 * Mutates `committed` in place: pushes on success, pops on backtrack.
 * Returns `true` when all units have been placed, `false` when no valid
 * assignment exists for `units[index]` given the current committed state.
 */
function solve(
  units: SchedulingUnit[],
  index: number,
  committed: ProposedSession[],
  activeSlots: TimeSlot[],
  activeVenues: Venue[],
  venues: Venue[],
  cohortMap: Map<string, Cohort>,
  timeSlotMap: Map<string, TimeSlot>,
  unavailableSlots: Set<string>,
  academicYear: string,
  semester: Semester,
): boolean {

  // Base case: every unit has been placed.
  if (index === units.length) return true

  const unit = units[index]

  // ── Generate all (slot, venue) candidates ──────────────────────────────────
  // For each active time slot, try every active venue whose type satisfies the
  // course requirement (or any venue if no type is required).

  interface ScoredCandidate {
    candidate: Candidate
    penalty: number
  }

  const scored: ScoredCandidate[] = []

  for (const slot of activeSlots) {
    for (const venue of activeVenues) {

      // Quick type filter before the full constraint check — avoids wasted work.
      if (
        unit.required_venue_type !== null &&
        venue.venue_type !== unit.required_venue_type
      ) {
        continue
      }

      const candidate: Candidate = {
        course_id:    unit.unit_id,     // unit_id is unique per repeat instance
        lecturer_id:  unit.lecturer_id,
        venue_id:     venue.id,
        time_slot_id: slot.id,
        cohort_ids:   unit.cohort_ids,
      }

      // Hard-constraint check — skip this (slot, venue) if any constraint fails.
      const violation = checkHardConstraints(
        candidate,
        venues,
        cohortMap,
        committed,
        unavailableSlots,
      )
      if (violation !== null) continue

      // Soft-constraint scoring — still a valid candidate, score it.
      const penalty = scoreSoftConstraints(candidate, committed, timeSlotMap)
      scored.push({ candidate, penalty })
    }
  }

  if (scored.length === 0) {
    // No valid placement found for this unit — trigger backtracking.
    return false
  }

  // Sort ascending by penalty so we try the least-disruptive placements first.
  scored.sort((a, b) => a.penalty - b.penalty)

  // ── Try each candidate in penalty order ────────────────────────────────────
  for (const { candidate } of scored) {

    // Commit this candidate to the draft timetable.
    // Note: we write the real course_id (not unit_id) into the session so that
    // repeat courses still reference the correct course row in the DB.
    const session: ProposedSession = {
      course_id:    unit.course_id,     // real DB course id
      lecturer_id:  candidate.lecturer_id,
      venue_id:     candidate.venue_id,
      time_slot_id: candidate.time_slot_id,
      academic_year: academicYear,
      semester,
      cohort_ids:   unit.cohort_ids,
    }

    committed.push(session)

    // Recurse to place the next unit.
    const ok = solve(
      units,
      index + 1,
      committed,
      activeSlots,
      activeVenues,
      venues,
      cohortMap,
      timeSlotMap,
      unavailableSlots,
      academicYear,
      semester,
    )

    if (ok) return true

    // This placement led to a dead end — backtrack.
    committed.pop()
  }

  // All candidates exhausted without finding a solution.
  return false
}

// ─── Public entry point ───────────────────────────────────────────────────────

/**
 * generateTimetable
 *
 * Takes a complete scheduling snapshot from the database and returns either a
 * fully-solved proposed timetable or a descriptive failure reason.
 *
 * The caller (the API route) is responsible for fetching the snapshot; this
 * function performs no I/O.
 *
 * @param input — SolverInput containing courses, venues, timeSlots,
 *                academicYear, semester, and lecturerUnavailability
 * @returns SolverResult — success with sessions[], or failure with reason
 */
export function generateTimetable(input: SolverInput): SolverResult {
  const { courses, venues, timeSlots, academicYear, semester, lecturerUnavailability } = input

  // ── 1. Filter to active slots and venues ────────────────────────────────────
  const activeSlots  = timeSlots.filter((s) => s.is_active)
  const activeVenues = venues.filter((v) => v.is_active)

  if (activeSlots.length === 0) {
    return { success: false, reason: 'No active time slots are configured.' }
  }
  if (activeVenues.length === 0) {
    return { success: false, reason: 'No active venues are configured.' }
  }

  // ── 2. Expand courses into scheduling units ─────────────────────────────────
  // Normal course → 1 unit.  Repeat course → 2 units with distinct unit_ids.
  // The solver treats each unit as an independent variable in the CSP.
  const units: SchedulingUnit[] = []

  for (const course of courses) {
    if (!course.lecturer_id) {
      // A course without an assigned lecturer cannot be scheduled.
      return {
        success: false,
        reason: `Course ${course.code} has no lecturer assigned.`,
        courseCode: course.code,
      }
    }
    if (!course.cohorts || course.cohorts.length === 0) {
      return {
        success: false,
        reason: `Course ${course.code} has no cohorts assigned.`,
        courseCode: course.code,
      }
    }

    const base: Omit<SchedulingUnit, 'unit_id'> = {
      course_id:           course.id,
      lecturer_id:         course.lecturer_id,
      cohort_ids:          course.cohorts.map((c) => c.id),
      required_venue_type: course.required_venue_type,
      course_code:         course.code,
    }

    units.push({ ...base, unit_id: course.id })

    if (course.is_repeat) {
      // Second scheduling unit for repeat courses — uses a synthetic unit_id
      // so H4 (duplicate course check) in constraints.ts sees them as distinct.
      units.push({ ...base, unit_id: `${course.id}_repeat` })
    }
  }

  if (units.length === 0) {
    return { success: false, reason: 'No courses to schedule.' }
  }

  // ── 3. MRV ordering ─────────────────────────────────────────────────────────
  // Sort units by number of cohorts descending.
  // Courses shared across many cohorts are the most constrained (fewest valid
  // slots) so they must be placed first.  This is the MRV heuristic.
  units.sort((a, b) => b.cohort_ids.length - a.cohort_ids.length)

  // ── 4. Build lookup structures ───────────────────────────────────────────────
  // Collect all cohorts referenced by the units for H5 lookups.
  // SolverInput gives us courses with embedded cohort arrays; flatten them.
  const allCohorts: Cohort[] = courses.flatMap((c) => c.cohorts ?? [])

  const cohortMap      = buildCohortMap(units, allCohorts)
  const timeSlotMap    = buildTimeSlotMap(timeSlots)
  const unavailableSet = buildUnavailableSet(lecturerUnavailability)

  // ── 5. Run the backtracking solver ──────────────────────────────────────────
  const committed: ProposedSession[] = []

  const found = solve(
    units,
    0,
    committed,
    activeSlots,
    activeVenues,
    venues,          // full list (including inactive) for capacity lookup guard
    cohortMap,
    timeSlotMap,
    unavailableSet,
    academicYear,
    semester,
  )

  if (!found) {
    // Work out which unit failed by counting how many were placed.
    // The first unplaced unit (units[committed.length]) is the culprit.
    const failedUnit = units[committed.length]
    const code = failedUnit?.course_code ?? 'unknown'

    return {
      success: false,
      reason:
        `Could not find a valid slot for course ${code}. ` +
        `Try adding more venues or time slots, or check lecturer availability.`,
      courseCode: code,
    }
  }

  return { success: true, sessions: committed }
}