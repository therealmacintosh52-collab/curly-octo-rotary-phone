#!/usr/bin/env node
/**
 * Demo seed: creates an owner + two detailers, ~60 days of jobs across both
 * seeded dealerships, and a few invoices in different states, all through
 * the same RPCs the app uses (so RLS, locking and audit are exercised).
 *
 * Prereqs: migrations + supabase/seed.sql applied to the project.
 * Usage:   pnpm seed:demo            (reads .env.local)
 * Env:     NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or ANON_KEY),
 *          SUPABASE_SERVICE_ROLE_KEY, SEED_OWNER_EMAIL, SEED_OWNER_PASSWORD, SEED_DETAILER_PASSWORD
 * Safe to re-run: existing users are reused; jobs are only added when the
 * company has none.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const COMPANY_ID = "00000000-0000-4000-8000-000000000001";
const ANAHEIM = "00000000-0000-4000-8000-000000000101";
const IRVINE = "00000000-0000-4000-8000-000000000102";
const OWNER_EMAIL = process.env.SEED_OWNER_EMAIL ?? "owner@demo.calitints.app";
const OWNER_PASSWORD = process.env.SEED_OWNER_PASSWORD ?? "demo-owner-123";
const DETAILER_PASSWORD = process.env.SEED_DETAILER_PASSWORD ?? "demo-detailer-123";
const DETAILERS = [
  { email: "marco@demo.calitints.app", full_name: "Marco Reyes" },
  { email: "dee@demo.calitints.app", full_name: "Dee Alvarez" },
];

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

// --- helpers ------------------------------------------------------------------
let seed = 42;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const randInt = (a, b) => a + Math.floor(rand() * (b - a + 1));

const TRANSLIT = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9, S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9 };
const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
/** Random Mercedes-style VIN with a valid check digit. */
function fakeVin() {
  const alphabet = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";
  const wmi = pick(["W1K", "W1N", "4JG", "55S", "WDD"]);
  let body = wmi;
  while (body.length < 17) body += alphabet[Math.floor(rand() * alphabet.length)];
  const chars = body.split("");
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    if (i === 8) continue;
    const c = chars[i];
    sum += (/\d/.test(c) ? Number(c) : TRANSLIT[c]) * WEIGHTS[i];
  }
  const rem = sum % 11;
  chars[8] = rem === 10 ? "X" : String(rem);
  return chars.join("");
}

const MODELS = ["C 300", "E 350", "GLC 300", "GLE 450", "GLS 450", "S 580", "CLA 250", "GLB 250", "G 550", "EQE 350", "AMG GT 53", "Sprinter 2500"];
const COLORS = ["Obsidian Black", "Polar White", "Selenite Grey", "Iridium Silver", "Nautical Blue", "Cardinal Red"];

async function ensureUser(email, password, metadata) {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: metadata });
  if (!error) return data.user.id;
  if (!/already|exists|registered/i.test(error.message)) throw error;
  // Find the existing user.
  let page = 1;
  for (;;) {
    const { data: list } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const hit = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit.id;
    if (list.users.length < 200) throw new Error(`User ${email} exists but could not be found`);
    page++;
  }
}

async function main() {
  // Reference data must be there.
  const { data: company } = await admin.from("companies").select("id, name").eq("id", COMPANY_ID).maybeSingle();
  if (!company) throw new Error("Company not found. Apply supabase/migrations/*.sql and supabase/seed.sql first.");

  // --- users --------------------------------------------------------------
  const ownerId = await ensureUser(OWNER_EMAIL, OWNER_PASSWORD, { company_id: COMPANY_ID, role: "owner", full_name: "Owner" });
  const detailerIds = [];
  for (const d of DETAILERS) detailerIds.push(await ensureUser(d.email, DETAILER_PASSWORD, { company_id: COMPANY_ID, role: "detailer", full_name: d.full_name }));
  // Make sure roles are what we expect even if the users pre-existed.
  await admin.from("profiles").update({ role: "owner", active: true, full_name: "Owner" }).eq("id", ownerId);
  console.log(`Users ready: owner ${OWNER_EMAIL}, detailers ${DETAILERS.map((d) => d.email).join(", ")}`);

  // --- sign in as the owner and use the real RPCs ---------------------------
  const owner = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error: signInErr } = await owner.auth.signInWithPassword({ email: OWNER_EMAIL, password: OWNER_PASSWORD });
  if (signInErr) throw signInErr;

  const { count } = await owner.from("jobs").select("id", { count: "exact", head: true });
  if ((count ?? 0) > 0) {
    console.log(`Company already has ${count} jobs; skipping job/invoice seed.`);
    return;
  }

  const { data: services } = await owner.from("services").select("id, name").eq("active", true);
  const svcByName = Object.fromEntries(services.map((s) => [s.name, s.id]));
  const common = ["PDI", "Sold", "Used", "Service Loaner Detail"];
  const rare = ["Touch Up Detail", "Tint Removal", "Paint Correction (1-step)"];

  // --- jobs: last 60 days, Mon–Sat -------------------------------------------
  const today = new Date();
  let created = 0;
  let tagSeq = 4000;
  for (let daysAgo = 60; daysAgo >= 0; daysAgo--) {
    const day = new Date(today);
    day.setDate(today.getDate() - daysAgo);
    if (day.getDay() === 0) continue;
    const n = randInt(2, 6);
    for (let i = 0; i < n; i++) {
      const dealership = rand() < 0.75 ? ANAHEIM : IRVINE;
      const performed = new Date(day);
      performed.setHours(randInt(8, 17), randInt(0, 59), 0, 0);
      const names = [pick(common)];
      if (rand() < 0.35) names.push(pick(rare));
      if (rand() < 0.25) names.push(pick(common.filter((c) => c !== names[0])));
      const withVin = rand() < 0.7;
      const payload = {
        dealership_id: dealership,
        detailer_id: pick(detailerIds),
        tag_number: rand() < 0.8 ? String(tagSeq++) : `K-${randInt(100, 999)}`,
        vin: withVin ? fakeVin() : null,
        year: randInt(2019, 2026),
        make: "Mercedes-Benz",
        model: pick(MODELS),
        color: pick(COLORS),
        performed_at: performed.toISOString(),
        ro_po_number: dealership === IRVINE ? `RO-${randInt(50000, 59999)}` : rand() < 0.2 ? `RO-${randInt(50000, 59999)}` : null,
        notes: rand() < 0.15 ? pick(["Customer waiting", "Heavy pet hair", "Loaner return", "Curb rash rear left noted"]) : null,
        services: Array.from(new Set(names)).map((nm) => ({ service_id: svcByName[nm] })),
      };
      const { error } = await owner.rpc("create_job", { p: payload });
      if (error) throw new Error(`create_job failed: ${error.message}`);
      created++;
    }
  }
  console.log(`Created ${created} jobs.`);

  // --- invoices ------------------------------------------------------------
  const fmt = (d) => d.toISOString().slice(0, 10);
  const d60 = new Date(today);
  d60.setDate(today.getDate() - 60);
  const d31 = new Date(today);
  d31.setDate(today.getDate() - 31);
  const d30 = new Date(today);
  d30.setDate(today.getDate() - 30);
  const d8 = new Date(today);
  d8.setDate(today.getDate() - 8);

  // 1) Old Anaheim batch: submitted 45 days ago, paid in full 20 days ago.
  const { data: inv1, error: e1 } = await owner.rpc("generate_invoice", { p_dealership_id: ANAHEIM, p_start: fmt(d60), p_end: fmt(d31), p_notes: "Demo: first batch" });
  if (e1) throw e1;
  await owner.rpc("mark_invoice_submitted", { p_invoice_id: inv1, p_method: "email", p_note: "Demo: emailed to AP" });
  const { data: total1 } = await owner.from("invoices").select("total").eq("id", inv1).single();
  await owner.rpc("record_payment", { p_invoice_id: inv1, p_amount: Number(total1.total), p_paid_at: fmt(new Date(today.getTime() - 20 * 864e5)), p_method: "check", p_reference: "10442" });
  // Backdate submitted_at so days-to-pay is realistic (service role bypasses RLS).
  await admin.from("invoices").update({ submitted_at: new Date(today.getTime() - 45 * 864e5).toISOString() }).eq("id", inv1);

  // 2) Recent Anaheim batch: submitted 9 days ago, partially paid.
  const { data: inv2, error: e2 } = await owner.rpc("generate_invoice", { p_dealership_id: ANAHEIM, p_start: fmt(d30), p_end: fmt(d8), p_notes: "Demo: second batch" });
  if (e2) throw e2;
  await owner.rpc("mark_invoice_submitted", { p_invoice_id: inv2, p_method: "portal", p_note: "Demo: uploaded to dealer portal, ref 88213" });
  const { data: total2 } = await owner.from("invoices").select("total").eq("id", inv2).single();
  await owner.rpc("record_payment", { p_invoice_id: inv2, p_amount: Math.round(Number(total2.total) * 0.4 * 100) / 100, p_paid_at: fmt(new Date(today.getTime() - 2 * 864e5)), p_method: "ach", p_note: "Partial: dealer short-paid pending PO" });
  await admin.from("invoices").update({ submitted_at: new Date(today.getTime() - 9 * 864e5).toISOString() }).eq("id", inv2);

  // 3) Irvine per-job invoices for everything older than 8 days: submitted 40 days ago → overdue.
  const { data: irvineIds, error: e3 } = await owner.rpc("generate_per_job_invoices", { p_dealership_id: IRVINE, p_notes: "Demo: per-RO" });
  if (e3) throw e3;
  for (const id of (irvineIds ?? []).slice(0, 3)) {
    await owner.rpc("mark_invoice_submitted", { p_invoice_id: id, p_method: "portal" });
    await admin.from("invoices").update({ submitted_at: new Date(today.getTime() - 40 * 864e5).toISOString() }).eq("id", id);
  }
  console.log(`Invoices: 1 paid, 1 partial, ${irvineIds?.length ?? 0} per-job (3 submitted/overdue, rest draft). Remaining recent jobs are uninvoiced.`);
  console.log(`\nSign in at /login as ${OWNER_EMAIL} / ${OWNER_PASSWORD} (owner) or ${DETAILERS[0].email} / ${DETAILER_PASSWORD} (detailer).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
