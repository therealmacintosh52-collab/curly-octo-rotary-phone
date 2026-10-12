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

export type ServiceCategory = "new" | "used" | "service" | "addon" | "retail";

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
  /** Retail catalog (0038): how long it takes, what it needs, which menus it is on. */
  duration_minutes?: number;
  benefit_text?: string | null;
  retail?: boolean;
  dealer?: boolean;
  taxable?: boolean;
  /** Seeded price not yet confirmed by the owner. */
  placeholder?: boolean;
  required_resource_kinds?: ResourceKind[];
  required_skill?: string | null;
  start_window_from?: string | null;
  start_window_to?: string | null;
}

export type ResourceKind = "bay" | "lift" | "tech";

/** The retail price of a service for one size class (0038). Owner only. */
export type ServicePriceBySize = { id: string; company_id: string; service_id: string; size_class: VehicleSize; price: number; created_at: string; updated_at: string };

export type PriceModifier = { id: string; company_id: string; code: string; label: string; description: string | null; kind: "percent" | "flat"; amount: number; active: boolean; sort_order: number; ask_customer: boolean; question: string | null; created_at: string; updated_at: string };

export type RetailSettings = {
  id: string;
  company_id: string;
  deposit_kind: "percent" | "flat" | "none";
  deposit_value: number;
  deposit_refundable: boolean;
  hold_minutes: number;
  cancel_hours: number;
  slot_step_minutes: 15 | 30 | 60;
  lead_time_hours: number;
  max_days_ahead: number;
  reminder_hours: number[];
  online_booking_enabled: boolean;
  estimate_valid_days: number;
  tax_all_lines: boolean;
  signature_required_estimate: boolean;
  signature_required_receipt: boolean;
  policy_text: string | null;
  email_templates: Record<string, { subject?: string; body?: string }>;
  updated_at: string;
};

export type Resource = { id: string; company_id: string; kind: ResourceKind; name: string; profile_id: string | null; skills: string[]; active: boolean; sort_order: number; created_at: string; updated_at: string };
export type BusinessHour = { id: string; company_id: string; dow: number; opens: string; closes: string; closed: boolean };
export type BlackoutDay = { id: string; company_id: string; day: string; reason: string | null; created_at: string };
export type TimeOff = { id: string; company_id: string; resource_id: string; starts_at: string; ends_at: string; reason: string | null; created_at: string };

/** retail_catalog(): the shop menu with size prices (owner/admin), modifiers, settings, resources, hours. */
export type RetailCatalogService = {
  id: string;
  name: string;
  description: string | null;
  benefit_text: string | null;
  category: ServiceCategory;
  duration_minutes: number;
  retail: boolean;
  dealer: boolean;
  taxable: boolean;
  placeholder: boolean;
  required_resource_kinds: ResourceKind[];
  required_skill: string | null;
  start_window_from: string | null;
  start_window_to: string | null;
  active: boolean;
  sort_order: number;
  open_amount: boolean;
  /** Null unless owner/admin. */
  prices: Partial<Record<VehicleSize, number>> | null;
  default_price: number | null;
};
export type RetailCatalog = {
  services: RetailCatalogService[];
  modifiers: PriceModifier[];
  settings: RetailSettings | null;
  resources: Resource[];
  hours: BusinessHour[];
  blackouts: BlackoutDay[];
  time_off: TimeOff[];
  tax_rate: number;
};

// ---------------------------------------------------------------------------
// Estimates (0039)
// ---------------------------------------------------------------------------
export type EstimateStatus = "draft" | "sent" | "viewed" | "accepted" | "declined" | "expired";
export type EstimateTier = "good" | "better" | "best" | "single";

export type EstimateLineView = {
  id: string;
  service_id: string | null;
  name: string;
  benefit_text: string | null;
  qty: number;
  taxable: boolean;
  duration_minutes: number;
  /** Null unless owner/admin (or the customer's own public view). */
  unit_price: number | null;
  line_total: number | null;
  modifiers: { code: string; label: string; kind?: "percent" | "flat"; amount?: number }[];
};
export type EstimateAddonView = EstimateLineView & { default_on: boolean; customer_approved: boolean | null };
export type EstimateOptionView = {
  id: string;
  tier: EstimateTier;
  name: string;
  description: string | null;
  recommended: boolean;
  sort_order: number;
  duration_minutes: number;
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  lines: EstimateLineView[];
};
export type EstimateAuthorizationView = {
  id: string;
  authorized_at: string;
  name: string;
  method: "online" | "in_person" | "phone" | "email";
  by_staff: string | null;
  selected_option_id: string | null;
  approved_line_ids: string[];
  signature_path: string | null;
  pay_choice: "deposit" | "at_shop" | null;
  total: number | null;
};

/** The estimates table row as the admin client reads it (public pages validate tokens through it; staff use the RPCs). */
export type EstimateRow = {
  id: string;
  company_id: string;
  display_number: string;
  customer_id: string;
  vehicle_id: string | null;
  size_class: VehicleSize;
  status: EstimateStatus;
  token: string;
  expires_at: string | null;
  job_id: string | null;
  created_at: string;
  updated_at: string;
};

/** estimate_detail() / estimate_by_token(): one estimate, read top to bottom. */
export type EstimateView = {
  id: string;
  display_number: string;
  status: EstimateStatus;
  size_class: VehicleSize;
  expires_at: string | null;
  po_number: string | null;
  internal_notes: string | null;
  customer_notes: string | null;
  selected_option_id: string | null;
  sent_at: string | null;
  first_viewed_at: string | null;
  last_viewed_at: string | null;
  view_count: number;
  accepted_at: string | null;
  declined_at: string | null;
  decline_reason: string | null;
  job_id: string | null;
  created_at: string;
  updated_at: string;
  /** Only on the public view. */
  token: string | null;
  subtotal: number | null;
  tax_rate: number | null;
  tax: number | null;
  total: number | null;
  deposit_required: number | null;
  customer: { id: string; display_name: string | null; first_name: string; phone: string | null; email: string | null };
  vehicle: { id: string; name: string | null; color: string | null; plate: string | null; size_class: VehicleSize } | null;
  options: EstimateOptionView[];
  addons: EstimateAddonView[];
  authorizations: EstimateAuthorizationView[];
  company: { name: string; phone: string | null; email: string | null; address_line1: string | null; address_line2: string | null; city: string | null; state: string | null; postal_code: string | null; logo_path: string | null; timezone: string };
  policy: { policy_text: string | null; deposit_kind: "percent" | "flat" | "none"; deposit_value: number; deposit_refundable: boolean; signature_required: boolean; cancel_hours: number } | null;
  public_money: boolean;
};

export type EstimateListRow = {
  id: string;
  display_number: string;
  status: EstimateStatus;
  created_at: string;
  expires_at: string | null;
  sent_at: string | null;
  last_viewed_at: string | null;
  accepted_at: string | null;
  job_id: string | null;
  customer_id: string;
  customer: string | null;
  vehicle: string | null;
  size_class: VehicleSize;
  options: number;
  total: number | null;
};
export type EstimateListResult = { count: number; rows: EstimateListRow[] };

/** What the builder sends to create_estimate / update_estimate. */
export type EstimateLineInput = { service_id: string; qty?: number; label?: string | null; price?: number | null; modifiers?: string[] };
export type EstimatePayload = {
  customer_id?: string;
  vehicle_id?: string | null;
  size_class?: VehicleSize;
  expires_at?: string | null;
  po_number?: string | null;
  internal_notes?: string | null;
  customer_notes?: string | null;
  options?: { tier: EstimateTier; name: string; description?: string | null; recommended?: boolean; lines: EstimateLineInput[] }[];
  addons?: (EstimateLineInput & { default_on?: boolean })[];
};

// ---------------------------------------------------------------------------
// Booking (0040)
// ---------------------------------------------------------------------------
export type AppointmentStatus = "hold" | "lead" | "booked" | "confirmed" | "in_progress" | "done" | "cancelled" | "no_show";
export type AppointmentSource = "public" | "staff" | "estimate";
export type Slot = { starts_at: string; ends_at: string };
export type BookingLineInput = { service_id: string; qty?: number; label?: string | null; price?: number | null; modifiers?: string[] };

/** The appointments table row as the admin client reads it. */
export type AppointmentRow = {
  id: string;
  company_id: string;
  display_number: string;
  customer_id: string | null;
  vehicle_id: string | null;
  estimate_id: string | null;
  job_id: string | null;
  status: AppointmentStatus;
  starts_at: string;
  ends_at: string;
  hold_expires_at: string | null;
  token: string;
  source: AppointmentSource;
  reminders_sent: string[];
  created_at: string;
  updated_at: string;
};

export type AppointmentServiceView = {
  id: string;
  service_id: string | null;
  name: string;
  qty: number;
  duration_minutes: number;
  unit_price: number | null;
  line_total: number | null;
  modifiers: { code: string; label: string }[];
};

/** appointment_detail() / appointment_by_token() / book_appointment(): one appointment. */
export type AppointmentView = {
  id: string;
  display_number: string;
  status: AppointmentStatus;
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
  hold_expires_at: string | null;
  source: AppointmentSource;
  size_class: VehicleSize;
  pay_choice: "deposit" | "at_shop" | null;
  intake: Record<string, unknown>;
  notes: string | null;
  customer_notes: string | null;
  estimate_id: string | null;
  job_id: string | null;
  confirmed_at: string | null;
  checked_in_at: string | null;
  done_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
  token: string | null;
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  deposit_required: number | null;
  deposit_paid_at: string | null;
  deposit_paid: number | null;
  payments: PaymentView[];
  customer: { id: string; display_name: string | null; first_name: string; phone: string | null; email: string | null } | null;
  vehicle: { id: string; name: string | null; color: string | null; plate: string | null; size_class: VehicleSize } | null;
  services: AppointmentServiceView[];
  resources: { id: string; kind: ResourceKind; name: string }[];
  estimate: { id: string; display_number: string; status: EstimateStatus } | null;
  company: { name: string; phone: string | null; email: string | null; address_line1: string | null; city: string | null; state: string | null; postal_code: string | null; timezone: string };
  policy: { cancel_hours: number; hold_minutes: number; deposit_kind: "percent" | "flat" | "none"; deposit_value: number; deposit_refundable: boolean; policy_text: string | null } | null;
  can_change: boolean;
};

/** One row on the calendar / Today. */
export type CalendarItem = {
  id: string;
  display_number: string;
  status: AppointmentStatus;
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
  hold_expires_at: string | null;
  source: AppointmentSource;
  size_class: VehicleSize;
  pay_choice: "deposit" | "at_shop" | null;
  job_id: string | null;
  estimate_id: string | null;
  customer: string | null;
  customer_id: string | null;
  vehicle: string | null;
  services: string[];
  resource_ids: string[];
  total: number | null;
  deposit_required: number | null;
};
export type CalendarRange = {
  resources: { id: string; kind: ResourceKind; name: string; profile_id: string | null }[];
  hours: { dow: number; opens: string; closes: string; closed: boolean }[];
  blackouts: { day: string; reason: string | null }[];
  items: CalendarItem[];
};
export type RetailTodayAppointments = { leads: CalendarItem[]; holds: CalendarItem[]; today: CalendarItem[] };

/** public_catalog(): what the booking page may sell. */
export type PublicCatalog = {
  company: { name: string; phone: string | null; email: string | null; address_line1: string | null; city: string | null; state: string | null; postal_code: string | null; timezone: string };
  services: { id: string; name: string; benefit_text: string | null; duration_minutes: number; taxable: boolean; sort_order: number; start_window_from: string | null; start_window_to: string | null; prices: Partial<Record<VehicleSize, number>>; default_price: number }[];
  questions: { code: string; label: string; question: string; kind: "percent" | "flat"; amount: number }[];
  settings: { slot_step_minutes: number; lead_time_hours: number; max_days_ahead: number; hold_minutes: number; cancel_hours: number; deposit_kind: "percent" | "flat" | "none"; deposit_value: number; deposit_refundable: boolean; online_booking_enabled: boolean; policy_text: string | null } | null;
  hours: { dow: number; opens: string; closes: string; closed: boolean }[];
  tax_rate: number;
};
export type HoldResult = { token: string; display_number: string; starts_at: string; ends_at: string; hold_expires_at: string; total: number; deposit_required: number; has_customer: boolean };
export type ConfirmResult = { token: string; status: AppointmentStatus; display_number: string; starts_at: string; ends_at?: string; total?: number; deposit_required?: number; pay_choice?: "deposit" | "at_shop" };
export type HoldPayload = { size_class?: VehicleSize; lines?: BookingLineInput[]; starts_at: string; intake?: Record<string, unknown>; estimate_token?: string; customer_notes?: string };
export type ConfirmPayload = { contact?: { first_name: string; last_name?: string; phone: string; email?: string | null; sms_opt_in?: boolean; marketing_opt_in?: boolean }; vehicle?: { year?: number | null; make?: string | null; model?: string | null; color?: string | null; vin?: string | null }; pay_choice?: "deposit" | "at_shop"; customer_notes?: string };
export type BookPayload = { customer_id?: string; vehicle_id?: string | null; estimate_id?: string; lines?: BookingLineInput[]; starts_at: string; notes?: string | null; customer_notes?: string | null; size_class?: VehicleSize };

// ---------------------------------------------------------------------------
// Retail payments (0041)
// ---------------------------------------------------------------------------
export type PaymentKind = "deposit" | "balance" | "refund";
export type PaymentStatus = "pending" | "paid" | "refunded" | "failed" | "cancelled";
export type RetailPaymentMethod = "clover_online" | "clover_flex" | "cash" | "check" | "other";
export type PaymentRow = {
  id: string;
  company_id: string;
  customer_id: string | null;
  appointment_id: string | null;
  estimate_id: string | null;
  job_id: string | null;
  kind: PaymentKind;
  status: PaymentStatus;
  amount: number;
  method: RetailPaymentMethod;
  provider: "clover" | "none";
  checkout_session_id: string | null;
  provider_ref: string | null;
  paid_at: string | null;
  note: string | null;
  raw: Record<string, unknown> | null;
  refunds_payment_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
/** A payment as the appointment / receipt views carry it (amount null unless owner/admin). */
export type PaymentView = { id: string; kind: PaymentKind; status: PaymentStatus; method: RetailPaymentMethod; provider?: "clover" | "none"; paid_at: string | null; provider_ref?: string | null; note?: string | null; amount: number | null; created_at?: string };
export type DepositStart = { payment_id: string; amount: number; amount_cents: number; display_number: string; vehicle: string | null; customer: { first_name: string; last_name: string; email: string | null; phone: string | null } };
/** retail_charge(): what the counter collects on a retail job. */
export type RetailCharge = {
  job_id: string;
  tag: string;
  vehicle: string | null;
  subtotal: number;
  tax: number;
  total: number;
  deposit_paid: number;
  paid: number;
  balance: number;
  amount: number;
  amount_cents: number;
  paid_at: string | null;
  receipt_signed_at: string | null;
  receipt_signed_name: string | null;
  has_signature: boolean;
  signature_required: boolean;
  payments: PaymentView[];
};
/** job_receipt() / receipt_by_token(): the paid job's receipt. */
export type ReceiptView = {
  id: string;
  tag: string;
  performed_at: string;
  paid_at: string | null;
  payment_method: "clover" | "cash" | "check" | "other" | null;
  vehicle: string | null;
  color: string | null;
  customer: { id: string; display_name: string | null; first_name: string; email: string | null; phone: string | null } | null;
  lines: { name: string; price: number }[];
  subtotal: number;
  tax: number;
  total: number;
  deposit_paid: number;
  paid: number;
  balance: number;
  tax_rate: number;
  payments: { kind: PaymentKind; method: RetailPaymentMethod; amount: number; paid_at: string | null; provider_ref: string | null }[];
  signed_name: string | null;
  signed_at: string | null;
  has_signature: boolean;
  token: string | null;
  company: { name: string; phone: string | null; email: string | null; address_line1: string | null; address_line2: string | null; city: string | null; state: string | null; postal_code: string | null; logo_path: string | null; timezone: string };
};
export type RetailMoneySummary = { deposits_outstanding: { count: number; amount: number }; deposits_week: number; collected_week: number; pending_links: number };

/** quote_total(): a retail quote priced by size. */
export type QuoteResult = {
  size_class: VehicleSize;
  lines: { service_id: string; name: string; benefit_text: string | null; unit_price: number; qty: number; modifiers: { code: string; label: string; kind: "percent" | "flat"; amount: number }[]; line_total: number; taxable: boolean; duration_minutes: number; placeholder: boolean }[];
  subtotal: number;
  tax_rate: number;
  tax: number;
  total: number;
  duration_minutes: number;
  placeholder: boolean;
};

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
  /** Retail jobs: the walk-in customer and the car they brought (0037); null on dealership jobs. */
  customer_id?: string | null;
  vehicle_id?: string | null;
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
  /** Retail rows: the customer the car belongs to (0037). */
  customer_id?: string | null;
  customer?: string | null;
  vehicle_id?: string | null;
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
  /** Retail jobs only (the dealership row flagged retail): the customer, their vehicle and today's mileage. */
  customer_id?: string | null;
  vehicle_id?: string | null;
  odometer?: number | null;
  services: { service_id: string; price?: number; override_reason?: string | null; label?: string | null }[];
}

// ---------------------------------------------------------------------------
// Retail (0037+): everyday customers and their cars
// ---------------------------------------------------------------------------
export type VehicleSize = "compact" | "sedan" | "suv_truck" | "xl";
export type CustomerSource = "walk_in" | "online_booking" | "referral" | "phone" | "social" | "other";

export type Customer = {
  id: string;
  company_id: string;
  first_name: string;
  last_name: string;
  display_name: string | null;
  phone: string | null;
  phone_digits: string | null;
  email: string | null;
  email_lc: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  source: CustomerSource;
  tags: string[];
  marketing_opt_in: boolean;
  marketing_opt_in_at: string | null;
  sms_opt_in: boolean;
  sms_opt_in_at: string | null;
  consent_source: string | null;
  notes: string | null;
  archived_at: string | null;
  merged_into_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Vehicle = {
  id: string;
  company_id: string;
  customer_id: string;
  vin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  body_class: string | null;
  size_class: VehicleSize;
  size_class_source: "nhtsa" | "manual";
  color: string | null;
  plate: string | null;
  notes: string | null;
  archived_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type OdometerReading = {
  id: string;
  company_id: string;
  vehicle_id: string;
  reading: number;
  read_at: string;
  job_id: string | null;
  created_by: string | null;
  created_at: string;
};

/** Payload for save_customer(). `id` updates; otherwise creates. */
export type CustomerPayload = Partial<Pick<Customer, "first_name" | "last_name" | "phone" | "email" | "address_line1" | "address_line2" | "city" | "state" | "postal_code" | "source" | "tags" | "marketing_opt_in" | "sms_opt_in" | "consent_source" | "notes">> & { id?: string };

/** Payload for save_vehicle(). `id` updates; otherwise creates (customer_id required). */
export type VehiclePayload = Partial<Pick<Vehicle, "vin" | "year" | "make" | "model" | "trim" | "body_class" | "size_class" | "color" | "plate" | "notes">> & { id?: string; customer_id?: string; odometer?: number | null; archived?: boolean };

/** One row of customers_filtered(). Money (lifetime_spend) is null unless owner/admin. */
export type CustomerListRow = {
  id: string;
  display_name: string | null;
  phone: string | null;
  email: string | null;
  tags: string[];
  archived_at: string | null;
  vehicles: string[];
  visits: number;
  last_visit: string | null;
  lifetime_spend: number | null;
};
export type CustomerListResult = { count: number; rows: CustomerListRow[] };

/** customer_timeline(): the customer, their vehicles and every visit. */
export type CustomerTimeline = {
  customer: Customer;
  merged_into: { id: string; display_name: string | null } | null;
  vehicles: (Pick<Vehicle, "id" | "vin" | "year" | "make" | "model" | "trim" | "body_class" | "size_class" | "size_class_source" | "color" | "plate" | "notes" | "archived_at"> & {
    odometer: { reading: number; read_at: string } | null;
    visits: number;
    last_visit: string | null;
  })[];
  jobs: {
    id: string;
    performed_at: string;
    tag: string;
    vehicle: string | null;
    vehicle_id: string | null;
    services: string[];
    paid_at: string | null;
    payment_method: "clover" | "cash" | "check" | "other" | null;
    paid_amount: number | null;
    deleted_at: string | null;
  }[];
  estimates?: { id: string; display_number: string; status: EstimateStatus; created_at: string; expires_at: string | null; vehicle: string | null; total: number | null; job_id: string | null }[];
  appointments?: { id: string; display_number: string; status: AppointmentStatus; starts_at: string; ends_at: string; vehicle: string | null; services: string[]; job_id: string | null }[];
  payments?: { id: string; kind: PaymentKind; status: PaymentStatus; method: RetailPaymentMethod; paid_at: string | null; amount: number | null; appointment_id: string | null; job_id: string | null; estimate_id: string | null }[];
  stats: { visits: number; last_visit: string | null; lifetime_spend: number | null };
};

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
      customers: Table<Customer>;
      vehicles: Table<Vehicle>;
      odometer_readings: Table<OdometerReading>;
      service_prices_by_size: Table<ServicePriceBySize>;
      price_modifiers: Table<PriceModifier>;
      retail_settings: Table<RetailSettings>;
      resources: Table<Resource>;
      business_hours: Table<BusinessHour>;
      blackout_days: Table<BlackoutDay>;
      time_off: Table<TimeOff>;
      estimates: Table<EstimateRow>;
      appointments: Table<AppointmentRow>;
      payments: Table<PaymentRow>;
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
      retail_charge: { Args: { p_job_id: string }; Returns: RetailCharge };
      start_deposit_by_token: { Args: { p_kind: "appointment" | "estimate"; p_token: string }; Returns: DepositStart };
      start_deposit: { Args: { p_appointment: string }; Returns: DepositStart };
      record_payment_system_retail: { Args: { p: { payment_id?: string; checkout_session_id?: string; status?: "paid" | "failed"; provider_ref?: string | null; amount?: number; raw?: unknown; note?: string } }; Returns: { ok: boolean; payment_id?: string; status?: PaymentStatus; appointment_id?: string | null; already?: boolean; reason?: string } };
      attach_checkout_session: { Args: { p_payment: string; p_session_id: string; p_raw?: unknown }; Returns: undefined };
      record_deposit_at_shop: { Args: { p_appointment: string; p_method: RetailPaymentMethod; p_reference?: string | null; p_amount?: number | null }; Returns: AppointmentView };
      refund_payment: { Args: { p_id: string; p_amount: number; p_note?: string | null }; Returns: PaymentRow };
      expire_pending_payments: { Args: Record<string, never>; Returns: number };
      sign_receipt: { Args: { p_job_id: string; p_signature_path: string; p_name: string }; Returns: { job_id: string; signed_at: string } };
      job_receipt: { Args: { p_job_id: string }; Returns: ReceiptView };
      receipt_by_token: { Args: { p_token: string }; Returns: ReceiptView };
      receipt_link: { Args: { p_job_id: string }; Returns: string };
      receipt_signature_path: { Args: { p_job_id: string }; Returns: string | null };
      retail_money_summary: { Args: Record<string, never>; Returns: RetailMoneySummary };
      record_retail_payment: { Args: { p_job_id: string; p_amount: number; p_method: string; p_reference?: string | null }; Returns: Job };
      jobs_needing_price: { Args: Record<string, never>; Returns: number };
      save_customer: { Args: { p: CustomerPayload }; Returns: Customer };
      find_duplicate_customers: { Args: { p_phone?: string | null; p_email?: string | null; p_exclude?: string | null }; Returns: Customer[] };
      archive_customer: { Args: { p_id: string; p_on?: boolean }; Returns: undefined };
      merge_customers: { Args: { p_keep: string; p_merge: string }; Returns: Customer };
      customers_filtered: { Args: { p_q?: string | null; p_archived?: boolean; p_limit?: number; p_offset?: number }; Returns: CustomerListResult };
      customer_timeline: { Args: { p_id: string }; Returns: CustomerTimeline };
      save_vehicle: { Args: { p: VehiclePayload }; Returns: Vehicle };
      retail_catalog: { Args: Record<string, never>; Returns: RetailCatalog };
      create_estimate: { Args: { p: EstimatePayload }; Returns: { id: string; display_number: string; status: EstimateStatus; token: string; total: number; deposit_required: number } };
      update_estimate: { Args: { p_id: string; p: EstimatePayload }; Returns: { id: string; display_number: string; status: EstimateStatus; total: number } };
      send_estimate: { Args: { p_id: string }; Returns: { token: string; expires_at: string; display_number: string } };
      estimate_link: { Args: { p_id: string }; Returns: string };
      mark_estimate_accepted: { Args: { p_id: string; p_option: string; p_line_ids?: string[]; p_name?: string | null; p_method?: string }; Returns: { id: string; status: EstimateStatus } };
      decline_estimate: { Args: { p_id: string; p_reason?: string | null }; Returns: { id: string; status: EstimateStatus } };
      convert_estimate_to_job: { Args: { p_id: string; p?: { dealership_id?: string; tag_number?: string; performed_at?: string; detailer_id?: string; notes?: string } }; Returns: Job };
      estimate_detail: { Args: { p_id: string }; Returns: EstimateView };
      estimates_filtered: { Args: { p_q?: string | null; p_status?: string; p_customer?: string | null; p_limit?: number; p_offset?: number }; Returns: EstimateListResult };
      estimate_by_token: { Args: { p_token: string }; Returns: EstimateView };
      estimate_mark_viewed: { Args: { p_token: string }; Returns: undefined };
      estimate_respond: { Args: { p_token: string; p: { decision?: "accept" | "decline"; option_id?: string; approved_line_ids?: string[]; name?: string; signature_path?: string | null; pay_choice?: "deposit" | "at_shop"; ip?: string; user_agent?: string; reason?: string } }; Returns: { status: "accepted" | "declined"; total?: number; deposit_required?: number; display_number?: string } };
      expire_estimates: { Args: Record<string, never>; Returns: number };
      public_catalog: { Args: Record<string, never>; Returns: PublicCatalog };
      public_quote: { Args: { p_size: VehicleSize; p_lines: BookingLineInput[] }; Returns: QuoteResult };
      find_slots: { Args: { p_lines: BookingLineInput[]; p_from: string; p_to: string }; Returns: Slot[] };
      create_hold: { Args: { p: HoldPayload }; Returns: HoldResult };
      confirm_hold: { Args: { p_token: string; p: ConfirmPayload }; Returns: ConfirmResult };
      appointment_by_token: { Args: { p_token: string }; Returns: AppointmentView };
      cancel_by_token: { Args: { p_token: string; p_reason?: string | null }; Returns: AppointmentView };
      reschedule_by_token: { Args: { p_token: string; p_starts_at: string }; Returns: AppointmentView };
      book_appointment: { Args: { p: BookPayload }; Returns: AppointmentView };
      set_appointment_status: { Args: { p_id: string; p_status: AppointmentStatus; p_reason?: string | null }; Returns: AppointmentView };
      reschedule_appointment: { Args: { p_id: string; p_starts_at: string }; Returns: AppointmentView };
      appointment_detail: { Args: { p_id: string }; Returns: AppointmentView };
      appointment_link: { Args: { p_id: string }; Returns: string };
      calendar_range: { Args: { p_from: string; p_to: string }; Returns: CalendarRange };
      retail_today_appointments: { Args: Record<string, never>; Returns: RetailTodayAppointments };
      release_expired_holds: { Args: Record<string, never>; Returns: number };
      quote_total: { Args: { p_size: VehicleSize; p_lines: { service_id: string; qty?: number; label?: string | null; price?: number | null; modifiers?: string[] }[] }; Returns: QuoteResult };
      add_odometer: { Args: { p_vehicle: string; p_reading: number; p_read_at?: string | null; p_job?: string | null }; Returns: OdometerReading };
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
      vehicle_size: VehicleSize;
    };
    CompositeTypes: Record<string, never>;
  };
}
