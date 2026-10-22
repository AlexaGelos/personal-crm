import { cn } from "cn";

// Decorative tongues of flame along the left and right edges of the screen, behind the content: dim and slow
export function SideFlames() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 text-flame-edge">
      <Flames gradientId="side-flames-left" className="left-0" />
      <Flames gradientId="side-flames-right" className="right-0 -scale-x-100" />
    </div>
  );
}

// One edge: three tongues rising from the bottom, fading out upwards. Drawn for the left edge.
function Flames({ gradientId, className }: { gradientId: string; className: string }) {
  const fill = `url(#${gradientId})`;
  const flicker = "origin-bottom transform-fill";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 40 400"
      preserveAspectRatio="none"
      className={cn("absolute inset-y-0 h-full w-5 lg:w-20", className)}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0" />
          <stop offset="0.5" stopColor="currentColor" stopOpacity="0.05" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.28" />
        </linearGradient>
      </defs>
      <path
        d="M0 400V230C0 170 9 140 7 100 6 80 3 68 5 50c6 28 12 60 11 110-1 50-7 80-5 130 1 40 6 70 5 110Z"
        fill={fill}
        fillOpacity={0.8}
        className={cn(flicker, "motion-safe:animate-flame-1")}
      />
      <path
        d="M8 400c-2-50 5-80 8-120 2-30-1-50 1-80 1-15 3-28 5-40 3 30 9 55 7 95-2 35-7 55-4 90 2 25 6 40 5 55Z"
        fill={fill}
        className={cn(flicker, "motion-safe:animate-flame-2")}
      />
      <path
        d="M20 400c-1-30 6-50 7-75 1-20 2-35 4-55 3 25 8 50 6 80-1 20-4 35-1 50Z"
        fill={fill}
        fillOpacity={0.9}
        className={cn(flicker, "motion-safe:animate-flame-3")}
      />
    </svg>
  );
}
