# Unsub — Product Requirements Document

## 1. Project Overview

- **Project Name:** Unsub
- **Tagline:** Kill your subscription ghosts before they haunt your wallet.
- **Core Concept:** A fintech-driven subscription management app that uses virtual cards to give users one-click control (a "Kill Switch") over their recurring expenses.

---

## 2. Problem Statement

Users suffer from *subscription fatigue* and the *lazy tax* — paying for services they no longer use. The root causes:

- They **forget** they are subscribed.
- Providers **intentionally obstruct** cancellation (dark patterns).
- They **fear exposing** their primary bank details to multiple platforms.

---

## 3. Target Audience

| Segment | Profile |
|---|---|
| **Digital Natives** | Gen Z and Millennials with 5+ digital subscriptions. |
| **Freelancers / Solopreneurs** | Managing professional SaaS alongside personal expenses. |
| **Privacy-conscious Users** | People who want to limit exposure of their main credit card. |

---

## 4. Key Features (MVP Scope)

### A. Automated Discovery (Email Scan)
- **Integration:** Secure OAuth connection to Gmail / Outlook.
- **Logic:** Read-only inbox scan for keywords such as *Invoice*, *Subscription*, *Receipt*, *Confirm your plan*.
- **Data Extraction:** Identify provider, amount, frequency, and renewal date.

### B. Virtual Card Issuing — The "Kill Switch"
- **Integration:** Stripe Issuing API (alternatives: Marqeta, Swan).
- **Functionality:** Generate a unique virtual card per subscription (e.g., one for Netflix, one for Adobe).
- **Kill Switch:** In-app toggle to **Freeze** or **Close** a card instantly — physically blocking the merchant from charging again.

### C. Dashboard & Analytics
- **Visuals:** Total monthly and yearly spend.
- **Categorization:** Entertainment, Productivity, Health, etc.
- **Ghost Alerts:** Notify users when a recurring charge is detected on a service they haven't interacted with (based on email activity or manual check-ins).

### D. Smart Notifications
- **Pre-charge Alerts:** Notification 48h before a card is debited.
- **Trial Expiry:** Countdown for free trials with an automatic prompt to kill the card before the first charge.

---

## 5. Technical Stack (Recommended)

| Layer | Choice |
|---|---|
| **Frontend** | React Native or Flutter (mobile-first — push notifications are critical). |
| **Backend** | Node.js (TypeScript) or Python (FastAPI). |
| **Database** | PostgreSQL (via Supabase or Prisma) for transaction logs and user data. |
| **Fintech Layer** | Stripe Issuing for card creation; Stripe Treasury for balance management. |
| **Auth** | Clerk or Firebase Auth (Social Login + 2FA). |

---

## 6. User Flow

1. **Onboarding** — User signs up and connects their email.
2. **Detection** — The app lists the subscriptions it found.
3. **Migration** — The app guides the user to replace their payment method on Netflix/Spotify/etc. with a newly generated Unsub virtual card.
4. **Monitoring** — User sees all spend in one place.
5. **Termination** — To cancel, the user hits **Kill Card** in Unsub. The merchant's next charge is declined at the network level.

---

## 7. Business Model (Interchange)

- **User Cost:** $0 — free to use.
- **Revenue:** The app earns a percentage of the interchange fee (paid by the merchant/bank) each time an Unsub card is charged.
- **Upsell (Optional):** Premium tier offering *Professional Invoice Management* for freelancers.

---

## 8. Security & Compliance

- **Data Privacy:** AES-256 encryption for any stored sensitive data.
- **PCI DSS:** Compliance ensured by using Stripe's hosted elements for card data.
- **Permissions:** OAuth scopes restricted to **read-only** for email scanning.

---

## 9. Roadmap

| Phase | Scope |
|---|---|
| **Phase 1** | Email scan algorithm + manual subscription tracker. |
| **Phase 2** | Stripe Issuing integration (virtual card generation). |
| **Phase 3** | Automated "Ghost" detection (AI-driven usage analysis). |
| **Phase 4** | Browser extension to auto-fill Unsub cards during checkout. |
