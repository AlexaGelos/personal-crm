// A single candle in a dish for empty states: never lit (nobody in the list yet)
// or just blown out, with a glowing wick and a thread of smoke (nothing found)
export function LoneCandle({ id, state }: { id: string; state: "unlit" | "snuffed" }) {
  const snuffed = state === "snuffed";
  // A snuffed candle has burnt down a little
  const top = snuffed ? 58 : 44;

  return (
    <svg aria-hidden viewBox="0 0 60 130" className="h-28 w-13 overflow-visible">
      <defs>
        <linearGradient id={`${id}-iron`} x1="0" y1="0" x2="1" y2="0">
          <stop offset={0} style={{ stopColor: "var(--iron-dark)" }} />
          <stop offset={0.45} style={{ stopColor: "var(--iron)" }} />
          <stop offset={0.6} style={{ stopColor: "var(--iron-shade)" }} />
          <stop offset={1} style={{ stopColor: "var(--iron-edge)" }} />
        </linearGradient>
        <linearGradient id={`${id}-wax`} x1="0" y1="0" x2="1" y2="0">
          <stop offset={0} style={{ stopColor: "var(--wax-edge)" }} />
          <stop offset={0.35} style={{ stopColor: "var(--wax-shade)" }} />
          <stop offset={0.55} style={{ stopColor: "var(--wax-unlit)" }} />
          <stop offset={1} style={{ stopColor: "var(--wax-edge)" }} />
        </linearGradient>
        <linearGradient id={`${id}-shade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset={0} style={{ stopColor: "var(--iron-edge)", stopOpacity: 0 }} />
          <stop offset={1} style={{ stopColor: "var(--iron-edge)", stopOpacity: 0.55 }} />
        </linearGradient>
        <radialGradient id={`${id}-ember`}>
          <stop offset={0} style={{ stopColor: "var(--ember)", stopOpacity: 0.6 }} />
          <stop offset={1} style={{ stopColor: "var(--ember)", stopOpacity: 0 }} />
        </radialGradient>
        <filter id={`${id}-smoke`} x="-200%" y="-20%" width="500%" height="140%">
          <feGaussianBlur stdDeviation="0.9" />
        </filter>
      </defs>
      <ellipse cx={30} cy={123} rx={20} ry={4.5} fill={`url(#${id}-iron)`} />
      <path d="M23.5 112H36.5L37.5 121H22.5Z" fill={`url(#${id}-iron)`} />
      <rect x={24.5} y={top} width={11} height={114 - top} rx={1} fill={`url(#${id}-wax)`} />
      <rect x={24.5} y={top} width={11} height={114 - top} rx={1} fill={`url(#${id}-shade)`} />
      <ellipse cx={30} cy={top + 0.4} rx={5.5} ry={1.4} style={{ fill: "var(--wax-unlit-top)" }} />
      {snuffed ? (
        <>
          <path
            d={`M33.4 ${top + 0.6}C33.9 ${top + 4} 33.4 ${top + 8} 33.9 ${top + 13}`}
            fill="none"
            style={{ stroke: "var(--wax-unlit-top)" }}
            strokeWidth={1.2}
            strokeLinecap="round"
          />
          <path
            d={`M30 ${top + 0.4}C30.2 ${top - 1.8} 30.8 ${top - 3.2} 31.6 ${top - 4}`}
            fill="none"
            style={{ stroke: "var(--wick)" }}
            strokeWidth={1.1}
            strokeLinecap="round"
          />
          <circle
            className="candle-ember-idle"
            cx={31.6}
            cy={top - 4}
            r={4}
            fill={`url(#${id}-ember)`}
          />
          <circle
            className="candle-ember-idle"
            cx={31.6}
            cy={top - 4}
            r={0.9}
            style={{ fill: "var(--ember)" }}
          />
          <g transform={`translate(31.6 ${top - 5})`}>
            <path
              className="candle-smoke-idle"
              d="M0 0C-3.6 -7 3.4 -13 -0.6 -21C-4.1 -28 2.4 -34 -1.1 -43C-3.6 -50 0.9 -56 -0.6 -62"
              fill="none"
              style={{ stroke: "var(--smoke)" }}
              strokeOpacity={0.7}
              strokeWidth={1.3}
              strokeLinecap="round"
              filter={`url(#${id}-smoke)`}
            />
            <path
              className="candle-smoke-idle"
              d="M0 0C2.9 -8 -3.6 -14 0.4 -23C3.4 -31 -2.6 -38 0.9 -48C2.9 -54 -1.6 -59 -0.1 -66"
              fill="none"
              style={{ stroke: "var(--smoke)", animationDelay: "-2.3s", animationDuration: "5.2s" }}
              strokeOpacity={0.55}
              strokeWidth={1}
              strokeLinecap="round"
              filter={`url(#${id}-smoke)`}
            />
          </g>
        </>
      ) : (
        <path
          d={`M30 ${top + 0.2}C30.1 ${top - 2} 30.4 ${top - 3.4} 30.8 ${top - 4.4}`}
          fill="none"
          style={{ stroke: "var(--wax-unlit-top)" }}
          strokeWidth={1}
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
