import type { Metadata } from "next";

import { LoginForm } from "@/components/login-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Вход",
};

// No data here: the page is the same for everybody and is built ahead of time. The login of
// those who are already in is sent away by src/proxy.ts
export default function LoginPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>
            <h1 className="font-heading text-[2.5rem] leading-none font-medium text-heading">
              Вход
            </h1>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  );
}
