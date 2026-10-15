// Row types mirror supabase/migrations/0001_init.sql (snake_case, one type per table). Optional fields are
// nullable or defaulted in SQL, so inserts only need the required ones.
type Base = { id: string; created_at: string; updated_at: string };
type J<T = unknown> = T;
export type SizeClassId = 'compact' | 'sedan' | 'suv' | 'truck' | 'xl';
export type LeadSource = 'google' | 'gbp' | 'meta_ads' | 'instagram' | 'tiktok' | 'door_knock' | 'referral' | 'dealer' | 'organic' | 'direct' | 'other';
export type LeadStage = 'new' | 'quoted' | 'booked' | 'in_progress' | 'done' | 'reviewed' | 'lost';

export type Profile = Base & { role: 'owner' | 'admin' | 'tech' | 'dealer' | 'customer'; full_name?: string | null; phone?: string | null; tech_id?: string | null };
export type Tech = Base & { name: string; profile_id?: string | null; phone?: string | null; email?: string | null; color?: string | null; home_zip?: string | null; calendar_id?: string | null; active: boolean };
export type TechAvailability = Base & { tech_id: string; weekday: number; start_time: string; end_time: string };
export type BlackoutDate = Base & { date: string; tech_id?: string | null; reason?: string | null };
export type AdminBlock = Base & { tech_id?: string | null; starts_at: string; ends_at: string; reason?: string | null };
export type WeatherFlag = Base & { date: string; reason?: string | null };
export type Service = Omit<Base, 'id'> & { id: string; plain_name: string; term: string; requires_photos: boolean; exterior: boolean; active: boolean; sort: number };
export type Dealer = Base & { name: string; contact_name?: string | null; email?: string | null; phone?: string | null; address_zip?: string | null; net_terms_days: number; wholesale_pricing: J<Record<string, unknown>>; stripe_customer_id?: string | null; status: 'pending' | 'active' | 'paused' };
export type DealerUser = Base & { dealer_id: string; profile_id: string; role: 'admin' | 'member' };
export type Customer = Base & { name: string; email?: string | null; phone?: string | null; sms_opt_in: boolean; sms_opt_in_at?: string | null; sms_opt_in_text?: string | null; sms_opt_out_at?: string | null; dealer_id?: string | null; referral_code_used?: string | null };
export type Vehicle = Base & { customer_id?: string | null; dealer_id?: string | null; year?: number | null; make?: string | null; model?: string | null; size_class?: SizeClassId | null; color?: string | null; vin?: string | null };
export type Lead = Base & {
  customer_id?: string | null; name?: string | null; phone?: string | null; email?: string | null; zip?: string | null;
  stage: LeadStage; source: LeadSource;
  utm_source?: string | null; utm_medium?: string | null; utm_campaign?: string | null; utm_term?: string | null; utm_content?: string | null;
  gclid?: string | null; fbclid?: string | null; referrer?: string | null; landing_page?: string | null; first_touch?: J | null;
  notes?: string | null; area_status?: string | null;
};
export type QuoteRow = Base & {
  lead_id?: string | null; customer_id?: string | null; vehicle_id?: string | null; services: string[]; size_class?: string | null;
  low?: number | null; high?: number | null; confidence?: number | null; panels: J<unknown[]>; notes?: string | null;
  photo_paths: string[]; model?: string | null; mock: boolean; label: string;
};
export type BookingRow = Base & {
  customer_id?: string | null; vehicle_id?: string | null; lead_id?: string | null; quote_id?: string | null; tech_id?: string | null;
  status: 'pending_deposit' | 'confirmed' | 'on_the_way' | 'in_progress' | 'completed' | 'cancelled' | 'no_show' | 'expired';
  services: string[]; addons: string[]; size_class?: string | null;
  starts_at: string; ends_at: string; duration_min: number; hold_expires_at?: string | null;
  zip?: string | null; address_line?: string | null; city?: string | null; area_status?: string | null;
  travel_fee: number; price_low?: number | null; price_high?: number | null; needs_review: boolean;
  deposit_amount: number; deposit_status: 'none' | 'pending' | 'paid' | 'refunded' | 'forfeited' | 'credited';
  payment_intent_id?: string | null; idempotency_key?: string | null; reschedule_count: number;
  cancelled_at?: string | null; cancel_reason?: string | null; customer_notes?: string | null; gcal_event_id?: string | null;
};
export type Job = Base & {
  booking_id?: string | null; customer_id?: string | null; vehicle_id?: string | null; tech_id?: string | null; dealer_id?: string | null;
  stage: 'new' | 'quoted' | 'booked' | 'in_progress' | 'done' | 'reviewed'; started_at?: string | null; finished_at?: string | null;
  final_price?: number | null; review_requested_at?: string | null; reviewed_at?: string | null; signature_path?: string | null; summary?: string | null;
};
export type JobPhoto = Base & { job_id?: string | null; booking_id?: string | null; quote_id?: string | null; kind: 'quote' | 'before' | 'after' | 'other'; storage_path: string; marketing_consent: boolean; consent_at?: string | null; caption?: string | null };
export type Invoice = Base & {
  number?: string | null; job_id?: string | null; booking_id?: string | null; customer_id?: string | null; dealer_id?: string | null;
  status: 'draft' | 'sent' | 'paid' | 'void' | 'overdue'; line_items: J<unknown[]>; subtotal: number; deposit_applied: number; total: number;
  stripe_invoice_id?: string | null; due_at?: string | null; paid_at?: string | null;
};
export type Payment = Base & {
  booking_id?: string | null; invoice_id?: string | null; customer_id?: string | null; kind: 'deposit' | 'balance' | 'refund' | 'membership' | 'dealer';
  amount: number; status: 'pending' | 'succeeded' | 'failed' | 'refunded'; method?: string | null; stripe_payment_intent_id?: string | null; mock: boolean;
};
export type Note = Base & { entity_type: 'customer' | 'vehicle' | 'lead' | 'booking' | 'job' | 'dealer'; entity_id: string; author_id?: string | null; body: string };
export type Membership = Base & { customer_id: string; tier: 'maintain' | 'protect' | 'showroom'; status: 'active' | 'past_due' | 'paused' | 'cancelled'; stripe_subscription_id?: string | null; started_at: string; renews_at?: string | null; cancelled_at?: string | null };
export type ReferralCode = Base & { code: string; customer_id?: string | null; credit_amount: number; active: boolean };
export type ReferralCredit = Base & { referral_code_id: string; referred_customer_id?: string | null; amount: number; status: 'pending' | 'available' | 'redeemed' | 'void'; redeemed_booking_id?: string | null };
export type Conversation = Base & { channel: 'web' | 'sms' | 'instagram' | 'facebook' | 'voice'; external_id?: string | null; customer_id?: string | null; lead_id?: string | null; status: 'open' | 'escalated' | 'closed'; cost_usd: number; summary?: string | null };
export type Message = Base & { conversation_id: string; role: 'user' | 'assistant' | 'tool' | 'system'; content: string; meta: J<Record<string, unknown>> };
export type DealerVehicle = Base & { dealer_id: string; vin?: string | null; stock_number?: string | null; year?: number | null; make?: string | null; model?: string | null; size_class?: SizeClassId | null; photo_paths: string[]; notes?: string | null; status: 'submitted' | 'quoted' | 'approved' | 'in_progress' | 'done' | 'invoiced'; job_id?: string | null; addon_approvals: J<unknown[]> };
export type DealerStatement = Base & { dealer_id: string; period_start: string; period_end: string; total: number; status: 'open' | 'sent' | 'paid' | 'overdue'; stripe_invoice_id?: string | null; line_items: J<unknown[]> };
export type EventRow = Base & { type: string; entity_type?: string | null; entity_id?: string | null; actor?: string | null; data: J<Record<string, unknown>> };
export type NotificationKind = 'confirmation' | 'reminder_24h' | 'reminder_2h' | 'on_the_way' | 'review_request' | 'rebook_6mo' | 'cancellation';
export type QueueRow = Base & {
  booking_id?: string | null; kind: NotificationKind; run_at: string;
  status: 'pending' | 'processing' | 'sent' | 'skipped' | 'failed' | 'cancelled'; attempts: number; dedupe_key: string;
  payload: J<Record<string, unknown>>; last_error?: string | null; sent_at?: string | null;
};
export type StripeEvent = Base & { type: string };

export type TableMap = {
  profiles: Profile; techs: Tech; tech_availability: TechAvailability; blackout_dates: BlackoutDate; admin_blocks: AdminBlock;
  weather_flags: WeatherFlag; services: Service; dealers: Dealer; dealer_users: DealerUser; customers: Customer; vehicles: Vehicle;
  leads: Lead; quotes: QuoteRow; bookings: BookingRow; jobs: Job; job_photos: JobPhoto; invoices: Invoice; payments: Payment;
  notes: Note; memberships: Membership; referral_codes: ReferralCode; referral_credits: ReferralCredit; conversations: Conversation;
  messages: Message; dealer_vehicles: DealerVehicle; dealer_statements: DealerStatement; events: EventRow;
  notification_queue: QueueRow; stripe_events: StripeEvent;
};
export type TableName = keyof TableMap;
export const TABLE_NAMES: TableName[] = [
  'profiles', 'techs', 'tech_availability', 'blackout_dates', 'admin_blocks', 'weather_flags', 'services', 'dealers', 'dealer_users',
  'customers', 'vehicles', 'leads', 'quotes', 'bookings', 'jobs', 'job_photos', 'invoices', 'payments', 'notes', 'memberships',
  'referral_codes', 'referral_credits', 'conversations', 'messages', 'dealer_vehicles', 'dealer_statements', 'events',
  'notification_queue', 'stripe_events',
];
