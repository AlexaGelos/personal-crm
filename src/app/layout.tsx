import type { Metadata } from "next";
import { Cormorant_Garamond, Onest, Ponomar } from "next/font/google";
import Link from "next/link";

import { Candlelight } from "@/components/candlelight";
import { Chandelier } from "@/components/chandelier";
import { CursorLight } from "@/components/cursor-light";
import { DemonHead } from "@/components/demon-head";
import { Logo } from "@/components/logo";
import { SideFlames } from "@/components/side-flames";

import "./globals.css";

// Text, labels and buttons
const onest = Onest({
  variable: "--font-sans",
  subsets: ["latin", "cyrillic"],
});

// Headings, names and note dates
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  subsets: ["latin", "cyrillic"],
});

// Church Slavonic lettering for the second line of the "contact deleted" message
const ponomar = Ponomar({
  variable: "--font-gothic",
  weight: "400",
  subsets: ["cyrillic"],
  fallback: ["serif"],
  // Next.js has no size metrics for this font: no size-matched fallback
  adjustFontFallback: false,
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
    <html
      lang="ru"
      className={`${onest.variable} ${cormorant.variable} ${ponomar.variable} dark h-full antialiased`}
    >
      <body className="relative flex min-h-full flex-col bg-(image:--glow-page) bg-no-repeat">
        <SideFlames />
        <Candlelight />
        <CursorLight />
        {/* Film grain over everything, like an old photograph */}
        <div aria-hidden className="film-grain pointer-events-none fixed inset-0 z-40 opacity-6" />
        <header className="border-b">
          <div className="relative mx-auto flex h-14 w-full max-w-5xl items-center px-5 lg:px-10">
            <Link
              href="/"
              // Padding with negative margins: a finger-sized tap area, same layout
              className="-mx-2 flex items-center gap-2 rounded-sm px-2 py-2.5 font-heading text-lg font-medium tracking-logo text-heading sm:gap-2.5 sm:text-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50 lg:gap-3 lg:text-[1.375rem]"
            >
              <Logo className="size-5 text-muted-foreground sm:size-5.5 lg:size-6" aria-hidden />
              Личная CRM
            </Link>
            {/* The chandelier hangs on a chain from the demon's chin; on phones from the ceiling on the right */}
            <Chandelier
              id="chandelier"
              snuffDelay={0.25}
              className="absolute top-11 left-1/2 hidden h-32.5 w-50 -translate-x-1/2 md:block"
            />
            <Chandelier id="chandelier-small" bold className="absolute top-14 right-3.5 h-16.25 w-25 md:hidden" />
            <DemonHead className="absolute left-1/2 size-10 -translate-x-1/2 text-crimson" aria-hidden />
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-5 pt-4 pb-12 md:pt-16 lg:px-10 lg:pb-20">
          {children}
        </main>
      </body>
    </html>
  );
}
