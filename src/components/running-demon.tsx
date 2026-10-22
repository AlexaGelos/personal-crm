"use client";

import { useEffect, useRef } from "react";

import { CandleDefs, CandleFlame } from "@/components/candle";
import { DemonHeadPaths } from "@/components/demon-head";

// The drawing is 32 units square and shows as 24 px. The demon stands on the point
// between its hooves, in px from the drawing's top left corner
const SIZE = 24;
const UNIT = SIZE / 32;
const FOOT_X = 21 * UNIT;
const FOOT_Y = 32 * UNIT;

// How it moves, in px and ms
const RUN_SPEED = 0.14;
const MIN_JUMP = 50;
const MAX_JUMP = 420;
const PAUSE_MS = [400, 2500] as const;
// Gives the contact list time to load before the demon comes in
const START_MS = 1200;
// Nothing to stand on, or nowhere to run from the cursor: tries again after this long
const RETRY_MS = 2000;
const FLEE_RETRY_MS = 500;
// Never lands this close to the cursor, and runs off once the cursor comes this close
const SAFE_RADIUS = 160;
const FLEE_RADIUS = 110;
// A finger touching the screen counts as the cursor for this long
const TOUCH_MS = 1500;
// Keeps its hooves this far from the ends of an inscription
const EDGE = 6;
// Stands on the letters: this far, in font sizes, below the top of the text box, between
// the tops of capitals and of small letters
const LETTER_SINK = 0.35;

// Something to stand on: a piece of text, or a whole button for the text inside it
type Perch = { node: Text | HTMLElement; sink: number };
type Point = { x: number; y: number };
type Landing = { perch: Perch; offset: number; point: Point };

type Move =
  | { kind: "away"; until: number }
  | { kind: "stand"; until: number }
  | { kind: "run"; from: number; to: number; start: number; duration: number }
  | { kind: "jump"; from: Point; to: Perch; offset: number; start: number; duration: number; rise: number };

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "svg"]);

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const randomIn = (min: number, max: number) => min + Math.random() * (max - min);
const pickOne = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];

// The top line of a perch on the screen now; null once it is gone or too narrow to stand on
function perchBox({ node }: Perch): DOMRect | null {
  if (!node.isConnected) return null;
  if (node instanceof HTMLElement) {
    const box = node.getBoundingClientRect();
    return box.width > 2 * EDGE ? box : null;
  }
  const range = document.createRange();
  range.selectNodeContents(node);
  const line = Array.from(range.getClientRects()).find((rect) => rect.width > 0);
  const cell = node.parentElement?.getBoundingClientRect();
  if (!line || !cell) return null;
  // Text cut off with an ellipsis runs past its cell
  const left = Math.max(line.left, cell.left);
  const right = Math.min(line.right, cell.right);
  return right - left > 2 * EDGE ? new DOMRect(left, line.top, right - left, line.height) : null;
}

function pointOn(box: DOMRect, perch: Perch, offset: number): Point {
  return { x: box.left + Math.min(Math.max(offset, EDGE), box.width - EDGE), y: box.top + perch.sink };
}

// The whole demon is on the screen standing here
function fits({ x, y }: Point) {
  return x >= FOOT_X && x <= document.documentElement.clientWidth - FOOT_X && y >= SIZE && y <= window.innerHeight;
}

// Inscriptions on the screen now, each with a landing point at random on it
function landings(): Landing[] {
  const width = document.documentElement.clientWidth;
  const height = window.innerHeight;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node instanceof Text) {
        return node.data.trim().length > 1 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
      const element = node as Element;
      if (SKIP_TAGS.has(element.tagName) || element.getAttribute("aria-hidden") === "true") {
        return NodeFilter.FILTER_REJECT;
      }
      // Nothing inside a box off the screen is on the screen; an empty box may still hold something
      const box = element.getBoundingClientRect();
      const off = box.bottom < 0 || box.top > height || box.right < 0 || box.left > width;
      return box.width && box.height && off ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP;
    },
  });

  const seen = new Set<Node>();
  const found: Landing[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    const parent = text.parentElement;
    if (!parent) continue;
    const button = parent.closest<HTMLElement>("button, [data-slot=button]");
    if (seen.has(button ?? text)) continue;
    seen.add(button ?? text);
    const sink = button ? 0 : parseFloat(getComputedStyle(parent).fontSize) * LETTER_SINK;
    const perch = { node: button ?? text, sink };
    const box = perchBox(perch);
    if (!box) continue;
    const point = pointOn(box, perch, randomIn(EDGE, box.width - EDGE));
    if (fits(point)) found.push({ perch, offset: point.x - box.left, point });
  }
  return found;
}

// A little demon with a flame on the tip of its tail, on the home page only. It runs
// along inscriptions and jumps between them at random, keeps away from the cursor
// (on a touch screen, from the finger) and catches no clicks. The flame goes out and
// flares up with all the candles. With reduced motion it sits on the page heading.
export function RunningDemon() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const demon = ref.current;
    if (!demon) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    let move: Move = { kind: "away", until: performance.now() + START_MS };
    let perch: Perch | null = null;
    let offset = 0;
    let at: Point = { x: 0, y: 0 };
    let facing = 1;
    let pose = "";
    let transform = "";
    let hand: (Point & { until: number }) | null = null;
    let calmUntil = 0;
    let frame = 0;

    const handAt = (now: number) => (hand && now < hand.until ? hand : null);

    const draw = (point: Point, nextPose: string) => {
      at = point;
      const next = `translate3d(${point.x}px, ${point.y}px, 0) scaleX(${facing}) translate(${-FOOT_X}px, ${-FOOT_Y}px)`;
      if (next !== transform) demon.style.transform = transform = next;
      if (nextPose !== pose) demon.dataset.pose = pose = nextPose;
    };

    const rest = (now: number) => {
      move = { kind: "stand", until: now + randomIn(...PAUSE_MS) };
    };

    const hide = (now: number) => {
      demon.removeAttribute("data-shown");
      perch = null;
      move = { kind: "away", until: now + RETRY_MS };
    };

    const jump = (now: number, from: Point, { perch: to, offset, point }: Landing) => {
      const length = distance(from, point);
      if (point.x !== from.x) facing = point.x > from.x ? 1 : -1;
      perch = null;
      move = { kind: "jump", from, to, offset, start: now, duration: 320 + length * 0.9, rise: 16 + length * 0.2 };
    };

    // Jumps to another inscription, never next to the cursor: a random one in reach, or,
    // running away, one of the farthest from the cursor. False when there is none
    const leap = (now: number, from: Point, flee = false) => {
      const cursor = handAt(now);
      const safe = landings().filter(
        (landing) => landing.perch.node !== perch?.node && !(cursor && distance(landing.point, cursor) < SAFE_RADIUS),
      );
      const reach = safe.filter((landing) => distance(from, landing.point) <= MAX_JUMP);
      let target: Landing | undefined;
      if (flee && cursor) {
        const farthest = (reach.length ? reach : safe).sort(
          (a, b) => distance(b.point, cursor) - distance(a.point, cursor),
        );
        target = pickOne(farthest.slice(0, 3));
      } else {
        const fair = reach.filter((landing) => distance(from, landing.point) >= MIN_JUMP);
        target = fair.length ? pickOne(fair) : safe.sort((a, b) => distance(from, a.point) - distance(from, b.point))[0];
      }
      if (!target) return false;
      jump(now, from, target);
      return true;
    };

    // With reduced motion: sits still on the capital at the start of the page heading
    const sitOnHeading = (now: number) => {
      const heading = document.querySelector("main h1");
      const text = heading && document.createTreeWalker(heading, NodeFilter.SHOW_TEXT).nextNode();
      const sitting =
        heading && text instanceof Text
          ? { node: text, sink: parseFloat(getComputedStyle(heading).fontSize) * LETTER_SINK }
          : null;
      const box = sitting && perchBox(sitting);
      if (!sitting || !box) {
        move = { kind: "away", until: now + RETRY_MS };
        return;
      }
      perch = sitting;
      offset = 2 * EDGE;
      facing = 1;
      move = { kind: "stand", until: now };
      demon.setAttribute("data-shown", "");
    };

    // Jumps in from a side of the screen onto an inscription near that side
    const enter = (now: number) => {
      if (reducedMotion.matches) {
        sitOnHeading(now);
        return;
      }
      const cursor = handAt(now);
      const safe = landings().filter((landing) => !(cursor && distance(landing.point, cursor) < SAFE_RADIUS));
      if (!safe.length) {
        move = { kind: "away", until: now + RETRY_MS };
        return;
      }
      const fromLeft = Math.random() < 0.5;
      const side = safe.sort((a, b) => (fromLeft ? a.point.x - b.point.x : b.point.x - a.point.x));
      const landing = pickOne(side.slice(0, 4));
      const width = document.documentElement.clientWidth;
      demon.setAttribute("data-shown", "");
      jump(now, { x: fromLeft ? -SIZE : width + SIZE, y: landing.point.y + 40 }, landing);
    };

    const step = (now: number) => {
      frame = requestAnimationFrame(step);

      if (move.kind === "away") {
        if (now >= move.until) enter(now);
        return;
      }

      if (move.kind === "jump") {
        const { from, to, start, duration, rise } = move;
        const box = perchBox(to);
        // The landing is gone mid-air
        if (!box) {
          if (!leap(now, at)) hide(now);
          return;
        }
        const end = pointOn(box, to, move.offset);
        const t = Math.min((now - start) / duration, 1);
        // A curve whose middle is `rise` above the higher end
        const control = 2 * (Math.min(from.y, end.y) - rise) - (from.y + end.y) / 2;
        const x = from.x + (end.x - from.x) * t;
        const y = (1 - t) ** 2 * from.y + 2 * (1 - t) * t * control + t ** 2 * end.y;
        draw({ x, y }, "jump");
        if (t === 1) {
          perch = to;
          offset = move.offset;
          rest(now);
        }
        return;
      }

      const current = perch;
      const box = current && perchBox(current);
      if (!current || !box) {
        if (!leap(now, at)) hide(now);
        return;
      }
      if (move.kind === "run") {
        const t = Math.min((now - move.start) / move.duration, 1);
        offset = move.from + (move.to - move.from) * t;
        if (t === 1) rest(now);
      }
      const point = pointOn(box, current, offset);
      draw(point, move.kind === "run" ? "run" : "stand");
      if (reducedMotion.matches) return;

      // Its inscription has scrolled off the screen
      const width = document.documentElement.clientWidth;
      if (point.x < 0 || point.x > width || point.y < SIZE / 2 || point.y > window.innerHeight) {
        if (!leap(now, point)) hide(now);
        return;
      }

      const cursor = handAt(now);
      if (cursor && now >= calmUntil && distance(point, cursor) < FLEE_RADIUS) {
        if (!leap(now, point, true)) calmUntil = now + FLEE_RETRY_MS;
        return;
      }

      if (move.kind !== "stand" || now < move.until) return;
      // Now and then a run along the same inscription, otherwise a jump to another one
      offset = Math.min(Math.max(offset, EDGE), box.width - EDGE);
      if (box.width > 60 && Math.random() < 0.4) {
        const to = randomIn(EDGE, box.width - EDGE);
        const nearCursor = cursor && distance({ x: box.left + to, y: point.y }, cursor) < SAFE_RADIUS;
        if (Math.abs(to - offset) > 24 && !nearCursor) {
          facing = to > offset ? 1 : -1;
          move = { kind: "run", from: offset, to, start: now, duration: Math.abs(to - offset) / RUN_SPEED };
          return;
        }
      }
      if (!leap(now, point)) rest(now);
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "touch") hand = { x: event.clientX, y: event.clientY, until: Infinity };
    };

    // A finger counts only for a moment: then it leaves the screen
    const onDown = (event: PointerEvent) => {
      if (event.pointerType === "touch") {
        hand = { x: event.clientX, y: event.clientY, until: performance.now() + TOUCH_MS };
      }
    };

    // Nothing to go to: the mouse has left the window
    const onOut = (event: MouseEvent) => {
      if (!event.relatedTarget) hand = null;
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerdown", onDown, { passive: true });
    document.addEventListener("mouseout", onOut);
    frame = requestAnimationFrame(step);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("mouseout", onOut);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-20 overflow-hidden">
      <div
        ref={ref}
        data-pose="stand"
        className="absolute top-0 left-0 origin-top-left opacity-0 transition-opacity duration-500 data-shown:opacity-100"
      >
        <DemonFigure />
      </div>
    </div>
  );
}

// Limbs and the tail are drawn from their joint at 0,0, so they swing around it (see globals.css)
const LEG = "M0 0L1.6 5L-0.4 9.8L1.8 10.2";
const ARM = "M0 0L2.6 2.8L4.4 2";
const TAIL = "M0 0C-4.5 1.5 -9.5 0.5 -11.5 -3.5C-13 -6.5 -12 -10 -14 -12";

function Limb({ x, y, d, className }: { x: number; y: number; d: string; className: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path className={className} d={d} />
    </g>
  );
}

// The demon side on, running to the right, in the line style of the head in the header:
// goat legs, a bent arm with claws, a long tail. The far arm and leg are dimmer
function DemonFigure() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="size-6 overflow-visible text-crimson"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <defs>
        <CandleDefs id="running-demon" />
      </defs>
      <g strokeOpacity={0.5}>
        <Limb x={20.4} y={21.2} d={LEG} className="demon-leg demon-far" />
      </g>
      <g className="demon-body">
        <g strokeOpacity={0.5}>
          <Limb x={23.2} y={14.8} d={ARM} className="demon-arm demon-far" />
        </g>
        <g transform="translate(18.6 20.6)">
          <g className="demon-tail">
            <path d={TAIL} />
            {/* The candle wave reaches the tail between the chandelier and the right sconce */}
            <g
              transform="translate(-14 -12)"
              stroke="none"
              style={{ "--snuff-delay": "0.6s" } as React.CSSProperties}
            >
              <g className="demon-fire">
                <CandleFlame id="running-demon" flameScale={0.4} rhythm={2} />
              </g>
            </g>
          </g>
        </g>
        <ellipse cx={21.6} cy={17.4} rx={2.8} ry={4.2} transform="rotate(18 21.6 17.4)" />
        <g transform="translate(16.8 0) scale(0.6)" strokeWidth={2.4}>
          <DemonHeadPaths />
        </g>
        <Limb x={23.2} y={14.8} d={ARM} className="demon-arm" />
      </g>
      <Limb x={20.4} y={21.2} d={LEG} className="demon-leg" />
    </svg>
  );
}
