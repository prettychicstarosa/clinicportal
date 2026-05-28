import type { PermissionKey, StaffPermissions } from "./types";

export const PERMISSION_TABS: { key: PermissionKey; label: string }[] = [
  { key: "dashboard",    label: "Dashboard" },
  { key: "clients",      label: "Clients" },
  { key: "appointments", label: "Appointments" },
  { key: "packages",     label: "Packages" },
  { key: "payments",     label: "Payments" },
  { key: "expenses",     label: "Expenses" },
  { key: "inventory",    label: "Inventory" },
  { key: "income",       label: "Income" },
  { key: "reports",      label: "Reports" },
  { key: "settings",     label: "Settings" },
  { key: "guidelines",   label: "Guidelines" }
];

export const DEFAULT_PERMISSIONS: Omit<StaffPermissions, "profile_id"> = {
  dashboard:    true,
  clients:      true,
  appointments: true,
  packages:     true,
  payments:     true,
  expenses:     false,
  inventory:    true,
  income:       false,
  reports:      false,
  settings:     false,
  guidelines:   true
};
