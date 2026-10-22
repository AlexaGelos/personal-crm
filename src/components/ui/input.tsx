import * as React from "react"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-12 w-full min-w-0 rounded-field border border-input bg-field px-3.5 py-1 text-base transition-[color,border-color,box-shadow] duration-400 outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-subtle-foreground focus-visible:border-glow-line focus-visible:shadow-glow-field disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive-line aria-invalid:shadow-invalid md:text-[0.9375rem]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
