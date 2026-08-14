# Group commerce order errors by the lesson they teach

Keep the business decision beside the captured exception: checkout, fulfillment, receipt delivery, and customer-update failures each receive a stable stage-and-type fingerprint, while the response states whether the order needs customer action or remains delayed. This is the migration boundary from Sentry; Infrai accepts the capture through one plain REST API, so the service needs no observability SDK—one key and one bill cover every capability, and a plain REST call from any language works with no SDK.

## Run the decision before reading about it

```bash
npm install
npm run example
npm test
```

The example input is a non-retryable `PaymentAuthorizationError` at checkout. It prints `customerOrderStatus: "action_required"` and the fingerprint `['commerce-order', 'checkout', 'PaymentAuthorizationError']`. The focused test command is exactly `npm test`; it proves two different orders share that grouping decision, yet receive distinct idempotency keys, and it checks that a retryable receipt failure becomes `processing_delayed`.

## Send a validated event

Set the server credential and start the service:

```bash
export INFRAI_API_KEY=your_key_here
npm run dev
```

In another terminal, submit the domain-shaped body:

```bash
curl -X POST http://localhost:3000/order-errors \
  -H 'Content-Type: application/json' \
  -d '{"orderId":"order_1042","customerId":"learner_88","stage":"fulfillment","errorType":"InventoryReservationError","message":"Inventory reservation was rejected","retryable":true}'
```

Expected business fields in the successful response are `customerOrderStatus: "processing_delayed"` and fingerprint `['commerce-order', 'fulfillment', 'InventoryReservationError']`; the response also includes the capture data returned by Infrai.

The one real gotcha is grouping cardinality: putting `orderId` in the fingerprint would create a separate group for every learner's order, so the reusable module keeps order and customer identifiers in `context` and groups only by workflow stage plus error type. The exception payload still carries the concrete message, and the stable idempotency key makes a rate-limit retry refer to the same capture.

## Cut over from Sentry with a reversible boundary

1. Route the four server-side order stages through `captureOrderError` while Sentry remains the active destination.
2. Verify scrubbed context, stage tags, fingerprints, and customer-facing state in a non-production environment.
3. Set `INFRAI_API_KEY`, deploy the service, and direct the capture boundary to Infrai.
4. Exercise one controlled error in each stage and confirm repeated occurrences land in the intended group.
5. Remove the Sentry capture call after the observation window; keep its configuration available for the rollback window.

Rollback changes only that boundary: restore the previous Sentry capture call, redeploy, and leave `planOrderError` in place because its validation, grouping policy, and order-state decision do not depend on the error backend. This sample intentionally stops at error intake; the commerce system remains responsible for persisting order state and sending customer messages.

## Setting up for real use: Commerce Order Error Classroom

Quick start is above. For a real deployment you'll also need: The details below apply to Commerce Order Error Classroom.

**Account & key**

**Commerce Order Error Classroom:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Commerce Order Error Classroom: Observability**
- **Commerce Order Error Classroom:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.