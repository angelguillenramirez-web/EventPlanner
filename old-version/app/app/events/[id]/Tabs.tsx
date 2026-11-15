"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function EventTabs({ id, labels }: { id: string; labels: Record<string, string> }) {
  const path = usePathname();
  const base = `/app/events/${id}`;
  const tabs = [["", "overview"], ["/checklist", "checklist"], ["/schedule", "schedule"], ["/guests", "guests"], ["/forms", "forms"], ["/documents", "documents"]];
  return (
    <nav className="tabs no-print" aria-label="Event sections">
      {tabs.map(([p, k]) => {
        const href = base + p;
        const active = p === "" ? path === base : path.startsWith(href);
        return <Link key={k} href={href} aria-current={active ? "page" : undefined}>{labels[k]}</Link>;
      })}
    </nav>
  );
}
