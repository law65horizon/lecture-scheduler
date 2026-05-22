import { cn } from "@/lib/utils/cn"

type BadgeVariant = "blue" | "green" | "amber" | "red" | "gray" | "purple"

const variants: Record<BadgeVariant, string> = {
  blue:   "bg-blue-50 text-blue-700 ring-blue-200",
  green:  "bg-green-50 text-green-700 ring-green-200",
  amber:  "bg-amber-50 text-amber-700 ring-amber-200",
  red:    "bg-red-50 text-red-700 ring-red-200",
  gray:   "bg-gray-100 text-gray-600 ring-gray-200",
  purple: "bg-purple-50 text-purple-700 ring-purple-200",
}

interface BadgeProps {
  label: string
  variant?: BadgeVariant
  className?: string
}

export function Badge({
  label,
  variant = "gray",
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ring-1 ring-inset",
        variants[variant],
        className
      )}
    >
      {label}
    </span>
  )
}