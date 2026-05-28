"use client";
import Link from "next/link";
import { Logo } from "./Logo";

export function MobileTopBar({ clinicName, logoUrl }: { clinicName: string; logoUrl: string | null }) {
  return (
    <div
      className="md:hidden flex items-center justify-between px-4 py-3"
      style={{ background: "var(--color-sidebar)", color: "var(--color-sidebar-text)" }}
    >
      <Link href="/dashboard" className="flex items-center gap-2">
        <Logo src={logoUrl} name={clinicName} size={32} variant="light" />
        <span className="font-serif">{clinicName}</span>
      </Link>
    </div>
  );
}
