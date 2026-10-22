import { StoneWall } from "@/components/stone-wall";
import { WallSconce } from "@/components/wall-sconce";

// A dark pointed doorway in the wall with one sconce beside it: the "not found" and error pages.
// `data-doorway` hides the layout's wall sconces, so this sconce is the only one.
export function Doorway({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children: React.ReactNode;
}) {
  return (
    <div data-doorway className="relative mx-auto mt-2 w-full max-w-120">
      <div aria-hidden className="hidden sconce:block">
        <div className="candle-light absolute -top-4.5 -left-74 size-105 rounded-full" />
        <StoneWall id="doorway-stone" className="absolute -top-4.5 -left-74 size-105" />
        <WallSconce id="doorway-sconce" side="left" className="absolute top-28 -left-39 h-52.5 w-35" />
      </div>

      <div className="relative flex h-150 flex-col items-center justify-end gap-3.5 px-6 pb-22 text-center sm:px-9">
        <svg aria-hidden viewBox="0 0 100 130" preserveAspectRatio="none" className="absolute inset-0 size-full">
          <defs>
            <linearGradient id="doorway-void" x1="0" y1="0" x2="0" y2="1">
              <stop offset={0} style={{ stopColor: "var(--void-deep)" }} />
              <stop offset={0.55} style={{ stopColor: "var(--void)" }} />
              <stop offset={1} style={{ stopColor: "var(--background)" }} />
            </linearGradient>
            {/* Candlelight from the sconce catches the left side of the arch */}
            <linearGradient id="doorway-lit" x1="0" y1="0" x2="1" y2="0">
              <stop offset={0} style={{ stopColor: "var(--halo)", stopOpacity: 0.18 }} />
              <stop offset={0.35} style={{ stopColor: "var(--halo)", stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          <path d="M5 130V53C5 29 24 13 50 5.5C76 13 95 29 95 53V130Z" fill="url(#doorway-void)" />
          <path
            d="M1 130V52C1 26 22 9 50 1C78 9 99 26 99 52V130"
            fill="none"
            className="stroke-heading/15"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M5 130V53C5 29 24 13 50 5.5C76 13 95 29 95 53V130"
            fill="none"
            stroke="url(#doorway-lit)"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {/* Threshold */}
        <div
          aria-hidden
          className="absolute -inset-x-5 bottom-0 h-px sm:-inset-x-15 bg-linear-to-r from-transparent via-heading/15 to-transparent"
        />
        <h1 className="relative font-heading text-[2.25rem] leading-none font-light whitespace-nowrap text-heading sm:text-[2.625rem]">
          {title}
        </h1>
        <p className="relative text-[0.9375rem] leading-relaxed text-pretty text-muted-foreground">{text}</p>
        <div className="relative mt-3">{children}</div>
      </div>
    </div>
  );
}
