import { cn } from "@/lib/utils";

// A circle with the first letter of the name, as in the landing's illustrations
export function Avatar({ name, size = "default" }: { name: string; size?: "default" | "lg" }) {
  // Array.from keeps emoji and other surrogate pairs whole
  const initial = Array.from(name.trim())[0]?.toUpperCase() ?? "";

  return (
    <span
      aria-hidden
      className={cn(
        "flex flex-none items-center justify-center rounded-full bg-primary-tint-strong font-semibold text-primary-soft",
        size === "lg" ? "size-13 text-lg" : "size-9 text-sm",
      )}
    >
      {initial}
    </span>
  );
}
