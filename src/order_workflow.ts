import { createHash } from "node:crypto";
import { z } from "zod";
import { infrai, type CapturePayload } from "./infrai_errors.js";

export const orderErrorSchema = z.object({
  orderId: z.string().min(1),
  customerId: z.string().min(1),
  stage: z.enum(["checkout", "fulfillment", "receipt", "customer_update"]),
  errorType: z.string().min(1),
  message: z.string().min(1),
  retryable: z.boolean()
}).strict();

export type OrderError = z.infer<typeof orderErrorSchema>;

export function planOrderError(input: OrderError): {
  customerOrderStatus: "action_required" | "processing_delayed";
  capture: CapturePayload;
} {
  const fingerprint = ["commerce-order", input.stage, input.errorType];
  const idempotencyKey = createHash("sha256")
    .update([input.orderId, input.stage, input.errorType, input.message].join(":"))
    .digest("hex");

  return {
    customerOrderStatus: input.retryable ? "processing_delayed" : "action_required",
    capture: {
      title: `${input.stage} failed for order ${input.orderId}`,
      message: input.message,
      exception: { type: input.errorType, value: input.message },
      level: "error",
      tags: { stage: input.stage, retryable: String(input.retryable) },
      fingerprint,
      context: {
        order_id: input.orderId,
        customer_id: input.customerId,
        customer_order_status: input.retryable ? "processing_delayed" : "action_required"
      },
      service: "commerce-orders",
      idempotency_key: idempotencyKey
    }
  };
}

export async function captureOrderError(input: OrderError) {
  const decision = planOrderError(input);
  const captured = await infrai.errors.capture(decision.capture);
  return { customerOrderStatus: decision.customerOrderStatus, fingerprint: decision.capture.fingerprint, captured };
}
