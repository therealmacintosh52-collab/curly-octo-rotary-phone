import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/estimates/pdf", () => ({ estimatePdf: vi.fn() }));
vi.mock("@/lib/receipts/pdf", () => ({ receiptPdf: vi.fn() }));
vi.mock("@/lib/retail/email", () => ({ sendRetailEmail: vi.fn() }));

import { storeSignedDocument } from "./freeze";

/** A tiny stand-in for the admin client: one table, one bucket. */
function fakeDb() {
  const rows: Record<string, unknown>[] = [];
  const files = new Map<string, Buffer>();
  const table = () => {
    const f: Record<string, unknown> = {};
    const q = {
      select: () => q,
      eq: (k: string, v: unknown) => {
        f[k] = v;
        return q;
      },
      maybeSingle: async () => ({ data: rows.find((r) => Object.entries(f).every(([k, v]) => r[k] === v)) ?? null }),
      insert: (row: Record<string, unknown>) => {
        const r = { id: `doc-${rows.length + 1}`, ...row };
        rows.push(r);
        return { select: () => ({ single: async () => ({ data: r, error: null }) }) };
      },
    };
    return q;
  };
  const db = {
    from: () => table(),
    storage: { from: () => ({ upload: async (path: string, bytes: Buffer) => (files.has(path) ? { error: { message: "The resource already exists" } } : (files.set(path, bytes), { error: null })) }) },
  };
  return { db: db as never, rows, files };
}

describe("storeSignedDocument", () => {
  const pdf = Buffer.from("%PDF-1.4 signed paper");
  const args = { companyId: "c1", kind: "estimate" as const, sourceId: "auth-1", estimateId: "e1", jobId: "j1", pdf };

  it("stores the bytes once with their SHA-256", async () => {
    const { db, rows, files } = fakeDb();
    const r = await storeSignedDocument(db, args);
    expect(r.created).toBe(true);
    expect(r.sha256).toBe(createHash("sha256").update(pdf).digest("hex"));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ company_id: "c1", kind: "estimate", source_id: "auth-1", byte_size: pdf.length, path: "c1/estimate/auth-1.pdf" });
    expect(files.get("c1/estimate/auth-1.pdf")).toEqual(pdf);
  });

  it("is idempotent: the second call returns the first and writes nothing", async () => {
    const { db, rows } = fakeDb();
    const a = await storeSignedDocument(db, args);
    const b = await storeSignedDocument(db, { ...args, pdf: Buffer.from("a different render") });
    expect(b.created).toBe(false);
    expect(b.id).toBe(a.id);
    expect(b.sha256).toBe(a.sha256);
    expect(rows).toHaveLength(1);
  });

  it("keeps different signatures apart", async () => {
    const { db, rows } = fakeDb();
    await storeSignedDocument(db, args);
    await storeSignedDocument(db, { ...args, sourceId: "auth-2", kind: "supplement" });
    expect(rows).toHaveLength(2);
  });
});
