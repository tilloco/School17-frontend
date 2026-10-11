# LAWYER_QUESTIONS

Everything below is **NEEDS LAWYER**. Nothing in this repo is legal advice; texts in `backend/src/marketplace/legal/texts.ts` are drafts. Links are starting points to verify, not conclusions.

## 1. Personal data (Uzbekistan)
1. Which law governs us: Law "On Personal Data" (ZRU-547, 2019) as amended? Registration of databases / notification of the regulator? Official text: https://lex.uz (search "О персональных данных"). **VERIFY current version.**
2. **Data localisation:** must personal data of Uzbek citizens be stored on servers physically in Uzbekistan? Does this cover the database, uploaded files, video relay, backups, email/push providers, analytics? Consequences for choosing LiveKit Cloud vs self-hosting (docs/CALLS.md), cloud object storage, and email providers.
3. Cross-border transfer rules and consent wording; do we need a representative or local entity?
4. Legal bases per purpose (consent vs contract vs legitimate interest) for each row of DATA_INVENTORY.md; retention periods for ledger, reports, audit logs, consent records, call-attendance data.
5. Data-subject rights (access, correction, deletion, objection): deadlines, format of export, identity verification for requests. Is our JSON export + anonymising delete sufficient?
6. Breach notification duties and deadlines.

## 2. Minors
7. Minimum age to hold an account (we use 13) and the age of majority for consent/contract (18). Can a 13-17 year old use a tutoring service with parental consent only?
8. How must guardianship/parental consent be verified? Our flow (child shows a code, adult enters it, adult ticks a statement) proves nothing. What is the minimum acceptable check?
9. Is the guardian's read-only access to the minor's chats lawful and proportionate? Should the minor be told (we show guardian names)? Should guardians also be able to observe lessons (we do not allow it)?
10. Our chat rule rejecting phone numbers/emails/links with minors - any legal issue (monitoring, free expression, data processing of message content)?
11. Duty to report abuse / child-safety obligations, teacher background checks (criminal record certificates), licensing to teach minors.
12. Advertising/marketing to minors (we send none).

## 3. Recording and video
13. Is recording lessons allowed at all? Consent requirements; our policy (never with a minor, both consents otherwise). Storage/retention, who may access.
14. Retention of call metadata (join/leave times, quality stats).

## 4. Payments and money
15. Which entity may collect payments for teachers (marketplace as agent vs principal)? Licences for holding client money (24 h hold + escrow) and for payouts to individuals. Is a nominal/escrow bank account required?
16. Teachers: employment status, tax registration (self-employed), who issues fiscal receipts, VAT, withholding. Platform commission taxation.
17. Which processors can we legally use (Payme, Click, Uzum, Paynet, Stripe not available - see PAYMENTS_GAPS.md)? Currency-control rules for foreign cards/payouts.
18. Consumer protection: cancellation/refund defaults (12 h free cancel, 0 % late refund, 90 % full-pay rule, 24 h dispute window), mandatory disclosures before purchase.
19. Payments by/for minors: who may pay, card ownership.

## 5. Platform duties and terms
20. Terms of Use / Privacy Policy: governing law, dispute resolution, liability limits, language requirements (Uzbek mandatory?), how to obtain valid consent in-app.
21. Liability for teacher content and conduct; notice-and-takedown; moderation duties; user-generated-content rules.
22. Verification of teachers ("Verified" badge): what exactly do we promise? Wording that avoids misleading claims.
23. Reviews: rules on fake/defamatory reviews, teacher right of reply, removal procedure.
24. Security statements: confirm we may say "connections use HTTPS" but must not say "secure"/"encrypted" beyond what is tested (current policy text avoids claims).

## 6. Stores
25. Apple/Google rules for tutoring payments outside IAP and for user-generated content (see STORE_CHECKLIST.md). Child-directed app policies (Apple Kids category / Google Families) if pupils under 13... (we exclude under 13).

## 7. Free model, direct payments (added with A1) - NEEDS LAWYER
26. Liability wording when pupils pay teachers directly by card transfer: what must the terms say so School17 is not treated as a payment intermediary or seller? Is "the app cannot check, protect, recover or return any payment" enough?
27. Showing a teacher's card number (and holder name) to pupils who booked: lawfulness, consent of the teacher, security expectations, what we may log. Whether a card number counts as sensitive personal/financial data under the personal-data law.
28. Personal-data law (Uzbekistan): processing of the teacher's card details and of "paid / not received" records; retention; export/deletion; localisation.
29. Teacher income tax / self-employment registration: the app gives NO tax advice; what disclaimer is required, and must the platform report teacher income to tax authorities?
30. Disputes about unpaid or unreceived transfers: may moderators see receipts uploaded by pupils; what to tell users when we cannot help recover money.
