export type Role = 'ADMIN' | 'LECTURER' | 'STUDENT'
export type VenueType = 'LECTURE_HALL' | 'LAB' | 'SEMINAR_ROOM'
export type DayOfWeek = 1 | 2 | 3 | 4 | 5
export type YearLevel = 1 | 2 | 3 | 4
export type Semester = 1 | 2

export interface Department {
  id: string
  name: string
  code: string
  created_at: string
}

export interface Cohort {
  id: string
  department_id: string
  year_level: YearLevel
  student_count: number
  department?: Department
}

export interface Venue {
  id: string
  name: string
  capacity: number
  venue_type: VenueType
  is_active: boolean
}

export interface TimeSlot {
  id: string
  day_of_week: DayOfWeek
  start_time: string
  end_time: string
  is_active: boolean
}

export interface Lecturer {
  id: string
  user_id: string
  department_id: string
  staff_id: string
  full_name?: string   // joined from users table
  department?: Department
}

export interface Course {
  id: string
  code: string
  title: string
  credit_units: number
  semester: Semester
  required_venue_type: VenueType | null
  is_repeat: boolean
  created_at: string
  cohorts?: Cohort[]       // joined via course_cohorts
  lecturer?: Lecturer      // joined via course_lecturers
}

export interface TimetableSession {
  id: string
  course_id: string
  lecturer_id: string
  venue_id: string
  time_slot_id: string
  academic_year: string
  semester: Semester
  is_published: boolean
  created_at: string
  // Joined fields for display
  course?: Course
  lecturer?: Lecturer
  venue?: Venue
  time_slot?: TimeSlot
  cohorts?: Cohort[]
}

export interface Profile {
  id: string
  full_name: string | null
  role: Role
  email: string
}

// What the solver receives
export interface SolverInput {
  courses: (Course & { cohorts: Cohort[]; lecturer_id: string })[]
  venues: Venue[]
  timeSlots: TimeSlot[]
  academicYear: string
  semester: Semester
  lecturerUnavailability: Record<string, string[]>
}

// What the solver returns
export type SolverResult =
  | { success: true; sessions: ProposedSession[] }
  | { success: false; reason: string; courseCode?: string }

export interface ProposedSession {
  course_id: string
  lecturer_id: string
  venue_id: string
  time_slot_id: string
  academic_year: string
  semester: Semester
  cohort_ids: string[]
}