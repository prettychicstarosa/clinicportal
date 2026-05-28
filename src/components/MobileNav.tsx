"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, CalendarDays, Sparkles, Package, Settings as SettingsIcon
} from "lucide-react";
import clsx from "clsx";

const NAV = [
  { href: "/dashboard",    label: "Home",     icon: LayoutDashboard },
  { href: "/clients",      label: "Clients",  icon: Users },
  { href: "/appointments", label: "Appts",    icon: CalendarDays },
  { href: "/packages",     label: "Packages", icon: Sparkles },
  { href: "/inventory",    label: "Stock",    icon: Package },
  { href: "/settings",     label: "Settings", icon: SettingsIcon }
];

export function MobileNav() {
  const path = usePathname();
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 border-t bg-white z-10"
         style={{ borderColor: "var(--color-border)" }}>
      <ul className="flex justify-around">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = path === href || path.startsWith(href + "/");
          return (
            <li key={href} className="flex-1">
              <Link href={href} className={clsx(
                "flex flex-col items-center py-2 text-[11px]",
                active ? "text-mocha-500" : "text-mocha-300"
              )}>
                <Icon size={20} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
