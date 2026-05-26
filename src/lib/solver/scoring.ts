/**
 * scoring.ts
 *
 * Soft-constraint penalty scorer for the lecture scheduling CSP solver.
 *
 * Three soft constraints from the spec are penalised here:
 *   S1 — Spread cohort load evenly across the week
 *        Penalty: number of sessions any of the candidate's cohorts already
 *        have on the same day — rewards spreading work across Mon–Fri.
 *
 *   S2 — Avoid back-to-back sessions for the same cohort
 *        Penalty: +2 per cohort that already has a session in the immediately
 *        adjacent slot on the same day (slot before or slot after).
 *
 *   S3 — Avoid more than 2 sessions per day for the same lecturer
 *        Penalty: +3 if the lecturer already has ≥ 2 sessions on that day.
 *        A steeper penalty because lecturer overload is more disruptive.
 *
 * Lower total penalty = better candidate; the solver tries lower-penalty
 * candidates first before recursing (greedy ordering within backtracking).
 *
 * This module has ZERO imports from Next.js, Supabase, or any runtime library.
 */

import type { ProposedSession, TimeSlot } from '@/lib/types/domain'
import type { Candidate } from './constraints'

// ─── Penalty weights ──────────────────────────────────────────────────────────
// Kept as named constants so they are easy to tune without touching the logic.

const PENALTY_COHORT_SAME_DAY = 1   // S1 — per cohort-session already on this day
const PENALTY_BACK_TO_BACK    = 2   // S2 — per cohort with an adjacent session
const PENALTY_LECTURER_BUSY   = 3   // S3 — lecturer already has ≥2 sessions today

// ─── Main exported function ───────────────────────────────────────────────────

/**
 * scoreSoftConstraints
 *
 * Returns a non-negative integer penalty for placing `candidate` into the
 * draft timetable given what has already been committed.
 *
 * The caller should prefer candidates with a lower score when choosing the
 * order in which to try assignments during backtracking.
 *
 * @param candidate   — The slot/venue/cohorts being evaluated
 * @param committed   — Sessions already accepted into the draft timetable
 * @param timeSlotMap — Map of time_slot_id → TimeSlot (for day_of_week lookup)
 *
 * @returns A penalty integer ≥ 0.  Zero means no soft-constraint pressure.
 */
export function scoreSoftConstraints(
  candidate: Candidate,
  committed: ProposedSession[],
  timeSlotMap: Map<string, TimeSlot>,
): number {

  const { lecturer_id, time_slot_id, cohort_ids } = candidate

  // Resolve the candidate's day from the time slot map.
  const candidateSlot = timeSlotMap.get(time_slot_id)
  if (!candidateSlot) {
    // If the slot isn't in the map something is wrong with the snapshot;
    // return 0 to avoid blocking the solver — hard constraints will catch
    // genuine data problems.
    return 0
  }

  const candidateDay   = candidateSlot.day_of_week
  const candidateStart = candidateSlot.start_time   // e.g. "10:00:00"

  let penalty = 0

  // Collect per-day info from committed sessions in a single pass.
  // We track:
  //   - how many sessions each cohort already has on candidateDay (S1)
  //   - the set of start_times already used by cohorts on candidateDay (S2)
  //   - how many sessions the lecturer already has on candidateDay (S3)

  // cohort_id → count of sessions on the candidate's day
  const cohortDayCount = new Map<string, number>()

  // cohort_id → set of start_time strings on the candidate's day
  const cohortDayStarts = new Map<string, Set<string>>()

  let lecturerDayCount = 0

  for (const session of committed) {
    const slot = timeSlotMap.get(session.time_slot_id)
    if (!slot || slot.day_of_week !== candidateDay) continue

    // Count lecturer sessions on this day (S3)
    if (session.lecturer_id === lecturer_id) {
      lecturerDayCount++
    }

    // Count cohort sessions and collect their start times on this day (S1, S2)
    for (const cid of session.cohort_ids) {
      if (!cohort_ids.includes(cid)) continue  // only care about our cohorts

      cohortDayCount.set(cid, (cohortDayCount.get(cid) ?? 0) + 1)

      if (!cohortDayStarts.has(cid)) cohortDayStarts.set(cid, new Set())
      cohortDayStarts.get(cid)!.add(slot.start_time)
    }
  }

  // ── S1: Cohort load spread ────────────────────────────────────────────────
  // Add one penalty unit per cohort-session already on this day.
  // More existing sessions → more penalised → solver prefers emptier days.
  for (const cid of cohort_ids) {
    penalty += (cohortDayCount.get(cid) ?? 0) * PENALTY_COHORT_SAME_DAY
  }

  // ── S2: Back-to-back detection ────────────────────────────────────────────
  // A 2-hour block occupies one slot.  Slots run 08:00, 10:00, 12:00, 14:00,
  // 16:00.  An adjacent slot starts exactly 2 hours before or after this one.
  // We parse the HH:MM portion and compare numerically.
  const [candH, candM] = candidateStart.split(':').map(Number)
  const candidateMinutes = candH * 60 + candM

  for (const cid of cohort_ids) {
    const existingStarts = cohortDayStarts.get(cid)
    if (!existingStarts) continue

    for (const startStr of existingStarts) {
      const [h, m] = startStr.split(':').map(Number)
      const existingMinutes = h * 60 + m
      const diff = Math.abs(candidateMinutes - existingMinutes)

      // 120 minutes = one slot gap = back-to-back
      if (diff === 120) {
        penalty += PENALTY_BACK_TO_BACK
        break  // one penalty per cohort, regardless of how many adjacent slots
      }
    }
  }

  // ── S3: Lecturer daily load ───────────────────────────────────────────────
  // Apply a steeper penalty if the lecturer already has 2+ sessions today.
  if (lecturerDayCount >= 2) {
    penalty += PENALTY_LECTURER_BUSY
  }

  return penalty
}