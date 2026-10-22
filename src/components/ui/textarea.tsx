import * as React from "react"
import { cn } from "cn"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-26 w-full rounded-field border border-input bg-field px-3.5 py-3 text-base leading-relaxed transition-[color,border-color,box-shadow] duration-400 outline-none placeholder:text-subtle-foreground focus-visible:border-glow-line focus-visible:shadow-glow-field disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive-line aria-invalid:shadow-invalid md:text-[0.9375rem]",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
