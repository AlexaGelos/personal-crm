import { LoneCandle } from "@/components/lone-candle";

// A candle in a dish and a few words: an empty list, or nothing found
export function EmptyState({
  candle,
  title,
  hint,
}: {
  candle: "unlit" | "snuffed";
  title: string;
  hint: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2.5 rounded-card border border-dashed border-avatar-line bg-card px-7 pt-11 pb-12 text-center">
      <div className="mb-2">
        <LoneCandle id={`empty-candle-${candle}`} state={candle} />
      </div>
      <p className="font-heading text-[1.625rem] leading-tight font-medium text-heading">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}
