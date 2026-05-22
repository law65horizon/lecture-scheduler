import type { Metadata } from "next"
import { Geist } from "next/font/google"
import "./globals.css"
import { Providers } from "@/components/layout/Providers"

const geist = Geist({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Lecture Scheduler — Faculty of Computing",
  description: "Lecture timetable management system for the Faculty of Computing, University of Delta",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={geist.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}