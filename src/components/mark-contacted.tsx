"use client";

import { Check } from "lucide-react";

import { ContactedNotice, useContactedMark } from "@/components/contacted-notice";
import { Button } from "@/components/ui/button";

// "Связались" in the card: always there, even without a frequency.
// `lastContacted` is the date of the last press, already formatted on the server
export function MarkContacted({
  contactId,
  lastContacted,
}: {
  contactId: number;
  lastContacted: string | null;
}) {
  const contacted = useContactedMark();
  const pending = contacted.isMarking(contactId);

  return (
    <div className="mt-1.5 flex flex-col gap-3.5">
      {/* On phones the date goes under the button */}
      <div className="flex flex-col items-start gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => contacted.mark(contactId)}
          disabled={pending}
          aria-busy={pending || undefined}
          className="px-4 text-[0.84375rem] tracking-normal normal-case"
        >
          <Check aria-hidden />
          Связались
        </Button>
        {lastContacted && (
          <span className="text-sm text-muted-foreground">
            Последний раз связались: <span className="text-foreground">{lastContacted}</span>
          </span>
        )}
      </div>
      {contacted.error && (
        <p role="alert" className="text-sm text-destructive">
          {contacted.error}
        </p>
      )}
      {contacted.notice && (
        <ContactedNotice
          name={contacted.notice.mark.name}
          error={contacted.notice.undoError}
          undoing={contacted.isUndoing}
          onUndo={contacted.undo}
          onClose={contacted.close}
        />
      )}
    </div>
  );
}
