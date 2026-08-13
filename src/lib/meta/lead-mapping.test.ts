import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import { mapWebsiteLead } from "./lead-mapping.ts";
import { leadgenChanges, shouldProcessEvent, signatureIsValid } from "./webhook-utils.ts";

test("maps Agency website form questions", () => {
  const lead = mapWebsiteLead([
    { name: "What is your full name?", values: ["Ada Lovelace"] },
    { name: "What is your business name?", values: ["Analytical Engines"] },
    { name: "Do you need a new website or a redesign?", values: ["A redesign"] },
    { name: "What budget have you set aside for this project?", values: ["$5,000"] },
  ]);
  assert.equal(lead.name, "Ada Lovelace");
  assert.equal(lead.business_name, "Analytical Engines");
  assert.equal(lead.project_type, "redesign");
  assert.equal(lead.budget_set_aside, "$5,000");
});

test("validates webhook HMAC and rejects tampering", () => {
  const raw = JSON.stringify({ object: "page" });
  const secret = "test-secret";
  const signature = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
  assert.equal(signatureIsValid(raw, signature, secret), true);
  assert.equal(signatureIsValid(`${raw}x`, signature, secret), false);
  assert.equal(signatureIsValid(raw, null, secret), false);
});

test("extracts only leadgen webhook changes", () => {
  const values = leadgenChanges({ entry: [{ changes: [{ field: "feed", value: { id: "ignore" } }, { field: "leadgen", value: { leadgen_id: "123" } }] }] });
  assert.deepEqual(values, [{ leadgen_id: "123" }]);
});

test("processed and duplicate events are idempotent", () => {
  assert.equal(shouldProcessEvent("processed"), false);
  assert.equal(shouldProcessEvent("duplicate"), false);
  assert.equal(shouldProcessEvent("failed"), true);
});
