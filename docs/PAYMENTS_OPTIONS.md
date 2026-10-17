# Payments: options and a recommendation (decision needed from the owner)

Status: nothing here is built yet. Prices, API names and legal points below are NOT verified; they must be checked with the providers and a lawyer (NEEDS LAWYER).

## What the app does today
- School17 never touches money. The pupil pays the teacher directly (card transfer) and the app only keeps marks: "pupil marked paid" and "teacher confirmed received".
- The teacher's card number is shown to the pupil only after a lesson is accepted, never in the public profile.

## The problems you named
1. Showing a ready card number lets a scammer pose as a teacher and collect money.
2. The teacher has to check receipts by hand (or an assistant does).
3. Teachers should not need a sole-proprietor registration (YTT) or a Click merchant account.

## Options
| # | Option | Automatic? | Teacher needs YTT/merchant? | Main catch |
|---|---|---|---|---|
| A | Keep direct card transfer, make it safer | No (teacher taps "received") | No | Manual confirmation stays |
| B | School17 is the merchant (Click / Payme / Uzum Merchant API), then pays teachers out | Yes (provider callbacks confirm payment) | No | School17 would hold money for a moment: needs a legal entity, a provider contract, tax and payout rules; contradicts the current "free, never holds money" model. NEEDS LAWYER |
| C | Each teacher connects their own merchant | Yes | Yes | Exactly what you want to avoid |
| D | Read the teacher's incoming bank SMS on their phone and match amount + a unique code | Mostly | No | Android only, SMS permission is restricted by Google Play, easy to fake text. Not recommended |
| E | Read the receipt photo with OCR | Partly | No | Receipts can be forged. Not recommended |

## Recommendation
1. Now (no new accounts, no cost): option A, made safer. Show the card only after the lesson is accepted, masked with a "copy" button; show the verified teacher's name next to it; add a one-tap "this looks like a scam" report; keep "pay after the lesson" as the default.
2. Decision for you: option B is the only way to get fully automatic payment without teacher merchant accounts. It needs: a company (or partner) that can sign a merchant contract, test credentials from Click or Payme, a lawyer's view on holding funds and payouts, and a decision on commission (today: none).
3. When those exist, I add a payment-provider adapter (like the existing LiveKit and push adapters), test it against the provider's sandbox, and switch the pupil flow to "Pay in the app" with an automatic "paid" status.

## What I need from you
- Do you want to stay free and peer-to-peer (A), or become the merchant (B)?
- If B: which provider (Click, Payme, Uzum), and who signs the contract?

## Click / Payme buttons (built, not verified on a phone)
- The pupil's payment screen has "Click" and "Payme" buttons. Tapping one copies the teacher's card number to the clipboard (the number is never shown), shows only the last 4 digits and the exact amount to type, and opens click.uz / payme.uz (which open the installed app if it handles those links, otherwise the website).
- I searched for an official way to open Click or Payme with the card number and the amount already filled in (a deep link) and found none. Because of that, the pupil still pastes the number and types the amount in the other app. A real pre-filled payment needs the merchant route (option B above).
- The Play Store package names of the two apps could not be verified, so the buttons use their web addresses instead of package names.
