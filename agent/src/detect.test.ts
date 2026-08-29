// Tests for webhook-change detection — it must fire on the obvious cases and stay quiet on unrelated changes.

import { describe, expect, it } from "vitest";
import { detectWebhookChanges } from "./detect.js";

describe("detectWebhookChanges", () => {
  it("fires on a webhook route path", () => {
    const r = detectWebhookChanges([{ path: "src/routes/webhooks/stripe.ts" }]);
    expect(r.touched).toBe(true);
    expect(r.matches[0]?.rule).toBe("webhook route");
  });

  it("fires on a payment/billing module", () => {
    expect(detectWebhookChanges([{ path: "app/billing/reconcile.js" }]).touched).toBe(true);
  });

  it("fires on a declared manifest path even with a neutral name", () => {
    const r = detectWebhookChanges([{ path: "src/handlers.js" }], ["src/handlers.js"]);
    expect(r.touched).toBe(true);
    expect(r.matches[0]?.rule).toBe("declared webhook path");
  });

  it("fires on diff content when the filename is unremarkable", () => {
    const r = detectWebhookChanges([
      {
        path: "src/core/dispatch.ts",
        patch: "@@\n- case 'payment_intent.succeeded':\n+ case 'payment_intent.payment_failed':"
      }
    ]);
    expect(r.touched).toBe(true);
    expect(r.matches[0]?.rule).toContain("in diff");
  });

  it("stays quiet on unrelated changes", () => {
    const r = detectWebhookChanges([
      { path: "README.md" },
      { path: "src/ui/Button.tsx", patch: "@@\n- color: red\n+ color: blue" }
    ]);
    expect(r.touched).toBe(false);
    expect(r.reason).toMatch(/no changed file/i);
  });
});
