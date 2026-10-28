"use client";

import { useId, useState } from "react";
import { cn } from "cn";
import { Plus } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { groupNameKey, groupNameSchema } from "@/lib/validation";

export type GroupOption = { id: number; name: string };

// "Группы" section of the contact form: every group is a check box looking like a toggle button.
// The check boxes are real (name="groupId"), so the groups are saved even before JavaScript loads.
// "Новая группа" + "Добавить" needs JavaScript: a typed group shows up checked and is only
// created when the contact is saved (hidden field "newGroup")
export function GroupPicker({
  groups,
  initialIds,
  initialNewNames,
  serverError,
}: {
  groups: GroupOption[];
  initialIds: number[];
  initialNewNames: string[];
  serverError?: string;
}) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const [checkedIds, setCheckedIds] = useState(() => new Set(initialIds));
  const [newNames, setNewNames] = useState(initialNewNames);
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string>();
  const error = draftError ?? serverError;

  function toggle(id: number, checked: boolean) {
    setCheckedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function addDraft() {
    const parsed = groupNameSchema.safeParse(draft);
    if (!parsed.success) {
      setDraftError(parsed.error.issues[0]?.message);
      return;
    }

    // Same rule as the database: case and "ё" / "е" do not tell names apart
    const key = groupNameKey(parsed.data);
    const existing = groups.find((group) => groupNameKey(group.name) === key);
    if (existing) {
      toggle(existing.id, true);
    } else if (!newNames.some((name) => groupNameKey(name) === key)) {
      setNewNames((current) => [...current, parsed.data]);
    }
    setDraft("");
    setDraftError(undefined);
  }

  return (
    <fieldset className="flex min-w-0 flex-col gap-2.5">
      <legend className="mb-2.5 text-xs leading-none font-medium tracking-[0.18em] text-label uppercase">
        Группы
      </legend>

      {(groups.length > 0 || newNames.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {groups.map((group) => (
            <GroupChip
              key={group.id}
              name="groupId"
              value={String(group.id)}
              checked={checkedIds.has(group.id)}
              onChange={(checked) => toggle(group.id, checked)}
            >
              {group.name}
            </GroupChip>
          ))}
          {newNames.map((name) => (
            <GroupChip
              key={`new-${name}`}
              checked
              onChange={() => setNewNames((current) => current.filter((item) => item !== name))}
            >
              {name}
              {/* The group does not exist yet: it is created when the contact is saved */}
              <input type="hidden" name="newGroup" value={name} />
            </GroupChip>
          ))}
        </div>
      )}

      <div className="flex gap-2.5">
        <Label htmlFor={inputId} className="sr-only">
          Новая группа
        </Label>
        <Input
          id={inputId}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setDraftError(undefined);
          }}
          onKeyDown={(event) => {
            // Enter adds the group, it does not save the whole contact
            if (event.key === "Enter") {
              event.preventDefault();
              addDraft();
            }
          }}
          placeholder="Новая группа"
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
        <Button type="button" variant="outline" className="h-12 flex-none" onClick={addDraft}>
          <Plus aria-hidden />
          Добавить
        </Button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-[0.8125rem] text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}

function GroupChip({
  name,
  value,
  checked,
  onChange,
  children,
}: {
  name?: string;
  value?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="relative min-w-0 max-w-full cursor-pointer">
      <input
        type="checkbox"
        name={name}
        value={value}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      {/* The selected look is the one of the pressed frequency button */}
      <span
        className={cn(
          buttonVariants({ variant: "outline" }),
          "h-auto min-h-11 max-w-full px-4 py-2 text-left text-[0.84375rem] leading-snug tracking-normal [overflow-wrap:anywhere] whitespace-normal normal-case",
          "peer-checked:border-primary-line peer-checked:bg-primary peer-checked:text-primary-foreground",
          "peer-focus-visible:border-ring peer-focus-visible:ring-3 peer-focus-visible:ring-ring/30",
        )}
      >
        {children}
      </span>
    </label>
  );
}
