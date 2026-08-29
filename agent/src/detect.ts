// Decides whether a PR's changed files touch webhook or payment-handling code — the gate on whether EscrowAI runs at all.

/** One changed file from a PR diff. */
export interface ChangedFile {
  path: string;
  /** Optional unified-diff hunk text for this file, used for a second-pass content check. */
  patch?: string;
}

export interface DetectionResult {
  touched: boolean;
  /** The paths that matched, with the rule that matched each. */
  matches: Array<{ path: string; rule: string }>;
  /** Plain-English summary for the verdict comment. */
  reason: string;
}

/** Path-segment patterns that signal webhook / payment handling. */
const PATH_RULES: Array<{ rule: string; test: RegExp }> = [
  { rule: "webhook route", test: /(^|[/_-])webhooks?([/_.-]|$)/i },
  { rule: "payment module", test: /(^|[/_-])(payments?|billing|checkout|charges?|refunds?)([/_.-]|$)/i },
  { rule: "provider handler", test: /(stripe|razorpay|paypal|adyen|braintree)/i },
  { rule: "ledger / balance", test: /(^|[/_-])(ledger|balance|wallet|entitlements?)([/_.-]|$)/i }
];

/** Content signals inside a diff hunk — a change that adds/removes one of these is payment-relevant even in an oddly named file. */
const CONTENT_RULES: Array<{ rule: string; test: RegExp }> = [
  { rule: "webhook event type", test: /["'](payment_intent|charge|checkout\.session|invoice|payout)\.[a-z_.]+["']/i },
  { rule: "razorpay event", test: /["'](payment|refund|order|subscription)\.[a-z_.]+["']/i },
  { rule: "signature verification", test: /(stripe-signature|x-razorpay-signature|constructEvent|verifyWebhookSignature)/i },
  { rule: "ledger call", test: /\b(credit|debit|capture|refund|chargeback)\s*\(/i }
];

/** Extra explicit paths from the target manifest that must always trigger a run. */
export function detectWebhookChanges(
  files: ChangedFile[],
  manifestWebhookPaths: string[] = []
): DetectionResult {
  const explicit = new Set(manifestWebhookPaths.map((p) => p.replace(/^\.?\//, "")));
  const matches: DetectionResult["matches"] = [];

  for (const file of files) {
    const normalized = file.path.replace(/^\.?\//, "");

    if (explicit.has(normalized)) {
      matches.push({ path: file.path, rule: "declared webhook path" });
      continue;
    }

    const pathRule = PATH_RULES.find((r) => r.test.test(file.path));
    if (pathRule) {
      matches.push({ path: file.path, rule: pathRule.rule });
      continue;
    }

    if (file.patch) {
      const contentRule = CONTENT_RULES.find((r) => r.test.test(file.patch!));
      if (contentRule) matches.push({ path: file.path, rule: `${contentRule.rule} (in diff)` });
    }
  }

  const touched = matches.length > 0;
  const reason = touched
    ? `Touches webhook/payment code: ${matches
        .map((m) => `${m.path} (${m.rule})`)
        .join(", ")}.`
    : "No changed file matches a webhook or payment-handling pattern.";

  return { touched, matches, reason };
}
