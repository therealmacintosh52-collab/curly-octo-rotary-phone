/**
 * Hand-written database types matching supabase/migrations.
 * Regenerate with `supabase gen types typescript` once you have a project, or
 * keep this file in sync by hand; it is the single source of truth for the app.
 */

/** owner: everything, and the only one who sees money. admin: Settings, users, every job. manager: every job. detailer: their own cars. */
export type UserRole = "owner" | "admin" | "manager" | "detailer";
export type JobStatus = "logged" | "invoiced";
export type InvoiceStatus = "draft" | "submitted" | "partial" | "paid" | "void";
export type InvoiceMode = "batch" | "per_job";
export type SubmissionMethod = "email" | "portal" | "paper";
export type SubmissionStatus = "sent" | "failed";
export type PhotoKind = "photo" | "before" | "after";
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
  /** Every car logged becomes its own invoice on save (0015). */
  auto_invoice: boolean;
  /** Email each month's invoice to the dealership the moment it is made. */
  auto_send_monthly: boolean;
  /** QuickBooks Online: set when the owner connected the books (no secrets here). */
  quickbooks_realm_id: string | null;
  quickbooks_company_name: string | null;
  quickbooks_env: string;
  quickbooks_connected_at: string | null;
  quickbooks_item_id: string | null;
  quickbooks_item_name: string;
  quickbooks_auto_push: boolean;
  quickbooks_last_sync_at: string | null;
  quickbooks_last_error: string | null;
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
  /** When they first opened "How it works" (0026); null → offer the guide on sign-in. */
  guide_seen_at: string | null;
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
  /** The QuickBooks customer this dealership is billed as. */
  quickbooks_customer_id: string | null;
  /** The company's own shop: walk-in customers, paid at the counter, never invoiced monthly. */
  retail: boolean;
  created_at: string;
  updated_at: string;
}

export type ServiceCategory = "new" | "used" | "service" | "addon";

export type Service = {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  category: ServiceCategory;
  default_price: number;
  /** Optional quoted range; a price inside it needs no override reason. */
  price_min: number | null;
  price_max: number | null;
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
  /** The QuickBooks invoice this job is a line on (kept live). */
  quickbooks_invoice_id: string | null;
  quickbooks_doc_number: string | null;
  quickbooks_synced_at: string | null;
  /** Retail jobs: the counter payment. */
  paid_at: string | null;
  paid_amount: number | null;
  payment_method: "clover" | "cash" | "check" | "other" | null;
  payment_ref: string | null;
  paid_by: string | null;
  dup_reviewed_at: string | null;
  dup_reviewed_by: string | null;
  dup_review_note: string | null;
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
  /** What an open-amount service ("Other") actually was; shown on the invoice in place of the name. */
  label: string | null;
  /** Logged by a non-owner on an open-amount service: the owner still has to set the price. */
  needs_price: boolean;
  created_at: string;
}

/** The owner's window onto service prices (view service_prices_v; empty for everyone else). */
export type ServicePriceRow = {
  service_id: string;
  company_id: string;
  default_price: number;
  price_min: number | null;
  price_max: number | null;
}

/** The owner's window onto job line prices (view job_service_prices_v; empty for everyone else). */
export type JobServicePriceRow = {
  job_service_id: string;
  job_id: string;
  service_id: string;
  company_id: string;
  dealership_id: string;
  invoice_id: string | null;
  deleted_at: string | null;
  price: number;
  override_reason: string | null;
  needs_price: boolean;
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
  /** The id the device gave the photo; unique per job, so retried uploads never duplicate. */
  client_id: string | null;
  created_at: string;
}

/** The dealership's open QuickBooks invoice for a month, as the app last saw it (owner-readable). */
export type QuickBooksMonthInvoice = {
  id: string;
  company_id: string;
  dealership_id: string;
  month_start: string;
  qbo_invoice_id: string | null;
  doc_number: string | null;
  sync_token: string | null;
  total: number | null;
  balance: number | null;
  email_status: string | null;
  job_count: number;
  synced_at: string | null;
  error: string | null;
  invoice_id: string | null;
  created_at: string;
  updated_at: string;
}

/** The company's QuickBooks sign-in: tokens encrypted, service role only. */
export type QuickBooksConnection = {
  company_id: string;
  realm_id: string;
  env: string;
  access_token_enc: string;
  refresh_token_enc: string;
  access_expires_at: string | null;
  refresh_expires_at: string | null;
  company_name: string | null;
  status: "ok" | "needs_reconnect";
  last_error: string | null;
  last_ok_at: string | null;
  connected_by: string | null;
  connected_at: string;
  updated_at: string;
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
  /** QuickBooks Online copy of this invoice (null until sent). */
  quickbooks_invoice_id: string | null;
  quickbooks_doc_number: string | null;
  quickbooks_sync_token: string | null;
  quickbooks_synced_at: string | null;
  quickbooks_error: string | null;
  quickbooks_balance: number | null;
  quickbooks_balance_at: string | null;
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

/** Shape returned by dealership_price_list(). Prices are null for everyone but the owner. */
export type PriceListRow = {
  service_id: string;
  name: string;
  description: string | null;
  category: ServiceCategory;
  price: number | null;
  price_min: number | null;
  price_max: number | null;
  is_override: boolean;
  sort_order: number;
  /** "Other": no list price, any amount; the owner sets it. */
  open_amount: boolean;
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
  /** Always null since 0035: no employee names on jobs. */
  detailer_name: string | null;
  services: string | null;
  /** Set when the earlier job is already on a live invoice. */
  invoice_number: string | null;
}

/** One row of find_invoice_conflicts(). */
export type InvoiceConflictRow = {
  job_id: string;
  other_job_id: string;
  kind: "invoiced" | "in_batch";
  other_tag: string;
  other_vin: string | null;
  other_performed_at: string;
  other_invoice_number: string | null;
  other_services: string | null;
  shared_services: string | null;
  match_on: "vin" | "tag";
};

/** Shape returned by dashboard_stats(). */
/** A detailer's own numbers (my_dashboard): their cars only, no money. */
export type DetailerStats = {
  today: { cars: number; by_service: { service_id: string; name: string; cars: number }[] };
  week: { cars: number };
  month: { cars: number };
  week_by_day: { day: string; cars: number }[];
  /** The last 30 days, days with cars only. */
  by_day: { day: string; cars: number }[];
  today_cars: { id: string; invoice_id: string | null; display_number: string | null; tag: string; vehicle: string | null; dealership: string | null; performed_at: string; services: string[] }[];
  range: { start: string; end: string };
};

export type DashboardStats = {
  range: { start: string; end: string };
  week: { jobs: number; revenue: number };
  month: { jobs: number; revenue: number };
  /** Totals for the selected range. */
  income: { jobs: number; revenue: number; collected: number; payments: number; avg_per_car: number };
  /** Logged today, split by service in menu order. A normal day is about 3 Used, 2 PDI, 4 Sold. */
  today: { jobs: number; revenue: number; by_service: { service_id: string; name: string; jobs: number; revenue: number }[] };
  /** Each day of the current week (Mon–Sun) that has cars. */
  week_by_day: { day: string; jobs: number; revenue: number }[];
  collected_by_day: { day: string; payments: number; amount: number }[];
  uninvoiced_total: number;
  uninvoiced_jobs: number;
  /** Every open invoice (draft + submitted + partial): what is still owed. */
  unpaid_total: number;
  unpaid_invoices: number;
  outstanding_total: number;
  outstanding_invoices: number;
  draft_total: number;
  draft_invoices: number;
  avg_days_to_pay: number | null;
  paid_last_90: number;
  by_service: { service_id: string; name: string; jobs: number; revenue: number }[];
  by_detailer: { detailer_id: string; name: string; jobs: number; revenue: number }[];
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

/** One row of the Invoices list (invoices_filtered): the invoice plus the cars and services on it. */
export type InvoiceListRow = {
  id: string;
  display_number: string;
  status: InvoiceStatus;
  overdue: boolean;
  /** Voided by "Delete invoice": lives in the archive and can be restored. */
  deleted: boolean;
  total: number;
  amount_paid: number;
  balance: number;
  period_start: string;
  period_end: string;
  ro_po_number: string | null;
  submitted_at: string | null;
  paid_at: string | null;
  created_at: string;
  dealership_id: string;
  dealership: string;
  car_count: number;
  cars: { tag: string; vin: string | null; vehicle: string | null; /** Always null since 0035. */ detailer: string | null }[];
  services: string[];
  /** In QuickBooks (0031). Older rows may lack the keys. */
  quickbooks_invoice_id?: string | null;
  quickbooks_doc_number?: string | null;
  quickbooks_error?: string | null;
};

export type InvoiceListResult = { count: number; total: number; balance: number; rows: InvoiceListRow[] };

/** One row of the Jobs list (jobs_filtered). No money. */
export type JobListRow = {
  id: string;
  performed_at: string;
  /** The company-timezone day (yyyy-mm-dd). */
  day: string;
  tag: string;
  vin: string | null;
  vehicle: string | null;
  color: string | null;
  dealership_id: string;
  dealership: string;
  detailer_id: string;
  /** Always null since 0035: no employee names on jobs (filter by detailer_id). */
  detailer: string | null;
  services: string[];
  invoice_id: string | null;
  display_number: string | null;
  invoice_status: InvoiceStatus | null;
  /** The QuickBooks invoice number the job sits on (live), if the company is connected. */
  quickbooks_doc_number?: string | null;
  /** The shop's own walk-in job (paid at the counter) and when it was paid. */
  retail?: boolean;
  paid_at?: string | null;
  photo_count: number;
  deleted: boolean;
};

export type JobListResult = { count: number; rows: JobListRow[] };

/** The whole company's day for admins and managers (team_dashboard): counts only, no money. */
export type TeamStats = {
  today: { cars: number; by_service: { service_id: string; name: string; cars: number }[] };
  week: { cars: number };
  month: { cars: number };
  /** Jobs not yet on an invoice. */
  open_jobs: number;
  week_by_day: { day: string; cars: number }[];
  by_day: { day: string; cars: number }[];
  by_detailer: { detailer_id: string; name: string; today: number; cars: number }[];
  today_cars: { id: string; invoice_id: string | null; display_number: string | null; tag: string; vehicle: string | null; dealership: string | null; /** Always null since 0035. */ detailer: string | null; performed_at: string; services: string[] }[];
  range: { start: string; end: string };
};

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
  services: { service_id: string; price?: number; override_reason?: string | null; label?: string | null }[];
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
      quickbooks_connections: Table<QuickBooksConnection>;
      quickbooks_month_invoices: Table<QuickBooksMonthInvoice>;
      audit_log: Table<AuditLog>;
    };
    Views: {
      service_prices_v: { Row: ServicePriceRow; Relationships: [] };
      job_service_prices_v: { Row: JobServicePriceRow; Relationships: [] };
    };
    Functions: {
      current_company_id: { Args: Record<string, never>; Returns: string | null };
      current_user_role: { Args: Record<string, never>; Returns: UserRole | null };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_owner: { Args: Record<string, never>; Returns: boolean };
      job_invoice_number: { Args: { p_job_id: string }; Returns: string | null };
      retail_charge: { Args: { p_job_id: string }; Returns: { job_id: string; tag: string; vehicle: string | null; amount: number; amount_cents: number } };
      record_retail_payment: { Args: { p_job_id: string; p_amount: number; p_method: string; p_reference?: string | null }; Returns: Job };
      jobs_needing_price: { Args: Record<string, never>; Returns: number };
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
        Args: { p_dealership_id: string; p_start: string; p_end: string; p_notes?: string | null; p_exclude?: string[] };
        Returns: string;
      };
      generate_per_job_invoices: { Args: { p_dealership_id: string; p_notes?: string | null; p_exclude?: string[] }; Returns: string[] };
      find_invoice_conflicts: { Args: { p_job_ids: string[]; p_days?: number }; Returns: InvoiceConflictRow[] };
      review_job_duplicate: { Args: { p_id: string; p_note?: string | null }; Returns: undefined };
      void_invoice: { Args: { p_id: string; p_reason?: string | null }; Returns: undefined };
      edit_invoice_car: { Args: { p_invoice_id: string; p: Partial<JobPayload> }; Returns: Invoice };
      delete_invoice_car: { Args: { p_invoice_id: string; p_reason?: string | null }; Returns: undefined };
      restore_invoice_car: { Args: { p_invoice_id: string }; Returns: Invoice };
      invoices_filtered: {
        Args: {
          p_q?: string | null;
          p_service?: string | null;
          p_dealership?: string | null;
          p_detailer?: string | null;
          p_from?: string | null;
          p_to?: string | null;
          p_status?: string;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: InvoiceListResult;
      };
      record_payment_system: {
        Args: { p_company_id: string; p_invoice_id: string; p_amount: number; p_paid_at?: string; p_method?: PaymentMethod; p_reference?: string | null; p_note?: string | null };
        Returns: string;
      };
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
      my_dashboard: { Args: Record<string, never>; Returns: DetailerStats };
      team_dashboard: { Args: Record<string, never>; Returns: TeamStats };
      jobs_filtered: {
        Args: {
          p_q?: string | null;
          p_service?: string | null;
          p_dealership?: string | null;
          p_detailer?: string | null;
          p_from?: string | null;
          p_to?: string | null;
          p_status?: string;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: JobListResult;
      };
      close_month: { Args: { p_company: string; p_through?: string | null }; Returns: string[] };
      invoice_now: { Args: { p_dealership_id: string }; Returns: string };
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
