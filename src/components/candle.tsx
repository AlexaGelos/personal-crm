// Candles for the candle holder drawings. Every drawing puts <CandleDefs> into its
// <defs> once and draws candles with <Candle>; `id` keeps gradients of several
// drawings on one page apart.

const FLAME_OUTER =
  "M0.6 -26C2.4 -19 4.4 -12 4.1 -6C3.8 -1.2 2.1 1.6 0 1.6C-2.1 1.6 -3.8 -1.2 -4.1 -6C-4.4 -12 -1.6 -19 0.6 -26Z";
const FLAME_INNER =
  "M0.3 -14C1.3 -10 2.1 -6.5 1.9 -3.4C1.7 -0.9 1 0.4 0 0.4C-1 0.4 -1.7 -0.9 -1.9 -3.4C-2.1 -6.5 -0.9 -10 0.3 -14Z";

// Durations and delays of the flame sway and the halo flicker; candles next to
// each other take different rhythms so they never move in step
const RHYTHMS = [
  { flame: "2.1s", flameDelay: "0s", halo: "2.4s", haloDelay: "0s" },
  { flame: "2.6s", flameDelay: "-0.7s", halo: "3.1s", haloDelay: "-1s" },
  { flame: "1.9s", flameDelay: "-1.1s", halo: "2.1s", haloDelay: "-0.5s" },
  { flame: "3s", flameDelay: "-0.3s", halo: "3.5s", haloDelay: "-1.6s" },
] as const;

export type Rhythm = 0 | 1 | 2 | 3;

function stop(offset: number, token: string, opacity = 1) {
  return <stop offset={offset} style={{ stopColor: `var(--${token})`, stopOpacity: opacity }} />;
}

export function CandleDefs({ id }: { id: string }) {
  return (
    <>
      <linearGradient id={`${id}-wax`} x1="0" y1="0" x2="1" y2="0">
        {stop(0, "wax-dark")}
        {stop(0.3, "wax")}
        {stop(0.5, "wax-light")}
        {stop(0.72, "wax-shade")}
        {stop(1, "wax-edge")}
      </linearGradient>
      {/* Candle tops glow in their own light, the bottoms sink into the dark */}
      <linearGradient id={`${id}-wax-lit`} x1="0" y1="0" x2="0" y2="1">
        {stop(0, "wax-lit", 0.6)}
        {stop(0.12, "wax-lit", 0.2)}
        {stop(0.4, "wax-lit", 0)}
        {stop(1, "iron-edge", 0.55)}
      </linearGradient>
      <linearGradient id={`${id}-flame`} x1="0" y1="0" x2="0" y2="1">
        {stop(0, "flame-tip", 0)}
        {stop(0.18, "flame-mid", 0.55)}
        {stop(0.5, "flame-body", 0.9)}
        {stop(0.82, "flame-base")}
        {stop(1, "flame-root", 0.6)}
      </linearGradient>
      <linearGradient id={`${id}-core`} x1="0" y1="0" x2="0" y2="1">
        {stop(0, "flame-core", 0)}
        {stop(0.3, "flame-core", 0.95)}
        {stop(0.8, "flame-core")}
        {stop(1, "flame-core-base", 0.7)}
      </linearGradient>
      <radialGradient id={`${id}-halo`}>
        {stop(0, "halo", 0.4)}
        {stop(0.4, "halo-outer", 0.12)}
        {stop(1, "halo-outer", 0)}
      </radialGradient>
      <filter id={`${id}-soft`} x="-50%" y="-20%" width="200%" height="140%">
        <feGaussianBlur stdDeviation="0.45" />
      </filter>
      <filter id={`${id}-bloom`} x="-200%" y="-100%" width="500%" height="300%">
        <feGaussianBlur stdDeviation="3.5" />
      </filter>
      <filter id={`${id}-smoke`} x="-200%" y="-20%" width="500%" height="140%">
        <feGaussianBlur stdDeviation="0.7" />
      </filter>
      {/* The flame, drawn with its base at 0,0 */}
      <g id={`${id}-fx`}>
        <path d={FLAME_OUTER} style={{ fill: "var(--flame-bloom)" }} fillOpacity={0.6} filter={`url(#${id}-bloom)`} />
        <g filter={`url(#${id}-soft)`}>
          <path d={FLAME_OUTER} fill={`url(#${id}-flame)`} />
          <path d={FLAME_INNER} fill={`url(#${id}-core)`} />
          <ellipse cy={-0.4} rx={1.7} ry={1.3} style={{ fill: "var(--flame-blue)" }} fillOpacity={0.45} />
          <path d="M0 1.6C0.2 -0.4 0.5 -1.8 1 -3" fill="none" style={{ stroke: "var(--wick)" }} strokeWidth={0.7} />
        </g>
      </g>
    </>
  );
}

type CandleProps = {
  /** Same id as the drawing's <CandleDefs> */
  id: string;
  /** Centre of the candle */
  x: number;
  /** Top of the wax, where the flame stands */
  top: number;
  height: number;
  width?: number;
  flameScale?: number;
  rhythm?: Rhythm;
  /** Draw a wax drip down the right or left side */
  drip?: "left" | "right";
  /**
   * Every candle goes out while the "contact deleted" message is shown and flares up while
   * the "Отмечено" message is shown (see globals.css): after this many seconds, so the
   * candles in a room change in a wave
   */
  snuffDelay?: number;
};

export function Candle({
  id,
  x,
  top,
  height,
  width = 9,
  flameScale = 1,
  rhythm = 0,
  drip,
  snuffDelay = 0,
}: CandleProps) {
  const left = x - width / 2;
  const dripX = drip === "left" ? left + 1.3 : left + width - 1.3;

  return (
    <g style={{ "--snuff-delay": `${Math.round(snuffDelay * 100) / 100}s` } as React.CSSProperties}>
      <rect x={left} y={top} width={width} height={height} rx={0.8} fill={`url(#${id}-wax)`} />
      <rect x={left} y={top} width={width} height={height} rx={0.8} fill={`url(#${id}-wax-lit)`} />
      <ellipse cx={x} cy={top + 0.4} rx={width / 2} ry={1.2} style={{ fill: "var(--wax-top)" }} fillOpacity={0.8} />
      {drip && (
        <path
          d={`M${dripX} ${top + 0.5}C${dripX + 0.4} ${top + 4} ${dripX} ${top + 8} ${dripX + 0.4} ${top + 12}`}
          fill="none"
          style={{ stroke: "var(--wax-drip)" }}
          strokeWidth={1.1}
          strokeLinecap="round"
          strokeOpacity={0.7}
        />
      )}
      {/* The wick stays visible once the flame is gone */}
      <path
        d={`M${x} ${top + 0.5}C${x + 0.2} ${top - 1.6} ${x + 0.6} ${top - 3} ${x + 1.1} ${top - 4}`}
        fill="none"
        style={{ stroke: "var(--wick)" }}
        strokeWidth={0.9}
        strokeLinecap="round"
      />
      <g transform={`translate(${x} ${top - 1})`}>
        <CandleFlame id={id} flameScale={flameScale} rhythm={rhythm} />
      </g>
    </g>
  );
}

type CandleFlameProps = {
  /** Same id as the drawing's <CandleDefs> */
  id: string;
  flameScale?: number;
  rhythm?: Rhythm;
};

// The fire of a candle with its base at 0,0: halo and flame, and the glowing wick end and
// smoke once it goes out. It goes out and flares up with all the candles after the
// `--snuff-delay` set around it (see `snuffDelay` of <Candle>)
export function CandleFlame({ id, flameScale = 1, rhythm = 0 }: CandleFlameProps) {
  const timing = RHYTHMS[rhythm];
  const scale = flameScale === 1 ? undefined : `scale(${flameScale})`;

  return (
    <>
      <g className="candle-glow">
        <circle
          className="candle-halo"
          cy={-12 * flameScale}
          r={26 * flameScale}
          fill={`url(#${id}-halo)`}
          style={{ animationDuration: timing.halo, animationDelay: timing.haloDelay }}
        />
        {/* Hidden while the candle burns as usual: a second halo when the candle flares up */}
        <circle className="candle-flare" cy={-12 * flameScale} r={26 * flameScale} fill={`url(#${id}-halo)`} />
      </g>
      <g className="candle-fire">
        <g className="candle-flame" style={{ animationDuration: timing.flame, animationDelay: timing.flameDelay }}>
          <use href={`#${id}-fx`} transform={scale} />
          {/* A second flame on top makes a flared-up fire denser and brighter */}
          <use className="candle-flare" href={`#${id}-fx`} transform={scale} />
        </g>
      </g>
      {/* Hidden while the candle burns: the glowing wick end and smoke once it goes out */}
      <g transform={scale}>
        <circle className="candle-ember" cx={1.1} cy={-3} r={1.6} style={{ fill: "var(--ember)" }} />
        <path
          className="candle-smoke"
          d="M1 -3C-2.5 -10 4.5 -16 0.5 -24C-3 -31 3.5 -37 0 -46C-2.5 -53 2 -59 0.5 -65"
          fill="none"
          style={{ stroke: "var(--smoke)" }}
          strokeWidth={2.4}
          strokeLinecap="round"
          filter={`url(#${id}-smoke)`}
        />
        <path
          className="candle-smoke candle-smoke-late"
          d="M1 -3C4 -11 -2.5 -17 1.5 -26C4.5 -34 -1.5 -41 2 -51C4 -57 -0.5 -62 1 -69"
          fill="none"
          style={{ stroke: "var(--smoke)" }}
          strokeOpacity={0.8}
          strokeWidth={1.8}
          strokeLinecap="round"
          filter={`url(#${id}-smoke)`}
        />
      </g>
    </>
  );
}

// Horizontal iron gradient: dark edges and a warm lit middle, like a round bar
export function IronDefs({ id }: { id: string }) {
  return (
    <linearGradient id={`${id}-iron`} x1="0" y1="0" x2="1" y2="0">
      {stop(0, "iron-dark")}
      {stop(0.38, "iron")}
      {stop(0.52, "iron-light")}
      {stop(0.68, "iron-shade")}
      {stop(1, "iron-edge")}
    </linearGradient>
  );
}
