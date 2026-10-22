"use client";

import { useActionState } from "react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { frequencyLabels } from "@/lib/format";
import {
  frequencyChoices,
  type FrequencyChoice,
  type FrequencyFormState,
} from "@/lib/validation";

// "Как часто общаться" in the card: one press saves the choice.
// A plain form with submit buttons, so it works before JavaScript loads, like the other forms
export function FrequencySwitch({
  value,
  action,
  labelledBy,
}: {
  value: FrequencyChoice;
  action: (state: FrequencyFormState, formData: FormData) => Promise<FrequencyFormState>;
  labelledBy: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-2.5">
      {/* On phones a grid: "Не задано" across the whole width, the four frequencies two by two */}
      <div
        role="group"
        aria-labelledby={labelledBy}
        className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap"
      >
        {frequencyChoices.map((choice) => {
          const selected = choice === value;
          return (
            <Button
              key={choice}
              type="submit"
              name="frequency"
              value={choice}
              variant={selected ? "default" : "outline"}
              aria-pressed={selected}
              disabled={pending}
              className={cn(
                "px-3 text-[0.84375rem] tracking-normal normal-case sm:px-4",
                choice === "none" && "col-span-2",
              )}
            >
              {frequencyLabels[choice]}
            </Button>
          );
        })}
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
