> **DORMANT (A1):** School17 is free. This file describes the dormant S8 escrow code, which only runs with `ESCROW_ENABLED=true` and only against a mock provider. See DECISIONS.md #60.

# PAYMENTS_GAPS (S8)

Status: **everything money-related runs on `MockPaymentProvider`. No real money moves. Nothing here is production-ready for real payments.**

## What exists (tested against a throwaway local PostgreSQL)
- Integer minor units only (tiyin, 1 so'm = 100 tiyin), BigInt in the ledger, safe-integer checks, property tests for rounding.
- Append-only double-entry ledger (DB trigger blocks UPDATE/DELETE; every transaction sums to zero; internal accounts cannot go negative; idempotent posting keys).
- Flow: pay -> ESCROW; lesson completed -> teacher PENDING (24 h hold, env `PAYMENT_HOLD_HOURS`) -> release: platform commission (default 15 %, `PLATFORM_COMMISSION_BPS`, snapshotted per payment) + teacher AVAILABLE -> payout request -> admin pays/rejects.
- Refund rules: teacher cancel / early student cancel / declined / expired / teacher no-show = 100 %; late student cancel = `BOOKING_LATE_CANCEL_REFUND_BPS` (default 0 %); student no-show = teacher paid; shorter lessons paid proportionally (>= 90 % of scheduled time counts as full).
- Disputes (payer, during the hold) and technical-failure lessons wait for an admin decision (refund / partial refund / release).
- Idempotency keys (`Idempotency-Key` header) on pay and payout; concurrent duplicates are safe.
- Card numbers are refused by the API (only provider tokens / masked labels like "Humo ****1234").
- With the mock provider in `NODE_ENV=production`, payment routes return 503 `PAYMENTS_NOT_CONFIGURED`.

## What does NOT exist
- **No real payment processor.** Click and Payme appear in the old exam-premium code (`backend/src/payments`) for subscriptions; they are NOT wired to lesson payments and are untouched.
- No provider webhooks for lessons, no 3-D Secure / redirect flows, no reconciliation job (ledger vs. provider statements), no provider-refund retry queue (a failed provider refund is logged only), no currency other than UZS, no tax/VAT/receipt generation (fiscal receipts: **NEEDS LAWYER**), no payout KYC/AML.
- Payout destination is a free-text label (max 40 chars) chosen by the teacher. A real payout needs a verified bank account/card token from the processor.
- Coupons, subscriptions, packages of lessons, multi-currency, platform wallet top-ups: not built.

## Why Stripe is not used (VERIFY)
- Third-party sources (Zenind May 2026, OSOME, sayt.uz, Shopify community) say Stripe does not support businesses registered in Uzbekistan; common workarounds are a company in a supported country (e.g. US/UK). I could not open Stripe's own country list, so **VERIFY** at https://stripe.com/global. Using a foreign shell company to serve Uzbek users has tax, currency-control and licensing implications: **NEEDS LAWYER**.
- Local processors (Payme, Click, Uzum, Paynet, etc.) generally need a registered business (YaTT/OOO) and a merchant contract. I found no official onboarding requirements in my search: **VERIFY with each processor**. Whether they can split payments / pay out to individual teachers (marketplace model) or only settle to one merchant account is **unknown: VERIFY** and drives the legal structure.
- Marketplace money flows may count as payment-service activity or require the platform to hold client funds in a specific way (nominal/escrow accounts, Central Bank of Uzbekistan licensing): **NEEDS LAWYER**.

## Apple / Google store rules (VERIFY, see STORE_CHECKLIST.md)
- Apple App Review Guideline 3.1.3(d) (person-to-person services) reportedly lets apps take payment outside In-App Purchase for **real-time one-to-one** services such as tutoring, while one-to-few/one-to-many must use IAP. Reviewers have reportedly rejected non-real-time expert services. Our product is 1:1 live video (fits) but chat-only or recorded content would not. Re-read the current guideline text and ask App Review before launch: https://developer.apple.com/app-store/review/guidelines/ (secondary sources: Apple developer forum threads 723322 and 730033, Gummicube Feb-2021 summary).
- Google Play: payments policy for physical-world/person-to-person services: **VERIFY**.

## Product/legal questions that change the code
1. Who is the merchant of record and who issues receipts (platform or teacher)? Does the platform act as agent or principal?
2. Is holding funds for 24 h + escrow allowed for our entity type? Are teachers "individuals" (self-employed) needing registration?
3. Consumer-protection rules for cancellations/refunds and the late-cancel default (0 % refund) - **NEEDS LAWYER**.
4. Payments for minors: who may pay (guardian only?), card ownership.
5. Data/currency control rules for foreign cards.
