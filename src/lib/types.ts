export type Role = "owner" | "admin" | "staff";

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  is_active: boolean;
  created_at: string;
};

export type Settings = {
  id: string;
  clinic_name: string;
  logo_url: string | null;
  theme_color: string;
  sidebar_color: string;
  low_stock_default: number;
  updated_at: string;
};

export type Client = {
  id: string;
  full_name: string;
  mobile: string | null;
  age: number | null;
  birthday: string | null;
  treatment_interested: string | null;
  package_availed: string | null;
  total_sessions: number;
  remaining_sessions: number;
  valid_until: string | null;
  balance: number;
  payment_status: "Paid" | "Partial" | "Unpaid";
  registration_date: string;
  signed_consent: boolean;
  notes: string | null;
  allergies: string | null;
  facebook: string | null;
  /** @deprecated kept for backward-compat; superseded by `facebook` */
  emergency_contact: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Appointment = {
  id: string;
  client_id: string;
  package_id: string | null;
  session_index: number | null;
  date: string;
  time: string;
  treatment: string | null;
  status: "Scheduled" | "Done" | "No Show" | "Cancelled" | "Rescheduled";
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
};

export type Package = {
  id: string;
  client_id: string;
  name: string;
  total_sessions: number;
  used_sessions: number;
  price: number;
  amount_paid: number;
  balance: number;
  payment_status: "Paid" | "Partial" | "Unpaid";
  status: "Active" | "Completed" | "Cancelled" | "Expired";
  start_date: string | null;
  valid_until: string | null;
  interval_days: number | null;
  interval_label: string | null;
  created_at: string;
  created_by: string | null;
};

// Kept for backward compat with sessions table (now hidden behind Packages UI).
export type SessionRow = {
  id: string;
  client_id: string;
  first_session_date: string | null;
  session_date: string | null;
  session_time: string | null;
  amount_paid: number;
  balance: number;
  interval_days: number | null;
  expiry_date: string | null;
  status: "Scheduled" | "Completed" | "Cancelled";
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

export const EXPENSE_CATEGORIES = [
  "Rent", "Salary", "Supplies", "Marketing", "Utilities", "Maintenance", "Other"
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export type Expense = {
  id: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  due_date: string | null;
  expense_date: string | null;
  paid_status: "Paid" | "Unpaid" | "Partial";
  paid_amount: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

export type ContainerType = "unit" | "vial" | "box" | "bottle" | "tube";
export type ConsumeUnit =
  | "ml" | "mg" | "vial" | "box" | "tube" | "bottle" | "piece"
  | "syringe" | "ampoule" | "capsule" | "tablet" | "pack" | "kit"
  | "session use" | "custom";

export type InventoryItem = {
  id: string;
  name: string;
  item_type: "Medicine" | "Tool" | "Kit" | "Consumable";
  unit: string;
  remaining_stock: number;
  low_stock_alert: number;
  stock_status: "Available" | "Low Stock" | "Out of Stock";
  container_type: ContainerType;
  container_size: number | null;
  container_unit: "ml" | "mg" | null;
  containers: number;
  consume_unit: ConsumeUnit | null;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
};

export type InventoryLog = {
  id: string;
  item_id: string;
  action: "add" | "consume" | "update" | "create" | "adjust";
  quantity: number;
  unit: string | null;
  client_id: string | null;
  appointment_id: string | null;
  note: string | null;
  performed_by: string | null;
  created_at: string;
  item_name?: string;
  performer_name?: string;
};

export type DeletedAppointment = {
  id: string;
  appointment_id: string | null;
  client_id: string | null;
  client_name: string | null;
  package_id: string | null;
  package_name: string | null;
  treatment: string | null;
  original_date: string | null;
  original_time: string | null;
  status: string | null;
  notes: string | null;
  reason: string | null;
  deleted_by: string | null;
  deleted_by_name: string | null;
  deleted_at: string;
};

export type ActivityLog = {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  details: string | null;
  created_at: string;
};

export type PermissionKey =
  | "dashboard"
  | "clients"
  | "appointments"
  | "packages"
  | "expenses"
  | "inventory"
  | "income"
  | "reports"
  | "settings"
  | "guidelines";

export type StaffPermissions = {
  profile_id: string;
  dashboard: boolean;
  clients: boolean;
  appointments: boolean;
  packages: boolean;
  expenses: boolean;
  inventory: boolean;
  income: boolean;
  reports: boolean;
  settings: boolean;
  guidelines: boolean;
  updated_at?: string;
};

export type GuidelineCategory = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type GuidelineItem = {
  id: string;
  category_id: string;
  name: string;
  medicine_used: string | null;
  syringe_quantity: string | null;
  time: string | null;
  intensity: string | null;
  internal_cost: number;
  procedure: string | null;
  notes: string | null;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
