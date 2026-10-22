import { DustMotes } from "@/components/dust-motes";
import { StoneWall } from "@/components/stone-wall";
import { WallSconce } from "@/components/wall-sconce";

// The room around every page: warm light under the chandelier, wall sconces with
// stone around them on wide screens, dust in the chandelier light. The chandelier
// itself hangs in the header. Pages with their own sconce (the doorway) hide the
// wall sconces (`layout-sconce`).
//
// A sconce's left edge is max(4px, 50% - 630px): in the empty margin next to the
// content, never off the screen. Light and stone are centred on the sconce.
export function Candlelight() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-160 overflow-hidden">
      {/* The light, stone and dust sit in `snuff-light` wrappers: after a contact is deleted the
          candles go out and the room goes dark, after "Связались" the candles flare up and the
          room grows lighter. The flicker animates the light itself. */}
      <div className="snuff-light">
        <div className="candle-light absolute -top-38 left-1/2 hidden h-130 w-180 -translate-x-1/2 rounded-full bg-(image:--glow-chandelier) md:block" />
        <div className="candle-light absolute -top-24 -right-30 h-95 w-100 rounded-full bg-(image:--glow-chandelier) md:hidden" />
      </div>

      <div className="layout-sconce hidden sconce:block">
        <div className="snuff-light">
          <div className="candle-light absolute -top-4 left-[calc(max(4px,50%_-_630px)_-_130px)] size-90 rounded-full" />
          <div
            className="candle-light absolute -top-4 right-[calc(max(4px,50%_-_630px)_-_130px)] size-90 rounded-full"
            style={{ animationDuration: "4.5s", animationDelay: "-1.4s" }}
          />
          <StoneWall id="stone-left" className="absolute -top-6 left-[calc(max(4px,50%_-_630px)_-_140px)] size-95" />
          <StoneWall
            id="stone-right"
            offset={44}
            className="absolute -top-6 right-[calc(max(4px,50%_-_630px)_-_140px)] size-95"
          />
        </div>
        {/* The candles go out in a wave: left sconce, the chandelier in the header, right sconce */}
        <WallSconce id="sconce-left" side="left" className="absolute top-32.5 left-[max(4px,50%_-_630px)] h-37.5 w-25" />
        <WallSconce
          id="sconce-right"
          side="right"
          snuffDelay={0.65}
          className="absolute top-32.5 right-[max(4px,50%_-_630px)] h-37.5 w-25"
        />
      </div>

      <div className="snuff-light">
        <DustMotes className="top-18 left-1/2 hidden h-75 w-130 -translate-x-1/2 md:block" />
        <DustMotes className="top-20 right-0 h-55 w-57.5 md:hidden" />
      </div>
    </div>
  );
}
