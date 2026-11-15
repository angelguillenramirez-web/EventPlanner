import "./globals.css";
import type { Metadata, Viewport } from "next";
import { getLang } from "@/lib/i18n";

export const metadata: Metadata = { title: "Fiesta Planner", description: "Event planning: checklists, schedules, forms, documents and RSVP." };
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={lang}>
      <body>{children}</body>
    </html>
  );
}
