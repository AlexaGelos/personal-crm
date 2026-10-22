import { cn } from "cn";

// A circle with the first letter of the name, like a medallion
export function Avatar({
  name,
  size = "default",
  className,
}: {
  name: string;
  size?: "default" | "lg";
  className?: string;
}) {
  // Array.from keeps emoji and other surrogate pairs whole
  const initial = Array.from(name.trim())[0]?.toUpperCase() ?? "";

  return (
    <span
      aria-hidden
      className={cn(
        "flex flex-none items-center justify-center rounded-full border border-avatar-line bg-avatar font-heading text-soft-foreground italic transition-[border-color,box-shadow] duration-400",
        size === "lg" ? "size-16 text-3xl shadow-avatar-ring" : "size-9 text-lg",
        className,
      )}
    >
      {initial}
    </span>
  );
}
