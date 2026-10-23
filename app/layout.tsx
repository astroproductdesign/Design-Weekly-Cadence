import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

const mulish = localFont({
  src: "./fonts/Mulish-Variable.ttf",
  variable: "--font-mulish",
  weight: "200 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Design Cadence",
  description: "The design team's weekly check-in.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#FCFAF5",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={mulish.variable}>
      <body className="min-h-dvh">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
