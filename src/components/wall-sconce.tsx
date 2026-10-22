import { cn } from "cn";

import { Candle, CandleDefs, IronDefs } from "@/components/candle";

// The two sconces differ a little: candles of other heights, shadow falling the other way
const SIDES = {
  left: {
    shadowX: 4,
    candles: [
      { x: 42, top: 66, height: 52, drip: "right", rhythm: 0 },
      { x: 158, top: 74, height: 44, drip: "left", rhythm: 2 },
    ],
  },
  right: {
    shadowX: -4,
    candles: [
      { x: 42, top: 76, height: 42, drip: "left", rhythm: 3 },
      { x: 158, top: 62, height: 56, drip: "right", rhythm: 1 },
    ],
  },
} as const;

type WallSconceProps = {
  /** Unique on the page: names the drawing's gradients */
  id: string;
  side: "left" | "right";
  className?: string;
  /** When the left candle goes out after a contact is deleted; the right one follows */
  snuffDelay?: number;
};

// Wrought-iron wall sconce: a pointed back plate, two curved arms, two candles and a soft shadow on the wall
export function WallSconce({ id, side, className, snuffDelay = 0 }: WallSconceProps) {
  const { shadowX, candles } = SIDES[side];

  return (
    <svg
      aria-hidden
      viewBox="0 0 200 300"
      className={cn(
        "pointer-events-none overflow-visible [mask-image:linear-gradient(#000_45%,rgb(0_0_0/0.35)_100%)]",
        className,
      )}
    >
      <defs>
        <CandleDefs id={id} />
        <IronDefs id={id} />
        <filter id={`${id}-shadow`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        <g id={`${id}-plate`}>
          <path d="M100 40C108 60 112 80 112 110V190C112 206 106 218 100 232C94 218 88 206 88 190V110C88 80 92 60 100 40Z" />
          <path d="M100 18L103.5 40H96.5Z" />
          <path d="M100 232L103 246L100 260L97 246Z" />
          <path d="M28 128H56L52 134H32Z" />
          <path d="M144 128H172L168 134H148Z" />
          <rect x={36} y={118} width={12} height={10} />
          <rect x={152} y={118} width={12} height={10} />
          <ellipse cx={100} cy={172} rx={7} ry={5} />
        </g>
        <g id={`${id}-arms`} fill="none" strokeLinecap="round">
          <path d="M100 172C78 172 58 168 50 152C45 142 42 136 42 134" strokeWidth={5.5} />
          <path d="M100 172C122 172 142 168 150 152C155 142 158 136 158 134" strokeWidth={5.5} />
          <path d="M72 171C62 178 61 190 70 195" strokeWidth={2.8} />
          <path d="M128 171C138 178 139 190 130 195" strokeWidth={2.8} />
        </g>
      </defs>

      <g opacity={0.6} filter={`url(#${id}-shadow)`} transform={`translate(${shadowX} 16)`}>
        <use href={`#${id}-plate`} style={{ fill: "var(--iron-edge)" }} />
        <use href={`#${id}-arms`} style={{ stroke: "var(--iron-edge)" }} />
      </g>
      <use href={`#${id}-arms`} style={{ stroke: "var(--iron-arm)" }} />
      <use href={`#${id}-plate`} fill={`url(#${id}-iron)`} />
      <path
        d="M100 58C104 74 106 90 106 112V188C106 200 103 208 100 216C97 208 94 200 94 188V112C94 90 96 74 100 58Z"
        fill="none"
        style={{ stroke: "var(--iron-edge)" }}
        strokeWidth={1.4}
        strokeOpacity={0.8}
      />
      {/* Candlelight on the drip pans */}
      <path d="M31 128H53M147 128H169" style={{ stroke: "var(--rim-light)" }} strokeWidth={1} />

      {candles.map((candle, index) => (
        <Candle
          key={candle.x}
          id={id}
          x={candle.x}
          top={candle.top}
          height={candle.height}
          drip={candle.drip}
          rhythm={candle.rhythm}
          flameScale={candle.height < 50 ? 0.92 : 1}
          snuffDelay={snuffDelay + index * 0.1}
        />
      ))}
    </svg>
  );
}
