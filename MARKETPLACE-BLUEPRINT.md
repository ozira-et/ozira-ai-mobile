# OZIRA AI — Marketplace & Monetization Blueprint

The design we agreed on for turning OZIRA from an AI assistant into an
**AI super-app + tourism marketplace for Ethiopia** (and the UAE/diaspora).
This is the product/architecture/legal spec. Build order is at the end.

---

## 1. The core idea

OZIRA is a **meta-marketplace with an AI concierge**. For one destination the
AI compares offers across many suppliers — IATA-accredited agent partners,
Booking.com, MakeMyTrip, direct hotels, and request-to-book sellers — then routes
the booking and the split payment to whichever the client picks. Same
destination, different service and price, compared and booked in chat.

---

## 2. Three money-flow models (do not mix them)

1. **Aggregator / affiliate** — Booking.com, Expedia, MakeMyTrip. *They* collect
   the client's money and pay OZIRA a commission. OZIRA never touches funds.
   Lowest risk, lower margin, fastest international launch.
2. **Direct marketplace (core model)** — local hotels, tours, activities, e-Visa
   assistance, and local agent tickets. **Chapa split payment** captures OZIRA's
   commission instantly; the rest settles to the supplier's Chapa subaccount.
3. **Real-time ticketing** — flights via **IATA-accredited agent partners** who
   already run live ticketing systems. OZIRA adds a flat service fee by MOA.

---

## 3. Architecture — one pattern does all of it

**Adapters + a normalized offer schema.** Every supplier is an adapter behind a
single interface: `search / quote / book / cancel`. The AI only ever sees a
**normalized offer** so it can compare fairly:

```
Offer {
  supplierId, supplierType (flight|hotel|tour|evisa|activity),
  title, destination, priceETB, priceUSD, currency,
  inclusions[], baggage, cancellationPolicy, fareRules,
  rating, fulfilmentTier (api|direct|request), moaId
}
```

Adding a new agent, a new hotel, or MakeMyTrip = register a new adapter. The AI
and the app never change.

**Three fulfilment tiers (by what the supplier can do):**
- **API** — agent partners with live systems, Booking.com, MakeMyTrip. Instant confirm.
- **Direct MOA + Chapa split** — local suppliers that confirm but settle through OZIRA.
- **Request-to-book** — local hotels with no system; the Ethiopia team confirms manually. (Keep this — it's how you get local supply early.)

**Booking lifecycle (shared state machine):**
`request → confirmed → paid → delivered → completed / cancelled / refunded`

---

## 4. Suppliers & how each connects

| Supplier | Connection | Money flow | OZIRA fee |
|---|---|---|---|
| IATA agent partners (flights) | **API** (preferred — lets us amend + list offers on their app and our portal) | Chapa split (local) or MOA settlement | **Flat tiered service fee** per ticket |
| Booking.com / MakeMyTrip (intl hotels + flights) | API + **MOA** | They collect, pay OZIRA commission | Affiliate commission |
| Local hotels with a booking system | Direct **MOA** + API | Chapa split | % commission (2–10%, per MOA) |
| Local hotels without a system | Request-to-book portal | Chapa split on confirm | % commission |
| Tours / activities / e-Visa | Request-to-book | Chapa split | % commission + fixed assist fee |

### Flight service fee (recommended table — flat, not %)
| Route | Economy | Business / First |
|---|---|---|
| Domestic | ~100–150 ETB | ~250–400 ETB |
| International | ~$5–10 | ~$15–30 |

Stored as config; each agent's MOA can override. Rationale: premium and
international travelers tolerate a service fee; domestic must stay tiny to compete.

---

## 5. Monetization (3 streams, not 4 toll-gates)

1. **Booking commission — primary.** Success-based; captured via Chapa split.
   Keep basic business listing **free** to win supply fast.
2. **Business AI tools — the paid upsell, in tokens.** Poster/flyer generation,
   marketing copy, auto-replies, analytics. Businesses pay because it drives
   *their* sales. A choice, not a gate.
3. **Featured / promoted listing — optional monthly fee** for visibility only.

Plus the existing **consumer** side: free tokens on install (acquisition),
subscriptions + token top-ups.

> Deliberately avoided: forcing every business onto a paid AI plan just to list.
> That stacks too many charges and starves the marketplace of supply.

---

## 6. Accounts — Personal vs Business (separate registration)

- **Personal** — consumers. Chat, book, pay, manage trips.
- **Business** — suppliers. Extra KYC, a **partner dashboard** (listings,
  bookings, leads, payouts, analytics), a **Chapa subaccount**, and access to the
  token-based AI business tools. Can post to their marketplace storefront.

Business KYC (also required for Chapa subaccounts): trade licence, TIN,
Telebirr/bank details, owner ID; for agents, IATA accreditation reference.

---

## 7. Two-entity legal structure

- **UAE entity (holding / international)** — holds Stripe + international card
  acquiring (Stripe operates in the UAE), contracts with international suppliers
  (Booking, MakeMyTrip) and international clients.
- **Ethiopia entity (local operating co)** — runs Chapa / Telebirr, contracts
  with local hotels and agents, employs the local onboarding team.
- Linked by an **inter-company services agreement**.

### Legal cautions (confirm with a lawyer — this is not legal advice)
- **Ethiopia forex controls (NBE) are strict.** Design so international money
  settles *at the UAE entity* and local money settles *locally*. Do not rely on
  freely moving ETB out to the UAE.
- **Tourism licensing** — facilitating tour/hotel bookings in Ethiopia may need a
  **tour operator / travel agency licence** (Ministry of Tourism).
- **Airline ticketing** — stays with your **IATA-accredited agent partners**;
  OZIRA is the marketplace/referrer, not the ticket issuer. Keep it that way to
  avoid needing your own IATA accreditation.
- **MOA per supplier** — sets commission, refund terms, KYC, and **liability**.

### Liability stance
**Facilitator + dispute support.** MOAs place fulfilment liability on the
supplier, but OZIRA runs a real dispute/refund process and can **withhold a
supplier's payout** until a dispute is resolved. Never touch client funds
directly — Chapa's split does the routing, so OZIRA stays a facilitator, not a
money transmitter.

---

## 8. Payment providers

- **Local (Ethiopia entity):** Chapa (split payments + subaccounts), Telebirr, CBE.
- **International (UAE entity):** Stripe. (Stripe does **not** support Ethiopian
  payouts — that's exactly why the UAE entity holds this side.)
- **Cross-border alternative to research:** Flutterwave, if needed later.

---

## 9. Refund / commission-timing rule

- **Immediate services** (a ticket, tonight's hotel) → commission captured
  upfront at payment via split.
- **Future-dated big-ticket** (a tour next month) → **hold commission until
  delivered** to limit refund/chargeback exposure.
- A clear, published cancellation policy for both sides; a "service not
  delivered → refund" path is mandatory (protects trust and reduces chargebacks).

---

## 10. Build order (fits "finish the app first")

**Now — finish the app (your #1 priority).** Smart/Fast chat via the shared
engine, the ＋ menu (photo/voice/research), and the parity screens (Teams,
Schedules, Import, Verify).

**Marketplace v1** — extend the existing Travel section:
1. Business vs Personal registration + KYC + partner dashboard.
2. Normalized offer model + the request-to-book tier (works with any supplier).
3. Chapa split payment + subaccounts + commission ledger.
4. Booking lifecycle + dispute/refund flow.

**Marketplace v2** — API adapters: agent-partner ticketing, Booking.com,
MakeMyTrip. Featured listings. Business AI tools (token-metered).

**Ongoing (legal/ops, in parallel):** register the two entities, tourism
licence, sign MOAs, set up Chapa subaccounts, Stripe on the UAE entity.

---

*Not legal or financial advice. Confirm forex, licensing, tax, and
payment-facilitator rules with a qualified Ethiopian/UAE advisor before launch.*
