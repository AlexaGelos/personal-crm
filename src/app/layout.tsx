import type { Metadata } from "next";
import { Onest } from "next/font/google";
import Link from "next/link";

import { Logo } from "@/components/logo";

import "./globals.css";

// The landing's font
const onest = Onest({
  variable: "--font-sans",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: {
    default: "Личная CRM",
    template: "%s · Личная CRM",
  },
  description: "Контакты людей, которых я знаю лично",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${onest.variable} dark h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-(image:--glow-page) bg-no-repeat lg:bg-(image:--glow-page-lg)">
        <header>
          <div className="mx-auto flex h-14 w-full max-w-5xl items-center px-5 lg:px-10">
            <Link
              href="/"
              // Padding with negative margins: a finger-sized tap area, same layout
              className="-mx-2 flex items-center gap-2.5 rounded-full px-2 py-2.5 text-base font-semibold tracking-logo outline-none focus-visible:ring-3 focus-visible:ring-ring/50 lg:gap-3 lg:text-lg"
            >
              <Logo className="size-5.5 lg:size-6.5" aria-hidden />
              Личная CRM
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-5 pt-4 pb-12 lg:px-10 lg:pt-8 lg:pb-20">
          {children}
        </main>
      </body>
    </html>
  );
}
