import { describe, expect, it } from "vitest";
import { checkoutBody, checkoutHeaders, checkoutUrl, parseCheckoutResponse } from "./checkout";
import { constantTimeEqual, parseWebhook, webhookAuthorized } from "./webhook";

describe("clover hosted checkout", () => {
  it("builds the session request the docs describe", () => {
    expect(checkoutUrl("sandbox")).toBe("https://scl-sandbox.dev.clover.com/invoicingcheckoutservice/v1/checkouts");
    expect(checkoutUrl("production")).toBe("https://scl.clover.com/invoicingcheckoutservice/v1/checkouts");
    const body = checkoutBody({ amountCents: 4000, name: "Deposit · APT-000003", note: "2021 Ford F-150", customer: { firstName: "Jordan", lastName: "Lee", email: "j@example.com", phoneNumber: "(916) 555-0199" }, redirect: { success: "https://x/a/t?paid=1", failure: "https://x/a/t?failed=1", cancel: "https://x/a/t" } });
    expect(body).toEqual({
      customer: { firstName: "Jordan", lastName: "Lee", email: "j@example.com", phoneNumber: "9165550199" },
      shoppingCart: { lineItems: [{ name: "Deposit · APT-000003", price: 4000, unitQty: 1, note: "2021 Ford F-150" }] },
      redirectUrls: { success: "https://x/a/t?paid=1", failure: "https://x/a/t?failed=1", cancel: "https://x/a/t" },
    });
    expect(() => checkoutBody({ amountCents: 12.5, name: "x", customer: {}, redirect: { success: "", failure: "", cancel: "" } })).toThrow();
    expect(checkoutHeaders("pk_test", "M123")).toMatchObject({ authorization: "Bearer pk_test", "X-Clover-Merchant-Id": "M123" });
  });

  it("reads the session out of the response", () => {
    expect(parseCheckoutResponse({ href: "https://checkout.sandbox.dev.clover.com/?x", checkoutSessionId: "abc", expirationTime: 1 })).toMatchObject({ href: "https://checkout.sandbox.dev.clover.com/?x", checkoutSessionId: "abc" });
    expect(() => parseCheckoutResponse({ message: "Unauthorized" })).toThrow("Unauthorized");
  });

  it("checks the webhook secret in constant time and parses the event", () => {
    expect(constantTimeEqual("abc", "abc")).toBe(true);
    expect(constantTimeEqual("abc", "abd")).toBe(false);
    expect(webhookAuthorized("s3cret", { query: null, header: "s3cret", bearer: null })).toBe(true);
    expect(webhookAuthorized("s3cret", { query: "nope", header: null, bearer: null })).toBe(false);
    expect(parseWebhook({ verificationCode: "v1" }).verificationCode).toBe("v1");
    const e = parseWebhook({ data: { checkoutSessionId: "sess_1", status: "PAID", payments: [{ id: "PAY1", amount: 4000 }] } });
    expect(e).toMatchObject({ checkoutSessionId: "sess_1", status: "paid", paymentId: "PAY1", amountCents: 4000 });
    expect(parseWebhook({ checkoutSessionId: "sess_2", paymentStatus: "DECLINED" }).status).toBe("failed");
    expect(parseWebhook({}).checkoutSessionId).toBeNull();
  });
});
