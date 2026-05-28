"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, CalendarDays, Sparkles, Package,
  BookOpen, Settings as SettingsIcon
} from "lucide-react";
import clsx from "clsx";
import type { PermissionKey } from "@/lib/types";

const NAV: { href: string; label: string; icon: any; key: PermissionKey }[] = [
  { href: "/dashboard",    label: "Home",     icon: LayoutDashboard, key: "dashboard" },
  { href: "/clients",      label: "Clients",  icon: Users,           key: "clients" },
  { href: "/appointments", label: "Appts",    icon: CalendarDays,    key: "appointments" },
  { href: "/packages",     label: "Packages", icon: Sparkles,        key: "packages" },
  { href: "/inventory",    label: "Stock",    icon: Package,         key: "inventory" },
  { href: "/guidelines",   label: "Guides",   icon: BookOpen,        key: "guidelines" },
  { href: "/settings",     label: "Settings", icon: SettingsIcon,    key: "settings" }
];

export function MobileNav({ allowed }: { allowed: Record<PermissionKey, boolean> }) {
  const path = usePathname();
  const items = NAV.filter(n => allowed[n.key]).slice(0, 6);
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 border-t bg-white z-10"
         style={{ borderColor: "var(--color-border)" }}>
      <ul className="flex justify-around">
        {items.map(({ href, label, icon: Icon }) => {
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
