import { cn } from "cn";

import { Candle, CandleDefs, IronDefs, type Rhythm } from "@/components/candle";

// Candles on the ring, drawn in perspective: the back four stand on the far side
// of the ring, smaller and a little blurred; the front four stand in front of it
const BACK: { x: number; y: number; rhythm: Rhythm }[] = [
  { x: 42.9, y: 137, rhythm: 1 },
  { x: 134.9, y: 118.6, rhythm: 3 },
  { x: 265.1, y: 118.6, rhythm: 0 },
  { x: 357.1, y: 137, rhythm: 2 },
];
const FRONT: { x: number; y: number; rhythm: Rhythm }[] = [
  { x: 357.1, y: 163, rhythm: 0 },
  { x: 265.1, y: 181.4, rhythm: 2 },
  { x: 134.9, y: 181.4, rhythm: 1 },
  { x: 42.9, y: 163, rhythm: 3 },
];

type ChandelierProps = {
  /** Unique on the page: names the drawing's gradients */
  id: string;
  className?: string;
  /** Thicker iron for small sizes, so the chain and ring do not vanish */
  bold?: boolean;
  /** When the leftmost candle goes out after a contact is deleted; the rest follow left to right */
  snuffDelay?: number;
};

// Iron ring chandelier with eight candles, hanging on a chain from the demon head in the header
export function Chandelier({ id, className, bold = false, snuffDelay = 0 }: ChandelierProps) {
  const w = bold ? 1.6 : 1;
  // The candles go out in a wave across the ring, 0.3s from the left edge to the right one
  const delayAt = (x: number) => snuffDelay + (x / 400) * 0.3;

  return (
    <svg
      aria-hidden
      viewBox="0 0 400 260"
      className={cn(
        "pointer-events-none overflow-visible [mask-image:linear-gradient(rgb(0_0_0/0.6)_0%,#000_30%,#000_70%,rgb(0_0_0/0.35)_100%)]",
        className,
      )}
    >
      <defs>
        <CandleDefs id={id} />
        <IronDefs id={id} />
        <linearGradient id={`${id}-specular`} x1="0" y1="0" x2="1" y2="0">
          <stop offset={0.1} style={{ stopColor: "var(--specular)", stopOpacity: 0 }} />
          <stop offset={0.5} style={{ stopColor: "var(--specular)", stopOpacity: 0.32 }} />
          <stop offset={0.9} style={{ stopColor: "var(--specular)", stopOpacity: 0 }} />
        </linearGradient>
        <filter id={`${id}-depth`} x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation={bold ? 1.4 : 1} />
        </filter>
      </defs>

      {/* Chain */}
      <path
        d="M200 0V104"
        style={{ stroke: "var(--iron-chain)" }}
        strokeWidth={3.6 * w}
        strokeDasharray="7 3"
      />
      <path
        d="M200 3V104"
        style={{ stroke: "var(--iron-link)" }}
        strokeWidth={1.2 * w}
        strokeDasharray="3 7"
      />

      <g opacity={0.6} filter={`url(#${id}-depth)`}>
        {BACK.map(({ x, y, rhythm }) => (
          <g key={x}>
            <ellipse cx={x} cy={y} rx={5} ry={1.6} style={{ fill: "var(--iron-pan)" }} />
            <Candle
              id={id}
              x={x}
              top={y - 20}
              height={20}
              width={bold ? 7 : 5.5}
              flameScale={bold ? 0.75 : 0.6}
              rhythm={rhythm}
              snuffDelay={delayAt(x)}
            />
          </g>
        ))}
      </g>

      {/* Arms, ring and the light the candles throw on the front of the ring */}
      <path
        d="M200 116C240 112 300 118 368 150M200 116C160 112 100 118 32 150M200 116C218 134 238 158 262 182M200 116C182 134 162 158 138 182"
        fill="none"
        style={{ stroke: "var(--iron-rod)" }}
        strokeWidth={3.2 * w}
      />
      <ellipse
        cx={200}
        cy={150}
        rx={168}
        ry={32}
        fill="none"
        stroke={`url(#${id}-iron)`}
        strokeWidth={6 * w}
      />
      <ellipse
        cx={200}
        cy={157}
        rx={164}
        ry={31}
        fill="none"
        style={{ stroke: "var(--iron-band)" }}
        strokeWidth={2.4 * w}
      />
      <path
        d="M32 148.5A168 32 0 0 0 368 148.5"
        fill="none"
        stroke={`url(#${id}-specular)`}
        strokeWidth={1.8 * w}
      />

      {/* Hub and the pendant below it */}
      <ellipse cx={200} cy={103} rx={4 * w} ry={2 * w} style={{ fill: "var(--iron-collar)" }} />
      <ellipse cx={200} cy={112} rx={7 * w} ry={9 * w} fill={`url(#${id}-iron)`} />
      <path d="M200 120V186" style={{ stroke: "var(--iron-rod)" }} strokeWidth={3.2 * w} />
      <ellipse cx={200} cy={190} rx={5 * w} ry={5.5 * w} fill={`url(#${id}-iron)`} />
      <path
        d={`M200 195L${200 + 3.5 * w} 208L200 230L${200 - 3.5 * w} 208Z`}
        fill={`url(#${id}-iron)`}
      />

      {FRONT.map(({ x, y, rhythm }) => (
        <g key={x}>
          <ellipse cx={x} cy={y} rx={7 * w} ry={2.2 * w} fill={`url(#${id}-iron)`} />
          <Candle
            id={id}
            x={x}
            top={y - 28}
            height={28}
            width={bold ? 9 : 7}
            flameScale={bold ? 1.05 : 0.85}
            rhythm={rhythm}
            snuffDelay={delayAt(x)}
          />
        </g>
      ))}
    </svg>
  );
}
