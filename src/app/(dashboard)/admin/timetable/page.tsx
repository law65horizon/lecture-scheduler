"use client"

import { useMemo, useState } from "react"
import {
  CalendarDays,
  ChevronDown,
  Clock3,
  Filter,
  GraduationCap,
  LocateFixed,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
  Wand2,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
} from "lucide-react"

type Session = {
  id: number
  courseCode: string
  courseTitle: string
  lecturer: string
  venue: string
  faculty: string
  department: string
  level: string
  day: string
  start: string
  end: string
  capacity: number
  enrolled: number
  conflict?: boolean
}

const timetableData: Session[] = [
  {
    id: 1,
    courseCode: "CSC 401",
    courseTitle: "Operating Systems",
    lecturer: "Dr. Amadi",
    venue: "LH1",
    faculty: "Computing",
    department: "Computer Science",
    level: "400",
    day: "Monday",
    start: "08:00",
    end: "10:00",
    capacity: 120,
    enrolled: 98,
  },
  {
    id: 2,
    courseCode: "CSC 405",
    courseTitle: "Artificial Intelligence",
    lecturer: "Prof. Nwosu",
    venue: "Lab 2",
    faculty: "Computing",
    department: "Computer Science",
    level: "400",
    day: "Monday",
    start: "10:00",
    end: "12:00",
    capacity: 60,
    enrolled: 52,
  },
  {
    id: 3,
    courseCode: "CYB 403",
    courseTitle: "Network Security",
    lecturer: "Dr. Bello",
    venue: "LH2",
    faculty: "Computing",
    department: "Cyber Security",
    level: "400",
    day: "Tuesday",
    start: "09:00",
    end: "11:00",
    capacity: 100,
    enrolled: 88,
  },
  {
    id: 4,
    courseCode: "GST 411",
    courseTitle: "Entrepreneurship",
    lecturer: "Mrs. Okon",
    venue: "LH1",
    faculty: "General Studies",
    department: "GST",
    level: "400",
    day: "Wednesday",
    start: "13:00",
    end: "15:00",
    capacity: 120,
    enrolled: 150,
    conflict: false,
  },
  {
    id: 5,
    courseCode: "SE 402",
    courseTitle: "Software Architecture",
    lecturer: "Dr. Ibrahim",
    venue: "Lab 1",
    faculty: "Computing",
    department: "Software Engineering",
    level: "400",
    day: "Thursday",
    start: "11:00",
    end: "13:00",
    capacity: 50,
    enrolled: 45,
  },
]

const weekDays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
]

function StatCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string
  value: string | number
  icon: any
  color: string
}) {
  return (
    <div style={{padding: '20px'}} className="rounded-2xl mb-4 border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <h3 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">
            {value}
          </h3>
        </div>

        <div
          style={{padding: '10px'}}
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${color}`}
        >
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </div>
  )
}

export default function AdminTimetablePage() {
  const [selectedDay, setSelectedDay] = useState("Monday")
  const [search, setSearch] = useState("")
  const [department, setDepartment] = useState("All")

  const filtered = useMemo(() => {
    return timetableData.filter((item) => {
      const matchesDay = item.day === selectedDay

      const matchesSearch =
        item.courseCode.toLowerCase().includes(search.toLowerCase()) ||
        item.courseTitle.toLowerCase().includes(search.toLowerCase()) ||
        item.lecturer.toLowerCase().includes(search.toLowerCase())

      const matchesDept =
        department === "All" || item.department === department

      return matchesDay && matchesSearch && matchesDept
    })
  }, [selectedDay, search, department])

  const totalCourses = timetableData.length
  const conflicts = timetableData.filter((x) => x.conflict).length
  const totalVenues = new Set(timetableData.map((x) => x.venue)).size
  const utilization = "82%"

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="mb-4">
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
            University Timetable
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Centralized lecture scheduling, venue management, and conflict
            monitoring
          </p>
        </div>

        <div className="flex mb-4 flex-wrap items-center gap-3">
          <button className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
            <CalendarDays className="h-4 w-4" />
            Semester 1
            <ChevronDown className="h-4 w-4" />
          </button>

          <button className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700">
            <Wand2 className="h-4 w-4" />
            Auto Generate
          </button>

          <button className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
            <Plus className="h-4 w-4" />
            Add Session
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Courses"
          value={totalCourses}
          icon={BookOpen}
          color="bg-blue-600"
        />

        <StatCard
          title="Venue Utilization"
          value={utilization}
          icon={LocateFixed}
          color="bg-emerald-600"
        />

        <StatCard
          title="Total Venues"
          value={totalVenues}
          icon={GraduationCap}
          color="bg-violet-600"
        />

        <StatCard
          title="Conflicts"
          value={conflicts}
          icon={AlertTriangle}
          color="bg-red-500"
        />
      </div>

      {/* Filters */}
      <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row">
            {/* Search */}
            <div style={{display: 'flex', gap: 10}} className="relative flex-1">
              {/* <Search className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" /> */}

              <input
                value={search}
                style={{padding: '10px'}}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search course, lecturer, or code..."
                className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 text-sm outline-none transition focus:border-blue-500"
              />
            </div>

            {/* Department */}
            <div className="relative mb-5">
              {/* <Filter className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" /> */}

              <select
                style={{padding: '5px'}}
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="h-11 min-w-[220px] appearance-none rounded-xl border border-gray-200 bg-white pl-10 pr-10 text-sm outline-none transition focus:border-blue-500"
              >
                <option>All</option>
                <option>Computer Science</option>
                <option>Software Engineering</option>
                <option>Cyber Security</option>
                <option>GST</option>
              </select>

              {/* <ChevronDown className="absolute right-3 top-3.5 h-4 w-4 text-gray-400" /> */}
            </div>
          </div>

          {/* Days */}
          <div className="inline-flex rounded-xl border border-gray-100 bg-gray-50 p-1">
            {weekDays.map((day) => {
              const active = selectedDay === day

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-white text-blue-700 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {day.slice(0, 3)}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Course
                </th>

                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Lecturer
                </th>

                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Venue
                </th>

                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Time
                </th>

                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Department
                </th>

                <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Capacity
                </th>

                <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-50">
              {filtered.map((session) => (
                <tr
                  key={session.id}
                  className="transition-colors hover:bg-gray-50/60"
                >
                  {/* Course */}
                  <td className="px-5 py-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">
                          {session.courseCode}
                        </span>

                        {session.conflict ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600 ring-1 ring-inset ring-red-200">
                            <AlertTriangle className="h-3 w-3" />
                            Conflict
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-600 ring-1 ring-inset ring-emerald-200">
                            <CheckCircle2 className="h-3 w-3" />
                            Scheduled
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-sm text-gray-500">
                        {session.courseTitle}
                      </p>
                    </div>
                  </td>

                  {/* Lecturer */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2 text-gray-700">
                      <Users className="h-4 w-4 text-blue-600" />
                      {session.lecturer}
                    </div>
                  </td>

                  {/* Venue */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2 text-gray-700">
                      <LocateFixed className="h-4 w-4 text-blue-600" />
                      {session.venue}
                    </div>
                  </td>

                  {/* Time */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2 text-gray-700">
                      <Clock3 className="h-4 w-4 text-blue-600" />
                      {session.start} - {session.end}
                    </div>
                  </td>

                  {/* Department */}
                  <td className="px-5 py-4">
                    <div>
                      <p className="font-medium text-gray-800">
                        {session.department}
                      </p>

                      <p className="text-xs text-gray-400">
                        Level {session.level}
                      </p>
                    </div>
                  </td>

                  {/* Capacity */}
                  <td className="px-5 py-4">
                    <div>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>
                          {session.enrolled}/{session.capacity}
                        </span>

                        <span>
                          {Math.round(
                            (session.enrolled / session.capacity) * 100
                          )}
                          %
                        </span>
                      </div>

                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
                        <div
                          style={{
                            width: `${
                              (session.enrolled / session.capacity) * 100
                            }%`,
                          }}
                          className={`h-full rounded-full ${
                            session.conflict
                              ? "bg-red-500"
                              : "bg-blue-600"
                          }`}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700">
                        <Pencil className="h-4 w-4" />
                      </button>

                      <button className="rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-500">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!filtered.length && (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
              <CalendarDays className="h-7 w-7 text-gray-400" />
            </div>

            <h3 className="mt-4 text-base font-semibold text-gray-900">
              No timetable entries found
            </h3>

            <p className="mt-1 text-sm text-gray-500">
              Try adjusting your search or filters.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}