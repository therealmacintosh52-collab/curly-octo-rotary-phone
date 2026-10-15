// Customer-merge plan shared by the mock repo and (as documentation of intent) supabase/migrations/0002_admin.sql
// (`merge_customers`). Keep the two lists in sync.
import type { TableName } from './types';

/** Child tables and the column that points at customers.id. */
export const CUSTOMER_FKS: { table: TableName; col: string }[] = [
  { table: 'vehicles', col: 'customer_id' },
  { table: 'leads', col: 'customer_id' },
  { table: 'quotes', col: 'customer_id' },
  { table: 'bookings', col: 'customer_id' },
  { table: 'jobs', col: 'customer_id' },
  { table: 'invoices', col: 'customer_id' },
  { table: 'payments', col: 'customer_id' },
  { table: 'memberships', col: 'customer_id' },
  { table: 'referral_codes', col: 'customer_id' },
  { table: 'referral_credits', col: 'referred_customer_id' },
  { table: 'conversations', col: 'customer_id' },
];

/** Fields on the kept customer that a duplicate may fill when the kept one is empty. */
export const FILLABLE = ['email', 'phone', 'dealer_id', 'referral_code_used', 'stripe_customer_id'] as const;

export const invoiceNumber = (year: number, n: number) => `INV-${year}-${String(n).padStart(4, '0')}`;
