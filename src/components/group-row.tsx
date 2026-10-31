"use client";

import { Fragment, useCallback, useLayoutEffect, useRef, useState } from "react";
import { cn } from "cn";
import { ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";

const LINES = 2;

// How many lines the buttons take when they wrap like the row does. A button wider than
// the row wraps its text and takes the whole width. A close call counts as a wrap, so the row
// never ends up a line longer than counted
function lineCount(widths: number[], rowWidth: number, gap: number) {
  let lines = 0;
  let used = 0;
  for (const width of widths.map((width) => Math.min(width, rowWidth))) {
    if (lines === 0 || used + gap + width > rowWidth - 0.5) {
      lines++;
      used = width;
    } else {
      used += gap + width;
    }
  }
  return lines;
}

// The row of groups under the heading: "Все" and the groups, then "Настроить группы". If the
// groups take more than two lines, the row shows what fits in two lines with «Ещё N» at the end;
// «Ещё» opens the whole row in place, «Свернуть» closes it. A chosen group from the hidden part
// opens the row from the start. A copy of the row nobody sees tells the width of every button
export function GroupRow({
  items,
  selected,
  settings,
}: {
  // "Все" first, then the groups by name
  items: React.ReactNode[];
  // Index of the chosen item in items
  selected: number;
  settings: React.ReactNode;
}) {
  const rowRef = useRef<HTMLElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  // How many items fit in two lines next to «Ещё», or all of them when they fit by themselves.
  // null until measured: on the server and before the page comes alive
  const [fit, setFit] = useState<number | null>(null);
  // null - nobody has pressed «Ещё» or «Свернуть» yet
  const [open, setOpen] = useState<boolean | null>(null);
  // The button to move the focus to after «Ещё» or «Свернуть»: the one pressed is gone
  const focusAt = useRef<number | null>(null);

  const measure = useCallback(() => {
    const row = rowRef.current;
    const copy = copyRef.current;
    if (!row || !copy || row.clientWidth === 0) return;

    const widths = [...copy.children].map((child) => child.getBoundingClientRect().width);
    const itemWidths = widths.slice(0, items.length);
    const moreWidth = widths[items.length];
    const rowWidth = row.clientWidth;
    const gap = parseFloat(getComputedStyle(row).columnGap) || 0;

    // "Настроить группы" may go to the third line: no group hides just to make room for it
    if (lineCount(itemWidths, rowWidth, gap) <= LINES) {
      setFit(items.length);
      return;
    }
    let count = items.length - 1;
    while (
      count > 1 &&
      lineCount([...itemWidths.slice(0, count), moreWidth], rowWidth, gap) > LINES
    ) {
      count--;
    }
    setFit(count);
  }, [items.length]);

  // Measured again when the groups change: a renamed group is wider or narrower
  useLayoutEffect(() => {
    measure();
    const observer = new ResizeObserver(measure);
    if (rowRef.current) observer.observe(rowRef.current);
    // The buttons get wider when the web fonts arrive
    document.fonts?.ready.then(measure);
    return () => observer.disconnect();
  }, [measure, items]);

  useLayoutEffect(() => {
    if (focusAt.current === null || !rowRef.current) return;
    (rowRef.current.children[focusAt.current] as HTMLElement | undefined)?.focus();
    focusAt.current = null;
  });

  const overflows = fit !== null && fit < items.length;
  const expanded = overflows && (open ?? selected >= fit);

  // The focus goes to the first group that comes into sight, or back to «Ещё»:
  // both stand right after the groups that are always in sight
  function toggle(nextOpen: boolean) {
    focusAt.current = fit;
    setOpen(nextOpen);
  }

  const settingsLink = <Fragment key="settings">{settings}</Fragment>;

  let shown: React.ReactNode[];
  if (!overflows) {
    shown = [...items, settingsLink];
  } else if (expanded) {
    shown = [
      ...items,
      <Button key="less" type="button" variant="ghost" onClick={() => toggle(false)}>
        Свернуть
        <ChevronUp data-icon="inline-end" aria-hidden />
      </Button>,
      settingsLink,
    ];
  } else {
    shown = [
      ...items.slice(0, fit),
      <MoreButton key="more" hidden={items.length - fit} onClick={() => toggle(true)} />,
    ];
  }

  return (
    <div className="relative">
      <nav
        ref={rowRef}
        aria-label="Группы"
        // Until measured, two lines of buttons: the long row does not flash on a phone
        className={cn("flex flex-wrap gap-1.5", fit === null && "max-h-23.5 overflow-hidden")}
      >
        {shown}
      </nav>
      {/* Every button of the row, laid out at the row's width, out of sight and out of reach */}
      <div
        ref={copyRef}
        aria-hidden
        inert
        className="invisible absolute inset-x-0 top-0 flex h-0 flex-wrap gap-1.5 overflow-hidden"
      >
        {items}
        {/* As wide as «Ещё» can get */}
        <MoreButton hidden={items.length} />
      </div>
    </div>
  );
}

function MoreButton({ hidden, onClick }: { hidden: number; onClick?: () => void }) {
  return (
    <Button type="button" variant="ghost" onClick={onClick}>
      Ещё {hidden}
      <ChevronDown data-icon="inline-end" aria-hidden />
    </Button>
  );
}
