# Recoverpay (Track 01)

**Conversational chat-to-checkout with gated, auditable payments.**

Customer texts a store assistant in plain language ("2kg rice and 1 oil, tomorrow"). The assistant maps that to the live catalog, shows a confirm card with items and total, and only creates a Razorpay order after the customer taps Confirm. Every money-relevant step — message in, intent parsed, cart drafted, checkout confirmed, order created, payment verified — is written to an audit log you can pull up per conversation.

Built for Razorpay's internship Track 01 brief: conversational in-app checkout, every money action explainable/bounded/gated, full audit trail, real failure handling.

---

## Demo

- 5-minute video: `<add link before submitting>`
- Public repo: `https://github.com/prachidighe34/recoverpay`

---

## Architecture

```
Flutter (chat UI)
    │ REST (Dio)   ──►  Node + Express  ──►  MongoDB (catalog, carts, orders, audit_logs)
    │ Socket.io    ──►  same server     ──►  Razorpay (test mode)
```

- **Flutter** — chat screen, order-ticket-style confirm card, audit trail timeline, login/register
- **Node + Express** — REST API + Socket.io for real-time chat
- **MongoDB / Mongoose** — `Product`, `CartDraft`, `Order`, `AuditLog`, `User`, `Conversation`, `Message`
- **Razorpay (test mode)** — order creation + signature-verified payment confirmation
- **Intent parsing** — keyword/quantity matcher against the live catalog (see _Design decision_ below). Output shape is `{ items: [{sku, qty}], notes }` — the same shape an LLM-based parser would produce, so swapping one in later is a drop-in replacement: nothing downstream (cart pricing, hashing, checkout gating, audit logging) needs to change, since all of it only ever consumes that JSON shape, never the raw message.

### Design decision: keyword parser instead of an LLM

The brief allows either, and explicitly notes _"if LLM setup eats time, ship rules-based parser + one LLM explanation sentence — working payments beat a fancy model."_ Time went into the parts that are hard to get right and easy to get wrong: cart-hash gating, idempotency, price/stock re-validation, and audit logging. The parser only ever emits structured JSON against the live catalog — it never talks to the payment layer directly, so the money-safety guarantees below hold regardless of which parser produces the cart.

---

## Security and money guarantees

These are the invariants a reviewer should be able to verify by reading the code, not just trusting the README:

- **All prices and totals are read from MongoDB and calculated server-side.** The client never sends an amount to be charged — it sends a `cart_hash` and an `idempotency_key`; the server computes the amount itself from `CartDraft`/`Product`.
- **A Razorpay order is only created after all of the following hold** (`checkout.service.js`, `confirmCheckout`):
  1. A valid `CartDraft` exists for the given `cartDraftId`.
  2. The cart is not expired (`expires_at`, TTL-indexed).
  3. The supplied `cart_hash` matches the draft's own hash (proves the client is confirming the exact cart it was shown, not a stale or tampered one).
  4. Live `Product` price and stock are re-checked against the cart's snapshot — this closes a gap `cart_hash` alone can't: a merchant changing a price or stock _after_ the cart was drafted but _before_ the customer confirms. A stale-but-internally-consistent cart_hash would otherwise sail through.
- **The same `idempotency_key` can never create two `Order` documents** — enforced by a **unique index** on `Order.idempotency_key` in MongoDB itself, not just application logic. A duplicate confirm returns the _existing_ order instead of erroring or charging again.
- **Every money-relevant event is written to `AuditLog` before the response is sent** — so the trail reflects what actually happened server-side, not what the client claims happened.

This is what makes the "2 AM failure" story below verifiable rather than just asserted — see [Test results](#test-results) for the concurrency test that proves it under an actual race, not sequential calls.

---

## The "2 AM failure" story

A customer double-taps "Pay" because the network is slow. Both taps hit `/checkout/confirm` with the same `idempotency_key` (minted once per cart, client-side — see _Idempotency key generation_ below). The first request creates a Razorpay order and an `Order` document. The second request's `Order.create()` hits the unique index on `idempotency_key` and fails at the database level — not because the app remembered to check, but because MongoDB itself refuses the write. `checkout.service.js` catches that and returns the _existing_ order instead of erroring, so the customer's second tap just shows the same confirmation instead of a second charge.

Verified two ways: `tests/checkout.test.js` proves the DB-level unique-index guarantee directly, and `tests/concurrency.test.js` fires two _genuinely simultaneous_ confirm calls (via `Promise.all`, not sequential awaits) and asserts exactly one `Order` document results.

### Idempotency key generation

The client mints one `idempotency_key` per confirmation _attempt_ on a given cart — stable across retries of the same tap (e.g. if the HTTP request itself times out and the client retries), but replaced with a fresh key if the customer starts over after an expired cart or a `CART_HASH_MISMATCH`. A simple pattern:

```
pay_<conversationId>_<cartHashPrefix>_<attemptNumber>
```

The server treats this key as **opaque** — it never parses or relies on its structure, only its uniqueness.

---

## Audit trail

Every money-relevant event is written to `AuditLog` with a fixed `event` name and a free-form `payload` snapshot. Example:

```json
{
  "event": "razorpay_order_created",
  "payload": {
    "orderId": "66d1f2a4b5c6d7e8f9a0b1c2",
    "razorpay_order_id": "order_test_Nk3x9pQzL2Rw1s",
    "amount_paise": 50500,
    "idempotency_key": "pay_conv123_cart456_attempt1"
  },
  "createdAt": "2026-08-31T03:45:08.000Z"
}
```

Event names: `message_received`, `catalog_listed`, `intent_parsed`, `intent_parse_failed`, `cart_drafted`, `checkout_confirmed`, `razorpay_order_created`, `payment_verified`, `payment_failed`, `duplicate_confirm_blocked`, `cart_expired`, `cart_validation_failed`.

**No secrets or full payment signatures are ever stored in the audit payload** — only IDs, amounts, and hashes, which is enough to trace a conversation end-to-end without the log itself being sensitive.

---

## The hard rules, and where they're enforced

| Rule                                                  | Enforcement                                                                                                                                  |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Parser may only output `{items, notes}`               | `parser.service.js` — invalid/empty match → clarifying question, no cart, no order                                                           |
| Confirm requires the cart shown                       | `cart_hash` computed server-side (`utils/cart-hash.js`, sha256 of items+total) and checked in `checkout.service.js` before any Razorpay call |
| Prices/stock can't go stale between draft and confirm | Live `Product` re-check at confirm time — see _Security and money guarantees_ above                                                          |
| Same `idempotency_key` never creates two orders       | **Unique index on `Order.idempotency_key`** in MongoDB — the actual guarantee, not app logic                                                 |
| Failed/expired checkout never silently retries        | `CartDraft.expires_at` (TTL-indexed, ~15 min) checked before confirm; expired or hash-mismatched carts are rejected with no order created    |
| Every money step is logged                            | `AuditLog`, queryable per conversation via `GET /audit/:conversationId`                                                                      |

### Structured error codes

Checkout failures return a machine-readable `code`, not just a message, so tests and the demo can assert on it directly:

```json
{
  "ok": false,
  "code": "CART_HASH_MISMATCH",
  "error": "The cart you confirmed does not match the latest cart",
  "details": { "provided_hash": "...", "expected_hash": "..." }
}
```

Codes in use: `CART_NOT_FOUND`, `CART_EXPIRED`, `CART_HASH_MISMATCH`, `PRICE_CHANGED`, `OUT_OF_STOCK`, `DUPLICATE_CONFIRM`, `PAYMENT_VERIFICATION_FAILED`, `ORDER_NOT_FOUND`.

---

## API

| Method            | Route                    | Auth     | Purpose                                                                                        |
| ----------------- | ------------------------ | -------- | ---------------------------------------------------------------------------------------------- |
| POST              | `/auth/register`         | —        | Create account (`role: customer \| merchant`)                                                  |
| POST              | `/auth/login`            | —        | Get JWT                                                                                        |
| POST              | `/conversations`         | customer | Start a new chat session                                                                       |
| GET               | `/catalog`               | —        | List products                                                                                  |
| POST/PATCH/DELETE | `/catalog`               | merchant | Manage products                                                                                |
| POST              | `/agent/turn`            | —        | Message in → catalog listing, clarification, or priced cart draft. **Never charges anything.** |
| POST              | `/checkout/confirm`      | customer | Cart-hash + idempotency + price/stock gated → creates Razorpay test order                      |
| POST              | `/checkout/verify`       | customer | Signature-verified → marks order paid                                                          |
| GET               | `/audit/:conversationId` | —        | Full event trail for a conversation                                                            |

Chat also runs over Socket.io (`newChat` in → `loadNewChat` out) for the live app; REST `/agent/turn` is a fallback with identical logic.

### Payment verification: client-side today, webhook-ready design

`/checkout/verify` currently verifies the signature Razorpay's client SDK returns after checkout — this is fully functional and correctly rejects tampered signatures, but it means confirmation depends on the client completing the round-trip rather than an independent server-to-server source of truth. A production version would add:

```
POST /webhooks/razorpay
```

verifying the `X-Razorpay-Signature` header against the raw request body, updating order status on `payment.captured`/`order.paid`, and logging a `payment_verified_webhook` audit event — with the webhook treated as authoritative and client-side verification kept only for fast UI feedback. This is intentionally out of scope for this MVP: it requires a publicly reachable URL (a tunneling service like ngrok would work for a demo, a real deployment for production), and the client-side path already proves the core signature-verification and money-gating logic works correctly.

---

## Test results

20 scripted conversations run against the live backend (`backend/scripts/run-test-conversations.js`) — real Mongo writes, real Razorpay test-mode orders, real HMAC-signed payment verification (computed with the same algorithm Razorpay uses, via the test key secret). **These are synthetic test conversations run against a seeded catalog, not real customer traffic.**

```
Total conversations run: 20
  Paid:                        14
  Abandoned (no purchase):     3
    - cart drafted, no confirm:  1
    - message not understood:    2
  Started checkout, unpaid:    2
  Catalog browse only:         1
Duplicate-confirm guard tested: YES — 0 double charges confirmed
```

Automated tests (`backend/tests/`, run with `node --test tests/`):

| File                         | Proves                                                                                                                                  |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `idempotency.test.js`        | Cart-hash is deterministic, order-independent, and changes if items/total are tampered with                                             |
| `agent.test.js`              | Keyword parser correctly matches items/quantities against the catalog                                                                   |
| `checkout.test.js`           | MongoDB's unique index rejects a duplicate `idempotency_key` at the DB level                                                            |
| `concurrency.test.js`        | Two **genuinely simultaneous** confirm calls (`Promise.all`) with the same key produce exactly one `Order`                              |
| `cart-validation.test.js`    | A price or stock change between draft and confirm is caught and rejected (`PRICE_CHANGED` / `OUT_OF_STOCK`), no order created           |
| `audit-completeness.test.js` | A full paid conversation has every expected audit event in order; a blocked duplicate leaves exactly one `razorpay_order_created` event |

**15/15 tests passing.**

### Re-running the test data

```bash
cd backend
node src/seed/seed.js                    # 12 products, safe to re-run (upserts by sku)
node scripts/run-test-conversations.js   # 20 conversations, prints the summary above
node --test tests/                       # all automated tests
```

---

## Project structure

```
recoverpay/
├── backend/
│   ├── src/
│   │   ├── config/        # env, db, razorpay
|   |   ├── controllers/   # agent, audit, auth, catalog, checkout, conversation
│   │   ├── models/        # User, Product, Conversation, Message, CartDraft, Order, AuditLog
│   │   ├── routes/        # agent, audit, auth, catalog, checkout, conversation
│   │   ├── middleware/    # auth, role, idempotency, error handling
│   │   ├── sockets/       # assistant
│   │   ├── utils/         # cart-hash, error, money
│   │   └── seed/          # catalog seed data
|   |   ├──services/       # audit, cart, catalog, checkout, parser, razorpay
│   ├── scripts/           # test-order smoke test, 20-conversation test run
│   └── tests/             # node:test unit + integration tests
└── frontend/
    └── lib/
        ├── core/           # theme, routing, API/socket clients, shared widgets
        └── features/
            ├── auth/       # login, register
            ├── chat/       # chat screen, cart card, controller
            └── audit/      # audit trail screen
```

---

## Running it locally

**Backend**

```bash
cd backend
cp .env.example .env   # fill in MongoDB URI, JWT secret, Razorpay test keys
npm install
node src/seed/seed.js
npm run dev
```

**Frontend**

```bash
cd mobile
flutter pub get
flutter run
```

Update `lib/core/config/env.dart` with your backend's reachable address (`10.0.2.2` for Android emulator, your machine's LAN IP for a physical device) and your Razorpay test key ID.

**Docker** (Mongo + backend together)

```bash
docker compose up -d
```

---

## Known limitations

- Intent parsing is keyword-based, not LLM-based (see _Design decision_ above) — handles clear item+quantity phrasing well, less robust on very messy or heavily colloquial input.
- Razorpay webhook verification isn't wired up — see _Payment verification_ above for why and what a production version would add.
- No merchant-facing UI for catalog management yet — merchant catalog CRUD exists as backend API only (`POST/PATCH/DELETE /catalog`, role-gated).
- Product browsing is chat-only by design (matches the brief's differentiator); customers can ask "what do you have?" for a full listing.
- Test metrics above are from synthetic scripted conversations against a seeded catalog, not real customer traffic.

---

## Future work

- LLM-based intent parser, with automatic fallback to the keyword matcher on invalid/empty output — the `{items, notes}` contract means this is a drop-in swap, not a rewrite.
- Merchant dashboard for catalog and order management (the backend API already exists; no UI yet).
- Webhook-based payment confirmation as the authoritative source of truth, plus refund handling.
