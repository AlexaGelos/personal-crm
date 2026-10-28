import { cn } from "cn";

// Old stone masonry that shows only in the circle of light around a candle holder
export function StoneWall({
  id,
  className,
  offset = 0,
}: {
  id: string;
  className?: string;
  offset?: number;
}) {
  return (
    <svg
      aria-hidden
      className={cn(
        "pointer-events-none [mask-image:radial-gradient(closest-side,rgb(0_0_0/0.9),rgb(0_0_0/0.35)_55%,transparent_100%)]",
        className,
      )}
    >
      <defs>
        <pattern id={id} x={offset} width={150} height={68} patternUnits="userSpaceOnUse">
          <rect width={150} height={68} style={{ fill: "var(--stone)" }} />
          <path
            d="M0 1H150M0 35H150M1 0V34M56 0V34M104 0V34M29 34V68M86 34V68M131 34V68"
            fill="none"
            style={{ stroke: "var(--stone-mortar)" }}
            strokeWidth={2}
          />
          {/* Top edges of the stones catch the light */}
          <path
            d="M2 2.5H55M57 2.5H103M105 2.5H150M0 36.5H28M30 36.5H85M87 36.5H130M132 36.5H150"
            fill="none"
            style={{ stroke: "var(--stone-lit)" }}
            strokeWidth={1}
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
