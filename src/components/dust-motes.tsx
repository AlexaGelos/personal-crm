import { cn } from "cn";

// Where the motes start, in percent of the area, and how they move: `b` drifts the other way, `s` is smaller
const MOTES = [
  { top: 32, left: 26, delay: -1.5, kind: "" },
  { top: 50, left: 38, delay: -4.5, kind: "b s" },
  { top: 22, left: 52, delay: -7.5, kind: "s" },
  { top: 44, left: 64, delay: -2, kind: "" },
  { top: 34, left: 75, delay: -9.5, kind: "b" },
  { top: 66, left: 46, delay: -5.5, kind: "s" },
  { top: 58, left: 68, delay: -11.5, kind: "b" },
  { top: 40, left: 30, delay: -13, kind: "s" },
  { top: 20, left: 62, delay: -3.5, kind: "b s" },
] as const;

// Rare warm specks of dust floating in the chandelier light
export function DustMotes({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute [mask-image:radial-gradient(ellipse_50%_50%_at_50%_30%,#000_25%,transparent_100%)]",
        className,
      )}
    >
      {MOTES.map(({ top, left, delay, kind }) => (
        <span
          key={`${top}-${left}`}
          className={cn("dust-mote", kind.includes("b") && "dust-mote-b", kind.includes("s") && "dust-mote-small")}
          style={{ top: `${top}%`, left: `${left}%`, animationDelay: `${delay}s` }}
        />
      ))}
    </div>
  );
}
