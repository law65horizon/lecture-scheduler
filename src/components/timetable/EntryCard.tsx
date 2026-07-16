"use client"

import { MapPin, User, Pencil, EyeOff } from "lucide-react"
import { cn } from "@/lib/utils/cn"
import type { SessionRow } from "@/hooks/useTimetable"

// ─── Colour rotation ────────────────────────────────────────────────────────
//
// Cards are tinted by course code so the same course reads consistently
// across the week at a glance, without needing a legend.

const TINTS = [
  "bg-blue-50 border-blue-200 text-blue-900",
  "bg-emerald-50 border-emerald-200 text-emerald-900",
  "bg-violet-50 border-violet-200 text-violet-900",
  "bg-amber-50 border-amber-200 text-amber-900",
  "bg-rose-50 border-rose-200 text-rose-900",
  "bg-cyan-50 border-cyan-200 text-cyan-900",
  "bg-orange-50 border-orange-200 text-orange-900",
  "bg-fuchsia-50 border-fuchsia-200 text-fuchsia-900",
]

function tintFor(code: string) {
  let hash = 0
  for (let i = 0; i < code.length; i++) hash = (hash * 31 + code.charCodeAt(i)) >>> 0
  return TINTS[hash % TINTS.length]
}

interface Props {
  session: SessionRow
  /** Show lecturer name on the card. Off by default on the lecturer's own view. */
  showLecturer?: boolean
  /** Show cohort badges (department/year) on the card. */
  showCohorts?: boolean
  /** Admin-only affordance — small edit pencil in the corner. */
  editable?: boolean
  onClick?: () => void
}

export function EntryCard({
  session,
  showLecturer = true,
  showCohorts = true,
  editable = false,
  onClick,
}: Props) {
  const code = session.course?.code ?? "—"

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative rounded-lg border px-2.5 py-2 text-left w-full",
        tintFor(code),
        (editable || onClick) && "cursor-pointer hover:brightness-95 transition-[filter] duration-100"
      )}
      title={session.course?.title}
    >
      {editable && (
        <Pencil className="w-3 h-3 absolute top-2 right-2 opacity-50" />
      )}

      <p className="text-xs font-semibold leading-tight pr-4">
        {code}
        {session.course?.is_repeat && (
          <span className="ml-1 font-normal opacity-60">(repeat)</span>
        )}
      </p>

      <div className="mt-1 space-y-0.5">
        <div className="flex items-center gap-1 text-[11px] opacity-80">
          <MapPin className="w-2.5 h-2.5 shrink-0" />
          <span className="truncate">{session.venue?.name ?? "No venue"}</span>
        </div>
        {showLecturer && (
          <div className="flex items-center gap-1 text-[11px] opacity-80">
            <User className="w-2.5 h-2.5 shrink-0" />
            <span className="truncate">
              {session.lecturer?.full_name ?? "Unassigned"}
            </span>
          </div>
        )}
      </div>

      {showCohorts && session.cohorts.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {session.cohorts.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center px-1 py-0.5 rounded text-[10px] font-medium bg-white/60"
            >
              {c.departments?.code ?? "?"}/{c.year_level * 100}
            </span>
          ))}
        </div>
      )}

      {!session.is_published && (
        <div className="flex items-center gap-1 mt-1.5 text-[10px] opacity-70">
          <EyeOff className="w-2.5 h-2.5" />
          Draft
        </div>
      )}
    </div>
  )
}
