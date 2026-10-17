import "server-only";

import { QBO_HOSTS, QBO_MINOR_VERSION, type QuickBooksEnv } from "./env";

/** A thin QuickBooks Online Accounting API client (v3). One instance per call site; no state beyond the token. */

export class QuickBooksApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string | null = null,
  ) {
    super(message);
    this.name = "QuickBooksApiError";
  }
  /** The access token was refused: the owner has to reconnect. */
  get needsReconnect() {
    return this.status === 401;
  }
}

export interface QboRef {
  value: string;
  name?: string;
}
export interface QboCustomer {
  Id: string;
  SyncToken?: string;
  DisplayName: string;
  Active?: boolean;
}
export interface QboItem {
  Id: string;
  Name: string;
  Type?: string;
  IncomeAccountRef?: QboRef;
}
export interface QboAccount {
  Id: string;
  Name: string;
  AccountType: string;
  AccountSubType?: string;
  Active?: boolean;
}
export interface QboInvoiceLine {
  Id?: string;
  LineNum?: number;
  Description?: string;
  Amount: number;
  DetailType: "SalesItemLineDetail";
  SalesItemLineDetail: { ItemRef: QboRef; Qty?: number; UnitPrice?: number; ServiceDate?: string; TaxCodeRef?: QboRef };
}
export interface QboInvoice {
  Id?: string;
  SyncToken?: string;
  DocNumber?: string;
  TxnDate?: string;
  DueDate?: string;
  CustomerRef: QboRef;
  BillEmail?: { Address: string };
  CustomerMemo?: { value: string };
  PrivateNote?: string;
  Line: QboInvoiceLine[];
  TotalAmt?: number;
  Balance?: number;
  EmailStatus?: "NotSet" | "NeedToSend" | "EmailSent" | string;
  sparse?: boolean;
}
/** A line of any kind on an invoice read back from QuickBooks (history): only some carry a description and a service date. */
export interface QboAnyLine {
  Id?: string;
  LineNum?: number;
  Description?: string;
  Amount?: number;
  DetailType?: string;
  SalesItemLineDetail?: { ServiceDate?: string };
}
export interface QboHistoryInvoice {
  Id: string;
  DocNumber?: string;
  TxnDate?: string;
  Line?: QboAnyLine[];
}
export interface QboCompanyInfo {
  CompanyName: string;
  LegalName?: string;
  Country?: string;
}

/** Intuit's error envelope. */
interface QboFault {
  Fault?: { Error?: { Message?: string; Detail?: string; code?: string }[]; type?: string };
}

export class QuickBooksClient {
  constructor(
    private readonly env: QuickBooksEnv,
    private readonly realmId: string,
    private readonly accessToken: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private url(path: string, query: Record<string, string> = {}) {
    const u = new URL(`${QBO_HOSTS[this.env].api}/v3/company/${encodeURIComponent(this.realmId)}/${path}`);
    for (const [k, v] of Object.entries(query)) u.searchParams.set(k, v);
    u.searchParams.set("minorversion", String(QBO_MINOR_VERSION));
    return u.toString();
  }

  async request<T>(method: "GET" | "POST", path: string, body?: unknown, query: Record<string, string> = {}): Promise<T> {
    const res = await this.fetchImpl(this.url(path, query), {
      method,
      headers: { accept: "application/json", "content-type": "application/json", authorization: `Bearer ${this.accessToken}` },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (!res.ok) {
      const f = (json as QboFault | null)?.Fault?.Error?.[0];
      const detail = [f?.Message, f?.Detail].filter(Boolean).join(": ");
      throw new QuickBooksApiError(detail || `QuickBooks returned ${res.status}`, res.status, f?.code ?? null);
    }
    return json as T;
  }

  /** Run a QuickBooks query ("select * from Customer where DisplayName = '…'"). Returns the rows of the one entity queried. */
  async query<T>(entity: string, sql: string): Promise<T[]> {
    const r = await this.request<{ QueryResponse?: Record<string, unknown> }>("GET", "query", undefined, { query: sql });
    return ((r.QueryResponse?.[entity] as T[] | undefined) ?? []);
  }

  async companyInfo(): Promise<QboCompanyInfo> {
    const r = await this.request<{ CompanyInfo: QboCompanyInfo }>("GET", `companyinfo/${encodeURIComponent(this.realmId)}`);
    return r.CompanyInfo;
  }

  async findCustomerByName(name: string): Promise<QboCustomer | null> {
    const rows = await this.query<QboCustomer>("Customer", `select * from Customer where DisplayName = '${escapeQ(name)}'`);
    return rows[0] ?? null;
  }

  async createCustomer(input: { DisplayName: string; CompanyName?: string; PrimaryEmailAddr?: { Address: string }; BillAddr?: { Line1?: string; Line2?: string; City?: string; CountrySubDivisionCode?: string; PostalCode?: string } }): Promise<QboCustomer> {
    const r = await this.request<{ Customer: QboCustomer }>("POST", "customer", input);
    return r.Customer;
  }

  async findItemByName(name: string): Promise<QboItem | null> {
    const rows = await this.query<QboItem>("Item", `select * from Item where Name = '${escapeQ(name)}'`);
    return rows[0] ?? null;
  }

  /** The first active Income account (Services preferred): the account the detailing item posts to. */
  async firstIncomeAccount(): Promise<QboAccount | null> {
    const rows = await this.query<QboAccount>("Account", "select * from Account where AccountType = 'Income' and Active = true maxresults 50");
    return rows.find((a) => a.AccountSubType === "ServiceFeeIncome") ?? rows.find((a) => a.AccountSubType === "SalesOfProductIncome") ?? rows[0] ?? null;
  }

  async createServiceItem(name: string, incomeAccountId: string): Promise<QboItem> {
    const r = await this.request<{ Item: QboItem }>("POST", "item", { Name: name, Type: "Service", IncomeAccountRef: { value: incomeAccountId } });
    return r.Item;
  }

  /**
   * One page of a customer's invoices in a date window, oldest first (history, 0072). QuickBooks returns at most
   * 1000 rows per query; `start` is 1-based. A page shorter than `max` is the last one.
   */
  async listInvoices(opts: { customerId: string; from: string; to: string; start?: number; max?: number }): Promise<QboHistoryInvoice[]> {
    const max = Math.min(Math.max(opts.max ?? 1000, 1), 1000);
    const start = Math.max(opts.start ?? 1, 1);
    return this.query<QboHistoryInvoice>(
      "Invoice",
      `select * from Invoice where CustomerRef = '${escapeQ(opts.customerId)}' and TxnDate >= '${opts.from}' and TxnDate <= '${opts.to}' orderby TxnDate startposition ${start} maxresults ${max}`,
    );
  }

  async getInvoice(id: string): Promise<QboInvoice> {
    const r = await this.request<{ Invoice: QboInvoice }>("GET", `invoice/${encodeURIComponent(id)}`);
    return r.Invoice;
  }

  /** Create (no Id) or fully update (Id + SyncToken) an invoice. */
  async saveInvoice(inv: QboInvoice): Promise<QboInvoice> {
    const r = await this.request<{ Invoice: QboInvoice }>("POST", "invoice", inv);
    return r.Invoice;
  }

  /** Delete an invoice (the month emptied out before it was sent). */
  async deleteInvoice(id: string, syncToken: string): Promise<void> {
    await this.request("POST", "invoice", { Id: id, SyncToken: syncToken }, { operation: "delete" });
  }
}

/** Single quotes are the only thing QuickBooks query strings need escaped. */
export function escapeQ(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}
