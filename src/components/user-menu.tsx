import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/session";

// The email of the user and «Выйти», on the right of the header. Nothing for those who are not in:
// on the login page there is no email and no button.
// «Выйти» is an ordinary form posting to /logout, not a button with a script: the whole page
// is loaded anew, see src/app/logout/route.ts
export async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <div className="ml-auto flex min-w-0 items-center gap-1 pl-2">
      {/* A long address is cut with "…", the whole one is in the tooltip. The button never shrinks */}
      <span title={user.email} className="min-w-0 truncate text-[0.8125rem] text-muted-foreground">
        {user.email}
      </span>
      <form action="/logout" method="post" className="flex-none">
        <Button type="submit" variant="ghost">
          Выйти
        </Button>
      </form>
    </div>
  );
}
