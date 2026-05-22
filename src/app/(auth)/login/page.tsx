import { LoginForm } from "@/components/auth/LoginForm"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export default async function LoginPage() {
  // If already logged in, redirect away from login
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (profile?.role === "ADMIN") redirect("/admin/timetable")
    if (profile?.role === "LECTURER") redirect("/lecturer/timetable")
    if (profile?.role === "STUDENT") redirect("/student/timetable")
  }

  return <LoginForm />
}