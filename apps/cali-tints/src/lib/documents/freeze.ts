import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, EstimateView, ReceiptView, SignedDocumentKind } from "@/lib/db/types";
import { estimateAssets, estimateFileStem } from "@/lib/estimates/load";
import { estimatePdf } from "@/lib/estimates/pdf";
import { receiptAssets, receiptFileStem } from "@/lib/receipts/load";
import { receiptPdf } from "@/lib/receipts/pdf";
import { sendRetailEmail } from "@/lib/retail/email";

type Db = SupabaseClient<Database>;

export const DOCUMENT_LABEL: Record<SignedDocumentKind, string> = { estimate: "Estimate & authorization", supplement: "Extra work approval", invoice: "Final invoice & receipt" };

/**
 * Freeze one signed PDF: the bytes and their SHA-256 are stored once and never
 * regenerated, so the shop copy is the paper the customer actually signed.
 * Idempotent per (kind, source): the second call returns the first.
 */
export async function storeSignedDocument(db: Db, a: { companyId: string; kind: SignedDocumentKind; sourceId: string; estimateId: string | null; jobId: string | null; pdf: Buffer }): Promise<{ id: string; created: boolean; sha256: string }> {
  const existing = await db.from("ro_documents").select("id, sha256").eq("company_id", a.companyId).eq("kind", a.kind).eq("source_id", a.sourceId).maybeSingle();
  if (existing.data) return { id: existing.data.id, created: false, sha256: existing.data.sha256 };
  const sha256 = createHash("sha256").update(a.pdf).digest("hex");
  const path = `${a.companyId}/${a.kind}/${a.sourceId}.pdf`;
  const up = await db.storage.from("signed-docs").upload(path, a.pdf, { contentType: "application/pdf", upsert: false });
  if (up.error && !/exists|duplicate/i.test(up.error.message)) throw new Error(up.error.message);
  const ins = await db.from("ro_documents").insert({ company_id: a.companyId, estimate_id: a.estimateId, job_id: a.jobId, kind: a.kind, source_id: a.sourceId, path, sha256, byte_size: a.pdf.length }).select("id").single();
  if (ins.error) {
    // a concurrent call froze it first
    const again = await db.from("ro_documents").select("id, sha256").eq("company_id", a.companyId).eq("kind", a.kind).eq("source_id", a.sourceId).maybeSingle();
    if (again.data) return { id: again.data.id, created: false, sha256: again.data.sha256 };
    throw new Error(ins.error.message);
  }
  return { id: ins.data.id, created: true, sha256 };
}

async function mailCopy(db: Db, o: { companyId: string; to: string | null | undefined; firstName: string; vehicle: string | null; document: string; companyName: string; replyTo: string | null; refId: string; filename: string; pdf: Buffer }) {
  const rs = await db.from("retail_settings").select("email_templates").eq("company_id", o.companyId).maybeSingle();
  return sendRetailEmail({ to: o.to, key: "signed_copy", templates: (rs.data?.email_templates as Record<string, never> | null) ?? null, vars: { first_name: o.firstName, vehicle: o.vehicle ?? "car", document: o.document, company: o.companyName }, companyName: o.companyName, replyTo: o.replyTo, refId: o.refId, attachments: [{ filename: o.filename, content: o.pdf }] });
}

/**
 * The customer approved an estimate (online or in person): freeze the signed
 * PDF and email it to them as an attachment. Best effort: never fails the approval.
 */
export async function freezeApproval(db: Db, e: EstimateView, companyId: string): Promise<{ stored: boolean; emailed: boolean }> {
  const auth = e.authorizations[0];
  if (!auth) return { stored: false, emailed: false };
  const kind: SignedDocumentKind = e.kind === "supplement" ? "supplement" : "estimate";
  const assets = await estimateAssets(db, e);
  const pdf = await estimatePdf(e, assets.logoDataUri, assets.signatureDataUri);
  const doc = await storeSignedDocument(db, { companyId, kind, sourceId: auth.id, estimateId: e.id, jobId: e.job_id, pdf });
  if (!doc.created) return { stored: true, emailed: false };
  const c = await db.from("customers").select("email, first_name").eq("id", e.customer.id).maybeSingle();
  const r = await mailCopy(db, { companyId, to: c.data?.email, firstName: c.data?.first_name ?? e.customer.first_name, vehicle: e.vehicle?.name ?? null, document: kind === "supplement" ? "approval of the extra work" : "estimate and authorization", companyName: e.company.name, replyTo: e.company.email, refId: doc.id, filename: `signed-${estimateFileStem(e)}.pdf`, pdf });
  return { stored: true, emailed: r.ok };
}

/** The customer signed for the car after paying: freeze the final invoice and receipt and email it. */
export async function freezeInvoice(db: Db, r: ReceiptView, companyId: string, estimateId: string | null): Promise<{ stored: boolean; emailed: boolean }> {
  if (!r.has_signature) return { stored: false, emailed: false };
  const assets = await receiptAssets(db, r);
  const pdf = await receiptPdf(r, assets.logoDataUri, assets.signatureDataUri);
  const doc = await storeSignedDocument(db, { companyId, kind: "invoice", sourceId: r.id, estimateId, jobId: r.id, pdf });
  if (!doc.created) return { stored: true, emailed: false };
  const mail = await mailCopy(db, { companyId, to: r.customer?.email, firstName: r.customer?.first_name ?? "there", vehicle: r.vehicle, document: "invoice and receipt", companyName: r.company.name, replyTo: r.company.email, refId: doc.id, filename: `signed-${receiptFileStem(r)}.pdf`, pdf });
  return { stored: true, emailed: mail.ok };
}
