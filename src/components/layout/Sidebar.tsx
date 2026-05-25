"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils/cn"
import { Profile } from "@/lib/types/domain"
import {
  LayoutGrid,
  BookOpen,
  Building2,
  Users,
  Clock,
  CalendarDays,
  GraduationCap,
  LogOut,
  ChevronRight,
  Layers,
} from "lucide-react"
import toast from "react-hot-toast"

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
}

const ADMIN_NAV: NavItem[] = [
  { label: "Timetable",    href: "/admin/timetable",    icon: CalendarDays },
  { label: "Courses",      href: "/admin/courses",      icon: BookOpen     },
  { label: "Departments",  href: "/admin/departments",  icon: Layers       },
  { label: "Venues",       href: "/admin/venues",       icon: Building2    },
  { label: "Cohorts",       href: "/admin/cohorts",     icon: LayoutGrid    },
  { label: "Lecturers",    href: "/admin/lecturers",    icon: Users        },
  { label: "Time slots",   href: "/admin/timeslots",    icon: Clock        },
]

const LECTURER_NAV: NavItem[] = [
  { label: "My timetable", href: "/lecturer/timetable", icon: CalendarDays },
]

const STUDENT_NAV: NavItem[] = [
  { label: "My timetable", href: "/student/timetable", icon: CalendarDays },
]

function getNav(role: string): NavItem[] {
  if (role === "ADMIN")    return ADMIN_NAV
  if (role === "LECTURER") return LECTURER_NAV
  return STUDENT_NAV
}

function getRoleLabel(role: string): string {
  if (role === "ADMIN")    return "Administrator"
  if (role === "LECTURER") return "Lecturer"
  return "Student"
}

export function Sidebar({ profile }: { profile: Profile }) {
  const pathname = usePathname()
  const router = useRouter()
  const nav = getNav(profile.role)

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success("Signed out")
    router.push("/login")
    router.refresh()
  }

  return (
    <aside className="w-60 h-full bg-white border-r border-gray-100 flex flex-col shrink-0">

      {/* Brand */}
      <div className="px-5 py-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
            <GraduationCap className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
              Lecture Scheduler
            </p>
            <p className="text-xs text-gray-400 truncate">
              Faculty of Computing
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {nav.map((item) => {
          const active = pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-100 group",
                active
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <Icon
                className={cn(
                  "w-4 h-4 shrink-0",
                  active ? "text-blue-600" : "text-gray-400 group-hover:text-gray-600"
                )}
              />
              <span className="flex-1 truncate">{item.label}</span>
              {active && (
                <ChevronRight className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* User + sign out */}
      <div className="px-3 py-4 border-t border-gray-100">
        <div className="px-3 py-2.5 mb-1">
          <p className="text-sm font-medium text-gray-900 truncate">
            {profile.full_name || "User"}
          </p>
          <p className="text-xs text-gray-400 truncate">
            {getRoleLabel(profile.role)}
          </p>
        </div>
        <button
          onClick={handleSignOut}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm",
            "text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors duration-100",
            "group"
          )}
        >
          <LogOut className="w-4 h-4 shrink-0 text-gray-400 group-hover:text-red-500" />
          Sign out
        </button>
      </div>
    </aside>
  )
}