export type Role = "admin" | "staff";

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
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Appointment = {
  id: string;
  client_id: string;
  date: string;
  time: string;
  treatment: string | null;
  status: "Scheduled" | "Done" | "No Show" | "Cancelled" | "Rescheduled";
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
};

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

export type Expense = {
  id: string;
  title: string;
  category: "Rent" | "Salary" | "Supplies" | "Marketing" | "Utilities" | "Other";
  amount: number;
  due_date: string | null;
  paid_status: "Paid" | "Unpaid" | "Partial";
  paid_amount: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

export type InventoryItem = {
  id: string;
  name: string;
  item_type: "Medicine" | "Tool" | "Kit" | "Consumable";
  unit: string;
  remaining_stock: number;
  low_stock_alert: number;
  stock_status: "Available" | "Low Stock" | "Out of Stock";
  updated_by: string | null;
  updated_at: string;
  created_at: string;
};

export type InventoryLog = {
  id: string;
  item_id: string;
  action: "add" | "consume" | "update" | "create";
  quantity: number;
  performed_by: string | null;
  created_at: string;
  item_name?: string;
  performer_name?: string;
};

export type Payment = {
  id: string;
  client_id: string;
  amount: number;
  method: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
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
