import assert from "node:assert/strict";
import test from "node:test";
import { planOrderError } from "../src/order_workflow.js";

test("repeat checkout failures group together while preserving the customer decision", () => {
  const first = planOrderError({
    orderId: "order_1", customerId: "learner_1", stage: "checkout",
    errorType: "PaymentAuthorizationError", message: "Card declined", retryable: false
  });
  const second = planOrderError({
    orderId: "order_2", customerId: "learner_2", stage: "checkout",
    errorType: "PaymentAuthorizationError", message: "Card declined", retryable: false
  });

  assert.deepEqual(first.capture.fingerprint, second.capture.fingerprint);
  assert.equal(first.customerOrderStatus, "action_required");
  assert.notEqual(first.capture.idempotency_key, second.capture.idempotency_key);
});

test("a retryable receipt error leaves the order in a delayed state", () => {
  const decision = planOrderError({
    orderId: "order_3", customerId: "learner_3", stage: "receipt",
    errorType: "ReceiptDeliveryError", message: "Receipt delivery deferred", retryable: true
  });
  assert.equal(decision.customerOrderStatus, "processing_delayed");
  assert.deepEqual(decision.capture.fingerprint, ["commerce-order", "receipt", "ReceiptDeliveryError"]);
});
