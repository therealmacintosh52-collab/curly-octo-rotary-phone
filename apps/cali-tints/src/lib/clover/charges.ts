import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CloverPaymentStatus, Database } from "@/lib/db/types";
import { createCharge, payOnDevice, type CloverContext, type DeviceTarget } from "./client";
import { fromCents, toCents } from "./money";

/*
  Shared by the invoice page and the Terminal: take the money through Clover,
  then park the result in the clover_payments queue so the periodic sync never
  re-imports it. Invoice-linked callers apply the queue row to the invoice
  afterwards (apply_clover_payment); stand-alone sales leave it `ignored`.
*/

export interface CloverTake {
  /** Id used in clover_payments.clover_payment_id (raw payment id, or charge_<id>). */
  cloverPaymentId: string;
  /** Raw ecom charge id, only for card-not-present charges. */
  chargeId: string | null;
  amount: number;
  brand: string | null;
  last4: string | null;
}

type Db = SupabaseClient<Database>;

export class CloverDeclined extends Error {}

/** Charge a single-use clv_ token from the iframe form and queue the result. */
export async function chargeCardToQueue(ctx: CloverContext, supabase: Db, companyId: string, input: { token: string; amount: number; description: string; reference: string; idempotencyKey: string; status: CloverPaymentStatus }): Promise<CloverTake> {
  const charge = await createCharge(ctx, {
    amountCents: toCents(input.amount),
    source: input.token,
    description: input.description,
    externalReferenceId: input.reference,
    idempotencyKey: input.idempotencyKey,
  });
  if (charge.status && !/succeeded|paid|approved/i.test(charge.status)) throw new CloverDeclined(charge.failure_message ?? `Card declined (${charge.status})`);
  const cloverPaymentId = `charge_${charge.id}`;
  const amount = fromCents(charge.amount ?? toCents(input.amount));
  await supabase.from("clover_payments").upsert(
    {
      company_id: companyId,
      clover_payment_id: cloverPaymentId,
      source: "clover_card",
      amount,
      paid_at: new Date().toISOString(),
      card_brand: charge.source?.brand ?? null,
      last4: charge.source?.last4 ?? null,
      reference: input.reference,
      raw: charge as never,
      status: input.status,
    },
    { onConflict: "company_id,clover_payment_id", ignoreDuplicates: true },
  );
  return { cloverPaymentId, chargeId: charge.id, amount, brand: charge.source?.brand ?? null, last4: charge.source?.last4 ?? null };
}

/** Send the amount to the physical terminal, wait for the tap, queue the result. */
export async function deviceToQueue(ctx: CloverContext, device: DeviceTarget, supabase: Db, companyId: string, input: { amount: number; reference: string; externalPaymentId: string; orderId?: string | null; status: CloverPaymentStatus }): Promise<CloverTake> {
  const res = await payOnDevice(ctx, device, { amountCents: toCents(input.amount), externalPaymentId: input.externalPaymentId, externalReferenceId: input.reference });
  const payment = res.payment;
  if (!payment || (payment.result && payment.result !== "SUCCESS")) {
    const msg = typeof res.error === "string" ? res.error : res.error?.message ?? res.message ?? (payment?.result ? `Terminal reported ${payment.result}` : "The terminal did not complete the payment");
    throw new CloverDeclined(msg);
  }
  const amount = fromCents(payment.amount ?? toCents(input.amount));
  await supabase.from("clover_payments").upsert(
    {
      company_id: companyId,
      clover_payment_id: payment.id,
      clover_order_id: payment.order?.id ?? input.orderId ?? null,
      source: "clover_pos",
      amount,
      tip: fromCents(payment.tipAmount ?? 0),
      paid_at: new Date(payment.createdTime ?? Date.now()).toISOString(),
      card_brand: payment.cardTransaction?.cardType ?? null,
      last4: payment.cardTransaction?.last4 ?? null,
      reference: input.reference,
      raw: payment as never,
      status: input.status,
    },
    { onConflict: "company_id,clover_payment_id", ignoreDuplicates: true },
  );
  return { cloverPaymentId: payment.id, chargeId: null, amount, brand: payment.cardTransaction?.cardType ?? null, last4: payment.cardTransaction?.last4 ?? null };
}
