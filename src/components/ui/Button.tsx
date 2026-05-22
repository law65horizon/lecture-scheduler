import { cn } from "@/lib/utils/cn"
import { Loader2 } from "lucide-react"

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger"
  size?: "sm" | "md"
  loading?: boolean
  icon?: React.ElementType
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon: Icon,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium rounded-lg",
        "focus:outline-none focus:ring-2 focus:ring-offset-2",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "transition-colors duration-100",
        size === "sm" && "px-3 py-1.5 text-xs",
        size === "md" && "px-4 py-2 text-sm",
        variant === "primary" && [
          "bg-blue-600 text-white",
          "hover:bg-blue-700 active:bg-blue-800",
          "focus:ring-blue-500",
        ],
        variant === "secondary" && [
          "bg-white text-gray-700 border border-gray-200",
          "hover:bg-gray-50 active:bg-gray-100",
          "focus:ring-gray-300",
        ],
        variant === "ghost" && [
          "bg-transparent text-gray-600",
          "hover:bg-gray-100 active:bg-gray-200",
          "focus:ring-gray-300",
        ],
        variant === "danger" && [
          "bg-red-600 text-white",
          "hover:bg-red-700 active:bg-red-800",
          "focus:ring-red-500",
        ],
        className
      )}
      {...props}
    >
      {loading
        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
        : Icon && <Icon className="w-3.5 h-3.5" />
      }
      {children}
    </button>
  )
}