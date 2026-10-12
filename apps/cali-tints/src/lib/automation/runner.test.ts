import { describe, expect, it, vi } from "vitest";
import type { ClaimedRun } from "@/lib/db/types";
import { ownerSummary, runAutomation, runVariables, type Sender } from "./runner";

const baseRun: ClaimedRun = {
  run_id: "run-1",
  company_id: "c1",
  rule_key: "booking_booked",
  rule_name: "Booking confirmed",
  event_kind: "booking.booked",
  payload: {},
  subject_type: "appointment",
  subject_id: "a1",
  subject: { status: "booked", starts_at: "2026-10-19T15:00:00Z", token: "tok-appointment-0001-xxxxxxxx", vehicle: "2021 Ford F-150", services: "Full detail", display_number: "APT-000003", total: 240 },
  action: { kind: "both", template: "booking_confirmed" },
  customer: { id: "cu1", first_name: "Jordan", display_name: "Jordan Lee", email: "j@example.com", phone: "(916) 555-0199", sms_opt_in: true },
  company: { name: "Cali Tints", email: "mike@example.com", phone: null, timezone: "America/Los_Angeles", address: "2900 Fulton Ave, Sacramento, CA" },
  settings: { hold_minutes: 30, review_url: "https://g.page/r/x/review", email_templates: null },
};

function fakeDb(runs: ClaimedRun[]) {
  const calls: { fn: string; args: unknown }[] = [];
  const rpc = vi.fn(async (fn: string, args?: unknown) => {
    calls.push({ fn, args });
    if (fn === "enqueue_due_runs") return { data: { derived: 1, events: 2, runs: 3 }, error: null };
    if (fn === "claim_runs") return { data: runs, error: null };
    if (fn === "queue_text") return { data: "tq-1", error: null };
    return { data: null, error: null };
  });
  return { db: { rpc } as never, calls };
}

describe("automation runner", () => {
  it("renders the placeholders from the run's subject in the shop's timezone", () => {
    const v = runVariables(baseRun);
    expect(v.first_name).toBe("Jordan");
    expect(v.vehicle).toBe("2021 Ford F-150");
    expect(v.starts_at).toBe("Mon, Oct 19 · 8:00 AM");
    expect(String(v.manage_url)).toMatch(/\/a\/tok-appointment-0001-xxxxxxxx$/);
    expect(v.review_url).toBe("https://g.page/r/x/review");
    expect(v.total).toBe("$240.00");
    const hold = runVariables({ ...baseRun, subject: { ...baseRun.subject, status: "hold" } });
    expect(String(hold.booking_url)).toMatch(/\/book\/tok-appointment-0001-xxxxxxxx$/);
  });

  it("summarises a run for the owner", () => {
    const { subject, body } = ownerSummary({ ...baseRun, action: { kind: "notify_owner", owner_subject: "New online booking to confirm" }, subject: { ...baseRun.subject, pay_choice: "deposit" } });
    expect(subject).toBe("New online booking to confirm: Jordan Lee · 2021 Ford F-150");
    expect(body).toContain("APT-000003");
    expect(body).toContain("Wants to pay the deposit online");
    expect(body).toMatch(/\/retail\/appointments\/a1$/);
  });

  it("emails, queues the text and logs the run as sent", async () => {
    const { db, calls } = fakeDb([baseRun]);
    const sender: Sender = { email: vi.fn(async () => ({ ok: true as const, messageId: "m1" })), ownerEmail: vi.fn(async () => ({ ok: true as const, messageId: "o1" })) };
    const report = await runAutomation(db, sender);
    expect(report).toMatchObject({ claimed: 1, sent: 1, skipped: 0, failed: 0, errors: [] });
    expect(sender.email).toHaveBeenCalledWith(expect.objectContaining({ to: "j@example.com", key: "booking_confirmed" }));
    const text = calls.find((c) => c.fn === "queue_text");
    expect(text?.args).toMatchObject({ p_phone: "(916) 555-0199", p_reason: "Booking confirmed" });
    expect(String((text?.args as { p_body: string }).p_body)).toContain("Jordan");
    expect(calls.find((c) => c.fn === "complete_run")?.args).toMatchObject({ p_id: "run-1", p_status: "sent" });
  });

  it("logs a skip when email is not configured and no consent for a text", async () => {
    const { db, calls } = fakeDb([{ ...baseRun, customer: { ...baseRun.customer!, sms_opt_in: false } }]);
    const sender: Sender = { email: vi.fn(async () => ({ ok: false as const, error: "Email is not configured", skipped: true })), ownerEmail: vi.fn() as never };
    const report = await runAutomation(db, sender);
    expect(report.skipped).toBe(1);
    const done = calls.find((c) => c.fn === "complete_run")?.args as { p_status: string; p_result: string };
    expect(done.p_status).toBe("skipped");
    expect(done.p_result).toContain("not configured");
    expect(done.p_result).toContain("no consent");
  });

  it("tells the owner and fails a run on a hard email error", async () => {
    const owner: ClaimedRun = { ...baseRun, run_id: "run-2", action: { kind: "notify_owner", owner_subject: "Estimate approved" } };
    const bad: ClaimedRun = { ...baseRun, run_id: "run-3", action: { kind: "email", template: "reminder" } };
    const { db, calls } = fakeDb([owner, bad]);
    const sender: Sender = { email: vi.fn(async () => ({ ok: false as const, error: "boom" })), ownerEmail: vi.fn(async () => ({ ok: true as const, messageId: "o2" })) };
    const report = await runAutomation(db, sender);
    expect(report).toMatchObject({ claimed: 2, sent: 1, failed: 1 });
    expect(sender.ownerEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "mike@example.com", subject: expect.stringContaining("Estimate approved") }));
    expect(calls.filter((c) => c.fn === "complete_run").map((c) => (c.args as { p_status: string }).p_status)).toEqual(["sent", "failed"]);
  });
});
