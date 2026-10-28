"use client";

import { useLayoutEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function DeleteGroupButton({
  groupName,
  action,
  className,
}: {
  groupName: string;
  action: () => Promise<void>;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  // Don't show the dialog again when the user comes back to a hidden page
  useLayoutEffect(() => () => setOpen(false), []);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" className={className}>
          <Trash2 aria-hidden />
          Удалить
          <span className="sr-only"> группу «{groupName}»</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить группу?</AlertDialogTitle>
          <AlertDialogDescription>
            Группа «{groupName}» будет удалена. Контакты останутся, они только выйдут из этой
            группы.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form action={action}>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <ConfirmButton />
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Удаляем…" : "Удалить"}
    </Button>
  );
}
