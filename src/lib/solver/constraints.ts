/**
 * constraints.ts
 *
 * Pure hard-constraint checker for the lecture scheduling CSP solver.
 *
 * All five hard constraints from the spec are enforced here:
 *   H1 — No lecturer double-booking
 *   H2 — No venue double-booking
 *   H3 — No cohort clash (covers joint/shared courses too)
 *   H4 — No duplicate course scheduling (one slot per course unless is_repeat)
 *   H5 — Venue capacity ≥ combined enrolment of all cohorts in the session
 *
 * This module has ZERO imports from Next.js, Supabase, or any runtime library.
 * It is a pure TypeScript module that operates entirely on in-memory snapshots.
 */

import type { ProposedSession, Venue, Cohort } from '@/lib/types/domain'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * The data the constraint checker needs to know about a single candidate
 * assignment before it is committed to the proposed solution.
 */
export interface Candidate {
  /** The course being scheduled (or the repeat instance of it) */
  course_id: string
  /** The lecturer assigned to this course */
  lecturer_id: string
  /** The venue being tried */
  venue_id: string
  /** The time slot being tried */
  time_slot_id: string
  /** All cohort IDs that will attend this session */
  cohort_ids: string[]
}

/**
 * Returned when a hard constraint is violated.
 * `constraint` is the constraint code (H1–H5) for debugging/logging.
 */
export interface ConstraintViolation {
  constraint: 'H1' | 'H2' | 'H3' | 'H4' | 'H5'
  reason: string
}

// ─── Main exported function ───────────────────────────────────────────────────

/**
 * checkHardConstraints
 *
 * Tests a candidate assignment against all five hard constraints.
 *
 * @param candidate         — The slot/venue/cohorts being proposed for a course
 * @param venues            — Full venue list (needed for capacity lookup — H5)
 * @param cohortMap         — Map of cohort_id → Cohort (for student_count — H5)
 * @param committed         — Sessions already accepted into the draft timetable
 * @param unavailableSlots  — Set of "lecturerId|timeSlotId" strings marking
 *                            explicit lecturer unavailability (from DB table)
 *
 * @returns `null` if no violation, or a `ConstraintViolation` describing the
 *          first violated constraint (checked in H1→H5 order).
 */
export function checkHardConstraints(
  candidate: Candidate,
  venues: Venue[],
  cohortMap: Map<string, Cohort>,
  committed: ProposedSession[],
  unavailableSlots: Set<string>,      // "lecturerId|timeSlotId"
): ConstraintViolation | null {

  const { course_id, lecturer_id, venue_id, time_slot_id, cohort_ids } = candidate

  // ── H1: Lecturer unavailability (explicit blocks from lecturer_unavailability)
  // Checked before scanning committed sessions — cheaper and more common cause.
  if (unavailableSlots.has(`${lecturer_id}|${time_slot_id}`)) {
    return {
      constraint: 'H1',
      reason: `Lecturer is marked unavailable for slot ${time_slot_id}`,
    }
  }

  // Scan all already-committed sessions once for H1, H2, H3, H4 together.
  // A single pass is more efficient than four separate loops.
  for (const session of committed) {

    // ── H1: No lecturer double-booking ───────────────────────────────────────
    // The same lecturer cannot appear in two sessions at the same time slot.
    if (
      session.lecturer_id === lecturer_id &&
      session.time_slot_id === time_slot_id
    ) {
      return {
        constraint: 'H1',
        reason: `Lecturer ${lecturer_id} is already teaching at slot ${time_slot_id}`,
      }
    }

    // ── H2: No venue double-booking ───────────────────────────────────────────
    // A venue cannot host two sessions at the same time slot.
    if (
      session.venue_id === venue_id &&
      session.time_slot_id === time_slot_id
    ) {
      return {
        constraint: 'H2',
        reason: `Venue ${venue_id} is already occupied at slot ${time_slot_id}`,
      }
    }

    // ── H3: No cohort clash ───────────────────────────────────────────────────
    // No cohort may appear in two different sessions at the same time slot.
    // This covers both same-department and cross-department shared courses.
    if (session.time_slot_id === time_slot_id) {
      const clashingCohort = cohort_ids.find((cid) =>
        session.cohort_ids.includes(cid)
      )
      if (clashingCohort) {
        return {
          constraint: 'H3',
          reason: `Cohort ${clashingCohort} already has a session at slot ${time_slot_id}`,
        }
      }
    }

    // ── H4: No duplicate course scheduling ───────────────────────────────────
    // A course may only appear once in the timetable unless is_repeat is true.
    // The solver handles repeat courses by splitting them into two separate
    // scheduling units (course_id + '_repeat'), so by the time we reach this
    // check the course_ids are already distinct per unit — we still guard here
    // against accidental double-scheduling of the same unit.
    if (session.course_id === course_id) {
      return {
        constraint: 'H4',
        reason: `Course ${course_id} has already been scheduled`,
      }
    }
  }

  // ── H5: Venue capacity ───────────────────────────────────────────────────────
  // The venue's capacity must be ≥ the combined student_count of all cohorts
  // that will attend this session.
  const venue = venues.find((v) => v.id === venue_id)
  if (!venue) {
    // Should never happen if the solver is passed a consistent snapshot,
    // but guard defensively.
    return {
      constraint: 'H5',
      reason: `Venue ${venue_id} not found in snapshot`,
    }
  }

  const totalStudents = cohort_ids.reduce((sum, cid) => {
    const cohort = cohortMap.get(cid)
    return sum + (cohort?.student_count ?? 0)
  }, 0)

  if (venue.capacity < totalStudents) {
    return {
      constraint: 'H5',
      reason:
        `Venue "${venue.name}" capacity ${venue.capacity} < combined enrolment ${totalStudents}`,
    }
  }

  // All hard constraints satisfied.
  return null
}