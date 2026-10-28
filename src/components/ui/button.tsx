import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-field border border-transparent bg-clip-padding text-xs font-medium tracking-caps whitespace-nowrap uppercase transition-all duration-400 outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive-line aria-invalid:ring-3 aria-invalid:ring-destructive-line/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-primary-line bg-primary text-primary-foreground hover:border-primary-line-hover hover:bg-primary-hover",
        // Outline buttons warm up in candlelight on hover
        outline:
          "border-line-strong bg-transparent text-soft-foreground hover:border-glow-line hover:text-glow-text hover:shadow-glow aria-expanded:border-glow-line aria-expanded:text-glow-text",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-muted aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "text-subtle-foreground hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        destructive:
          "border-destructive-line/60 bg-transparent text-rose hover:border-primary-line-hover hover:text-destructive focus-visible:border-destructive-line focus-visible:ring-destructive-line/30",
        link: "text-rose normal-case tracking-normal underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-11 gap-2 px-5 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4 has-[>svg:first-child]:pl-4",
        xs: "h-6 gap-1 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 px-3.5 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 gap-2.5 px-6 has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5 has-[>svg:first-child]:pl-5 [&_svg:not([class*='size-'])]:size-4",
        icon: "size-10",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
