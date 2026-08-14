import { planOrderError, orderErrorSchema } from "./order_workflow.js";

const checkoutFailure = orderErrorSchema.parse({
  orderId: "order_1042",
  customerId: "learner_88",
  stage: "checkout",
  errorType: "PaymentAuthorizationError",
  message: "Card authorization was declined",
  retryable: false
});

const decision = planOrderError(checkoutFailure);
console.log(JSON.stringify({
  customerOrderStatus: decision.customerOrderStatus,
  fingerprint: decision.capture.fingerprint
}, null, 2));
