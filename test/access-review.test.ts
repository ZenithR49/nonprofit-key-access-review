import assert from "node:assert/strict";
import test from "node:test";
import { buildAccessReview } from "../src/access-review.js";

test("reports exactly which nonprofit workflows each key can reach", () => {
  const review = buildAccessReview({
    keys: [
      { id: "key_receipts", name: "Receipt worker", scopes: ["pdf.generate"] },
      { id: "key_reports", name: "Reporting worker", scopes: ["account.usage", "pdf.generate"] }
    ]
  }, "Harbor Community Pantry", "2026-10-02");

  assert.deepEqual(
    review.keys.map((key) => key.reach.map(({ workflow, allowed }) => ({ workflow, allowed }))),
    [
      [
        { workflow: "Donor receipts", allowed: true },
        { workflow: "Volunteer reminders", allowed: false },
        { workflow: "Campaign reporting", allowed: false }
      ],
      [
        { workflow: "Donor receipts", allowed: true },
        { workflow: "Volunteer reminders", allowed: false },
        { workflow: "Campaign reporting", allowed: true }
      ]
    ]
  );
});

test("accepts the account.keys.list response shape", () => {
  const review = buildAccessReview({
    items: [
      { key_id: "key_live", name: "Live key", status: "active", tier: "standard" }
    ],
    next_cursor: null,
    count: 1
  }, "Harbor Community Pantry", "2026-10-02");

  assert.deepEqual(review.keys, [{
    id: "key_live",
    name: "Live key",
    scopes: [],
    reach: [
      { workflow: "Donor receipts", allowed: false, missingScopes: ["pdf.generate"] },
      { workflow: "Volunteer reminders", allowed: false, missingScopes: ["account.webhooks.deliveries"] },
      { workflow: "Campaign reporting", allowed: false, missingScopes: ["account.usage", "pdf.generate"] }
    ]
  }]);
});
