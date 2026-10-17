import { afterEach, describe, expect, it, vi } from "vitest";
import { invoiceBundleFixture } from "@/test/fixtures";
import { addDays, describeLine, invoicePayload, parseTermsDays } from "./payload";
import { QuickBooksApiError, QuickBooksClient, escapeQ } from "./client";
import { authorizeUrl } from "./connection";

describe("QuickBooks invoice payload", () => {
  const b = invoiceBundleFixture();

  it("maps the invoice: our number, period end, customer, one line per car × service", () => {
    const p = invoicePayload(b, "cust-1", "item-9");
    expect(p.DocNumber).toBeUndefined(); // QuickBooks numbers it
    expect(p.TxnDate).toBe(b.invoice.period_end);
    expect(p.CustomerRef).toEqual({ value: "cust-1" });
    expect(p.BillEmail).toEqual({ Address: b.dealership.ap_emails[0] });
    expect(p.Line).toHaveLength(b.items.length);
    expect(p.Line[0]).toMatchObject({ DetailType: "SalesItemLineDetail", Amount: Number(b.items[0].price), SalesItemLineDetail: { ItemRef: { value: "item-9" }, Qty: 1, UnitPrice: Number(b.items[0].price) } });
    expect(p.Line.reduce((s, l) => s + l.Amount, 0)).toBeCloseTo(Number(b.invoice.subtotal), 2);
    expect(p.Id).toBeUndefined();
  });

  it("describes a line the way the owner reads it", () => {
    const it0 = b.items[0];
    const d = describeLine(it0);
    expect(d).toContain(`Stock ${it0.tag_number}`);
    expect(d).toContain(it0.service_name);
    expect(d).toMatch(/^[A-Z][a-z]{2} \d{1,2} · /);
  });

  it("flags a tax amount in the private note instead of inventing a tax line", () => {
    const taxed = invoiceBundleFixture({ invoice: { ...b.invoice, tax: 12.5 } });
    const p = invoicePayload(taxed, "c", "i");
    expect(p.PrivateNote).toMatch(/Tax of 12.50/);
    expect(p.Line.every((l) => l.DetailType === "SalesItemLineDetail")).toBe(true);
  });

  it("derives a due date from payment terms when there are any", () => {
    expect(parseTermsDays("Net 30")).toBe(30);
    expect(parseTermsDays("")).toBeNull();
    expect(addDays("2026-09-30", 30)).toBe("2026-10-30");
    const withTerms = invoiceBundleFixture({ dealership: { ...b.dealership, payment_terms: "Net 15" } });
    expect(invoicePayload(withTerms, "c", "i").DueDate).toBe(addDays(b.invoice.period_end, 15));
    expect(invoicePayload(b, "c", "i").DueDate).toBeUndefined();
  });
});

describe("QuickBooks client", () => {
  afterEach(() => vi.unstubAllGlobals());

  function fakeFetch(handler: (url: URL, init: RequestInit) => { status?: number; body: unknown }) {
    const f = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
      const r = handler(url, init ?? {});
      return new Response(JSON.stringify(r.body), { status: r.status ?? 200, headers: { "content-type": "application/json" } });
    });
    return f as unknown as typeof fetch;
  }

  it("queries with the realm, minor version and bearer token", async () => {
    const f = fakeFetch((url, init) => {
      expect(url.origin).toBe("https://sandbox-quickbooks.api.intuit.com");
      expect(url.pathname).toBe("/v3/company/123/query");
      expect(url.searchParams.get("minorversion")).toBe("75");
      expect(url.searchParams.get("query")).toBe("select * from Customer where DisplayName = 'Mercedes-Benz of El Dorado Hills'");
      expect((init.headers as Record<string, string>).authorization).toBe("Bearer tok");
      return { body: { QueryResponse: { Customer: [{ Id: "7", DisplayName: "Mercedes-Benz of El Dorado Hills" }] } } };
    });
    const c = new QuickBooksClient("sandbox", "123", "tok", f);
    expect(await c.findCustomerByName("Mercedes-Benz of El Dorado Hills")).toMatchObject({ Id: "7" });
  });

  it("posts an invoice and returns Intuit's copy", async () => {
    const f = fakeFetch((url, init) => {
      expect(url.pathname).toBe("/v3/company/9/invoice");
      const sent = JSON.parse(String(init.body)) as { DocNumber: string };
      return { body: { Invoice: { Id: "55", SyncToken: "0", DocNumber: sent.DocNumber, Balance: 355, CustomerRef: { value: "c" }, Line: [] } } };
    });
    const c = new QuickBooksClient("production", "9", "tok", f);
    const saved = await c.saveInvoice({ DocNumber: "INV-000012", CustomerRef: { value: "c" }, Line: [] });
    expect(saved).toMatchObject({ Id: "55", DocNumber: "INV-000012", Balance: 355 });
  });

  it("turns an Intuit fault into a readable error and flags a 401 for reconnect", async () => {
    const f = fakeFetch(() => ({ status: 401, body: { Fault: { Error: [{ Message: "AuthenticationFailed", Detail: "Token expired", code: "3200" }], type: "AUTHENTICATION" } } }));
    const c = new QuickBooksClient("production", "9", "tok", f);
    const err = await c.companyInfo().catch((e) => e as QuickBooksApiError);
    expect(err).toBeInstanceOf(QuickBooksApiError);
    expect((err as QuickBooksApiError).message).toBe("AuthenticationFailed: Token expired");
    expect((err as QuickBooksApiError).needsReconnect).toBe(true);
    expect((err as QuickBooksApiError).code).toBe("3200");
  });

  it("lists a customer's invoices in a date window, oldest first, one page at a time", async () => {
    const queries: string[] = [];
    const f = fakeFetch((url) => {
      queries.push(url.searchParams.get("query") ?? "");
      return { body: { QueryResponse: { Invoice: [{ Id: "11", DocNumber: "1061", TxnDate: "2026-02-28", Line: [{ Id: "1", Description: "Stock 4821", Amount: 200, DetailType: "SalesItemLineDetail" }] }], startPosition: 1, maxResults: 1 } } };
    });
    const c = new QuickBooksClient("production", "9", "tok", f);
    const rows = await c.listInvoices({ customerId: "7", from: "2026-01-01", to: "2026-06-30", start: 1001 });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ Id: "11", DocNumber: "1061" });
    expect(queries[0]).toBe("select * from Invoice where CustomerRef = '7' and TxnDate >= '2026-01-01' and TxnDate <= '2026-06-30' orderby TxnDate startposition 1001 maxresults 1000");
    // a page can never be asked for more than QuickBooks allows, or from before the first row
    await c.listInvoices({ customerId: "7", from: "2026-01-01", to: "2026-06-30", start: 0, max: 5000 });
    expect(queries[1]).toContain("startposition 1 maxresults 1000");
  });

  it("escapes quotes in query strings", () => {
    expect(escapeQ("Mike's Autos")).toBe("Mike\\'s Autos");
  });

  it("builds the Intuit authorize URL", () => {
    const u = new URL(authorizeUrl("https://app.example/api/quickbooks/callback", "abc", "client-1"));
    expect(u.origin + u.pathname).toBe("https://appcenter.intuit.com/connect/oauth2");
    expect(u.searchParams.get("client_id")).toBe("client-1");
    expect(u.searchParams.get("scope")).toBe("com.intuit.quickbooks.accounting");
    expect(u.searchParams.get("redirect_uri")).toBe("https://app.example/api/quickbooks/callback");
    expect(u.searchParams.get("state")).toBe("abc");
    expect(u.searchParams.get("response_type")).toBe("code");
  });
});
