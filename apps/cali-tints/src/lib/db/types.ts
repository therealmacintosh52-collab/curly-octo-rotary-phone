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
export type PaymentSource = "manual" | "clover_pos" | "clover_checkout" | "clover_card";
export type CloverEnv = "sandbox" | "production";
export type CloverPaymentStatus = "unmatched" | "matched" | "ignored";
export type CloverMatchedBy = "order" | "reference" | "amount" | "manual" | "checkout" | "card" | "device";

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
  clover_enabled: boolean;
  clover_env: CloverEnv;
  clover_merchant_id: string | null;
  clover_push_orders: boolean;
  clover_hosted_checkout: boolean;
  clover_last_sync_at: string | null;
  clover_verified_at: string | null;
  clover_connected_at: string | null;
  clover_merchant_name: string | null;
  clover_device_id: string | null;
  clover_pos_id: string;
  /** Every car logged becomes its own invoice on save (0015). */
  auto_invoice: boolean;
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
  clover_order_id: string | null;
  clover_pushed_at: string | null;
  clover_checkout_session_id: string | null;
  clover_checkout_url: string | null;
  clover_checkout_expires_at: string | null;
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
  source: PaymentSource;
  clover_payment_id: string | null;
  clover_charge_id: string | null;
  created_at: string;
}

export type TerminalKind = "sale" | "refund";
export type TerminalStatus = "captured" | "partially_refunded" | "refunded";

/** One row of the Terminal ledger (a sale or a refund). */
export type TerminalSale = {
  id: string;
  company_id: string;
  kind: TerminalKind;
  status: TerminalStatus;
  amount: number;
  refunded_amount: number;
  method: PaymentMethod;
  source: PaymentSource;
  invoice_id: string | null;
  payment_id: string | null;
  refund_of: string | null;
  /** Rows of one combined payment across several invoices share a group id. */
  group_id: string | null;
  description: string | null;
  customer_name: string | null;
  customer_email: string | null;
  reference: string | null;
  card_brand: string | null;
  last4: string | null;
  clover_payment_id: string | null;
  clover_charge_id: string | null;
  clover_refund_id: string | null;
  receipt_sent_at: string | null;
  created_by: string | null;
  created_at: string;
}

/** A row of terminal_transactions(): ledger rows plus invoice payments recorded elsewhere. */
export type TerminalTransaction = {
  id: string;
  kind: TerminalKind;
  status: TerminalStatus;
  amount: number;
  refunded_amount: number;
  method: PaymentMethod;
  source: PaymentSource;
  invoice_id: string | null;
  invoice_number: string | null;
  dealership: string | null;
  payment_id: string | null;
  refund_of: string | null;
  group_id: string | null;
  description: string | null;
  customer_name: string | null;
  customer_email: string | null;
  reference: string | null;
  card_brand: string | null;
  last4: string | null;
  clover_payment_id: string | null;
  receipt_sent_at: string | null;
  at: string;
}

/** Server-only row (service role): OAuth tokens are encrypted before they get here. */
export type CloverConnection = {
  company_id: string;
  env: CloverEnv;
  merchant_id: string;
  merchant_name: string | null;
  access_token_enc: string;
  refresh_token_enc: string | null;
  access_expires_at: string | null;
  refresh_expires_at: string | null;
  pakms_key: string | null;
  status: "ok" | "needs_reconnect";
  last_ok_at: string | null;
  last_error: string | null;
  connected_by: string | null;
  connected_at: string;
  updated_at: string;
}

export type CloverPaymentRow = {
  id: string;
  company_id: string;
  clover_payment_id: string;
  clover_order_id: string | null;
  source: Exclude<PaymentSource, "manual">;
  amount: number;
  tip: number;
  paid_at: string;
  card_brand: string | null;
  last4: string | null;
  reference: string | null;
  raw: Json | null;
  invoice_id: string | null;
  status: CloverPaymentStatus;
  matched_by: CloverMatchedBy | null;
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
  category: ServiceCategory;
  price: number;
  price_min: number | null;
  price_max: number | null;
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
export type DashboardStats = {
  range: { start: string; end: string };
  week: { jobs: number; revenue: number };
  month: { jobs: number; revenue: number };
  /** Totals for the selected range. */
  income: { jobs: number; revenue: number; collected: number; payments: number; avg_per_car: number };
  /** Logged today, split by service in menu order. A normal day is about 3 Used, 2 PDI, 4 Sold. */
  today: { jobs: number; revenue: number; by_service: { service_id: string; name: string; jobs: number; revenue: number }[] };
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
  cars: { tag: string; vin: string | null; vehicle: string | null; detailer: string | null }[];
  services: string[];
};

export type InvoiceListResult = { count: number; total: number; balance: number; rows: InvoiceListRow[] };

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
      clover_payments: Table<CloverPaymentRow>;
      terminal_sales: Table<TerminalSale>;
      clover_connections: Table<CloverConnection>;
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
        Args: { p_dealership_id: string; p_start: string; p_end: string; p_notes?: string | null; p_exclude?: string[] };
        Returns: string;
      };
      generate_per_job_invoices: { Args: { p_dealership_id: string; p_notes?: string | null; p_exclude?: string[] }; Returns: string[] };
      find_invoice_conflicts: { Args: { p_job_ids: string[]; p_days?: number }; Returns: InvoiceConflictRow[] };
      review_job_duplicate: { Args: { p_id: string; p_note?: string | null }; Returns: undefined };
      void_invoice: { Args: { p_id: string; p_reason?: string | null }; Returns: undefined };
      apply_clover_payment: { Args: { p_company_id: string; p_clover_payment_id: string; p_invoice_id: string; p_matched_by?: CloverMatchedBy }; Returns: string };
      ignore_clover_payment: { Args: { p_company_id: string; p_clover_payment_id: string; p_ignore?: boolean }; Returns: undefined };
      clover_unmatched_count: { Args: Record<string, never>; Returns: number };
      invoice_job: { Args: { p_job_id: string; p_notes?: string | null }; Returns: string };
      edit_invoice_car: { Args: { p_invoice_id: string; p: Partial<JobPayload> }; Returns: Invoice };
      delete_invoice_car: { Args: { p_invoice_id: string; p_reason?: string | null }; Returns: undefined };
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
      record_batch_payment: {
        Args: { p_invoice_ids: string[]; p_amount: number; p_method: PaymentMethod; p_reference?: string | null; p_note?: string | null; p_source?: PaymentSource };
        Returns: { invoice_id: string; payment_id: string; amount: number }[];
      };
      refund_terminal_sale: { Args: { p_sale_id: string | null; p_payment_id: string | null; p_amount: number; p_clover_refund_id?: string | null }; Returns: string };
      terminal_transactions: { Args: { p_start?: string | null; p_end?: string | null }; Returns: TerminalTransaction[] };
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
      jobs_filter_summary: {
        Args: {
          p_q?: string | null;
          p_service?: string | null;
          p_detailer?: string | null;
          p_dealership?: string | null;
          p_from?: string | null;
          p_to?: string | null;
          p_status?: string;
        };
        Returns: { jobs: number; revenue: number };
      };
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
