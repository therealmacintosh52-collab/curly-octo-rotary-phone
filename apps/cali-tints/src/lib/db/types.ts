/**
 * Hand-written database types matching supabase/migrations.
 * Regenerate with `supabase gen types typescript` once you have a project, or
 * keep this file in sync by hand; it is the single source of truth for the app.
 */

export type UserRole = "owner" | "admin" | "detailer";
export type JobStatus = "logged" | "invoiced";
export type InvoiceStatus = "draft" | "submitted" | "partial" | "paid" | "void";
export type InvoiceMode = "batch" | "per_job";
export type SubmissionMethod = "email" | "portal" | "paper";
export type SubmissionStatus = "sent" | "failed";
export type PhotoKind = "before" | "after";
export type PaymentMethod = "check" | "ach" | "card" | "cash" | "other";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Company = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  ein: string | null;
  payment_terms: string;
  tax_rate: number;
  invoice_prefix: string;
  next_invoice_number: number;
  reminder_days: number;
  timezone: string;
  logo_path: string | null;
  created_at: string;
  updated_at: string;
}

export type Profile = {
  id: string;
  company_id: string;
  role: UserRole;
  full_name: string;
  email: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type Dealership = {
  id: string;
  company_id: string;
  name: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  ap_contact_name: string | null;
  ap_emails: string[];
  submission_method: SubmissionMethod;
  invoice_mode: InvoiceMode;
  payment_terms: string | null;
  tax_rate: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type Service = {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  default_price: number;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type DealershipServicePrice = {
  id: string;
  company_id: string;
  dealership_id: string;
  service_id: string;
  price: number;
  updated_at: string;
}

export type Job = {
  id: string;
  company_id: string;
  dealership_id: string;
  detailer_id: string;
  client_id: string;
  tag_number: string;
  vin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  color: string | null;
  performed_at: string;
  ro_po_number: string | null;
  notes: string | null;
  status: JobStatus;
  invoice_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  delete_reason: string | null;
  created_at: string;
  updated_at: string;
}

export type JobService = {
  id: string;
  company_id: string;
  job_id: string;
  service_id: string;
  price: number;
  override_reason: string | null;
  created_at: string;
}

export type JobPhoto = {
  id: string;
  company_id: string;
  job_id: string;
  kind: PhotoKind;
  storage_path: string;
  width: number | null;
  height: number | null;
  size_bytes: number | null;
  created_by: string | null;
  created_at: string;
}

export type Invoice = {
  id: string;
  company_id: string;
  dealership_id: string;
  number: number;
  display_number: string;
  period_start: string;
  period_end: string;
  ro_po_number: string | null;
  subtotal: number;
  tax_rate: number;
  tax: number;
  total: number;
  amount_paid: number;
  status: InvoiceStatus;
  payment_terms: string;
  notes: string | null;
  submitted_at: string | null;
  paid_at: string | null;
  voided_at: string | null;
  void_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type InvoiceItem = {
  id: string;
  company_id: string;
  invoice_id: string;
  job_id: string | null;
  job_service_id: string | null;
  sort_order: number;
  performed_at: string;
  tag_number: string;
  vin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  color: string | null;
  ro_po_number: string | null;
  detailer_name: string | null;
  service_name: string;
  price: number;
}

export type InvoicePayment = {
  id: string;
  company_id: string;
  invoice_id: string;
  amount: number;
  paid_at: string;
  method: PaymentMethod;
  reference: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export type InvoiceSubmission = {
  id: string;
  company_id: string;
  invoice_id: string;
  method: SubmissionMethod;
  status: SubmissionStatus;
  recipients: string[];
  cc: string[];
  provider: string | null;
  message_id: string | null;
  error: string | null;
  note: string | null;
  confirmation_path: string | null;
  created_by: string | null;
  created_at: string;
}

export type VinCache = {
  vin: string;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  body_class: string | null;
  decoded: Json;
  fetched_at: string;
}

export type AuditLog = {
  id: number;
  company_id: string;
  actor_id: string | null;
  table_name: string;
  row_id: string;
  action: "insert" | "update" | "delete";
  old_data: Json | null;
  new_data: Json | null;
  changed: string[] | null;
  created_at: string;
}

/** Shape returned by dealership_price_list(). */
export type PriceListRow = {
  service_id: string;
  name: string;
  description: string | null;
  price: number;
  is_override: boolean;
  sort_order: number;
}

/** Shape returned by find_duplicate_jobs(). */
export type DuplicateJobRow = {
  id: string;
  tag_number: string;
  vin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  performed_at: string;
  detailer_name: string;
  services: string | null;
}

/** Shape returned by dashboard_stats(). */
export type DashboardStats = {
  range: { start: string; end: string };
  week: { jobs: number; revenue: number };
  month: { jobs: number; revenue: number };
  uninvoiced_total: number;
  uninvoiced_jobs: number;
  outstanding_total: number;
  outstanding_invoices: number;
  draft_total: number;
  avg_days_to_pay: number | null;
  paid_last_90: number;
  by_service: { name: string; jobs: number; revenue: number }[];
  by_detailer: { name: string; jobs: number; revenue: number }[];
  by_day: { day: string; jobs: number; revenue: number }[];
  overdue: {
    id: string;
    display_number: string;
    dealership: string;
    total: number;
    amount_paid: number;
    submitted_at: string;
    days_outstanding: number;
  }[];
  reminder_days: number;
}

/** Payload accepted by create_job() / update_job(). */
export type JobPayload = {
  client_id?: string;
  dealership_id: string;
  detailer_id?: string;
  tag_number: string;
  vin?: string | null;
  year?: number | null;
  make?: string | null;
  model?: string | null;
  color?: string | null;
  performed_at?: string;
  ro_po_number?: string | null;
  notes?: string | null;
  services: { service_id: string; price?: number; override_reason?: string | null }[];
}

type Table<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

/** supabase-js generic. */
export type Database = {
  public: {
    Tables: {
      companies: Table<Company>;
      profiles: Table<Profile>;
      dealerships: Table<Dealership>;
      services: Table<Service>;
      dealership_service_prices: Table<DealershipServicePrice>;
      jobs: Table<Job>;
      job_services: Table<JobService>;
      job_photos: Table<JobPhoto>;
      invoices: Table<Invoice>;
      invoice_items: Table<InvoiceItem>;
      invoice_payments: Table<InvoicePayment>;
      invoice_submissions: Table<InvoiceSubmission>;
      vin_cache: Table<VinCache>;
      audit_log: Table<AuditLog>;
    };
    Views: Record<string, never>;
    Functions: {
      current_company_id: { Args: Record<string, never>; Returns: string | null };
      current_user_role: { Args: Record<string, never>; Returns: UserRole | null };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_member: { Args: Record<string, never>; Returns: boolean };
      resolve_service_price: { Args: { p_dealership_id: string; p_service_id: string }; Returns: number | null };
      dealership_price_list: { Args: { p_dealership_id: string }; Returns: PriceListRow[] };
      find_duplicate_jobs: {
        Args: { p_tag_number: string; p_vin?: string | null; p_dealership_id?: string | null };
        Returns: DuplicateJobRow[];
      };
      create_job: { Args: { p: JobPayload }; Returns: Job };
      update_job: { Args: { p_id: string; p: Partial<JobPayload> }; Returns: Job };
      soft_delete_job: { Args: { p_id: string; p_reason?: string | null }; Returns: undefined };
      restore_job: { Args: { p_id: string }; Returns: undefined };
      uninvoiced_jobs: { Args: { p_dealership_id: string; p_start: string; p_end: string }; Returns: Job[] };
      generate_invoice: {
        Args: { p_dealership_id: string; p_start: string; p_end: string; p_notes?: string | null };
        Returns: string;
      };
      generate_per_job_invoices: { Args: { p_dealership_id: string; p_notes?: string | null }; Returns: string[] };
      void_invoice: { Args: { p_id: string; p_reason?: string | null }; Returns: undefined };
      record_payment: {
        Args: {
          p_invoice_id: string;
          p_amount: number;
          p_paid_at?: string;
          p_method?: PaymentMethod;
          p_reference?: string | null;
          p_note?: string | null;
        };
        Returns: string;
      };
      mark_invoice_submitted: {
        Args: { p_invoice_id: string; p_method: SubmissionMethod; p_note?: string | null; p_confirmation_path?: string | null };
        Returns: string;
      };
      dashboard_stats: { Args: { p_start?: string | null; p_end?: string | null }; Returns: DashboardStats };
    };
    Enums: {
      user_role: UserRole;
      job_status: JobStatus;
      invoice_status: InvoiceStatus;
      invoice_mode: InvoiceMode;
      submission_method: SubmissionMethod;
      submission_status: SubmissionStatus;
      photo_kind: PhotoKind;
      payment_method: PaymentMethod;
    };
    CompositeTypes: Record<string, never>;
  };
}
