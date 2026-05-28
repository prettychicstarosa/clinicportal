"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, CalendarDays, Sparkles, Receipt,
  Package, CreditCard, BarChart3, Wallet, BookOpen,
  Settings as SettingsIcon, LogOut
} from "lucide-react";
import { Logo } from "./Logo";
import clsx from "clsx";
import type { PermissionKey } from "@/lib/types";

const NAV: { href: string; label: string; icon: any; key: PermissionKey }[] = [
  { href: "/dashboard",    label: "Dashboard",    icon: LayoutDashboard, key: "dashboard" },
  { href: "/clients",      label: "Clients",      icon: Users,           key: "clients" },
  { href: "/appointments", label: "Appointments", icon: CalendarDays,    key: "appointments" },
  { href: "/packages",     label: "Packages",     icon: Sparkles,        key: "packages" },
  { href: "/payments",     label: "Payments",     icon: CreditCard,      key: "payments" },
  { href: "/inventory",    label: "Inventory",    icon: Package,         key: "inventory" },
  { href: "/guidelines",   label: "Guidelines",   icon: BookOpen,        key: "guidelines" },
  { href: "/expenses",     label: "Expenses",     icon: Receipt,         key: "expenses" },
  { href: "/income",       label: "Income",       icon: Wallet,          key: "income" },
  { href: "/reports",      label: "Reports",      icon: BarChart3,       key: "reports" },
  { href: "/settings",     label: "Settings",     icon: SettingsIcon,    key: "settings" }
];

type Props = {
  clinicName: string;
  logoUrl: string | null;
  userName: string;
  role: string;
  allowed: Record<PermissionKey, boolean>;
};

export function Sidebar({ clinicName, logoUrl, userName, role, allowed }: Props) {
  const pathname = usePathname();
  async function signOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    window.location.href = "/login";
  }
  const roleLabel = role === "owner" ? "Owner" : role === "admin" ? "Admin" : "Staff";
  const items = NAV.filter(n => allowed[n.key]);
  return (
    <aside
      className="hidden md:flex md:flex-col w-64 min-h-screen px-4 py-6 gap-2"
      style={{ background: "var(--color-sidebar)", color: "var(--color-sidebar-text)" }}
    >
      <div className="flex items-center gap-3 px-2 mb-6">
        <Logo src={logoUrl} name={clinicName} size={44} variant="light" />
        <div className="leading-tight">
          <div className="font-serif text-lg">{clinicName}</div>
          <div className="text-xs opacity-70">Clinic Portal</div>
        </div>
      </div>
      <nav className="flex-1 space-y-1">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition",
                active ? "bg-white/10 text-white" : "text-white/75 hover:bg-white/5"
              )}
            >
              <Icon size={18} /> {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-6 border-t border-white/10 pt-4 px-2 text-xs">
        <div className="font-medium">{userName}</div>
        <div className="opacity-70">{roleLabel}</div>
        <button
          onClick={signOut}
          className="mt-3 flex items-center gap-2 text-white/80 hover:text-white"
        >
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </aside>
  );
}
