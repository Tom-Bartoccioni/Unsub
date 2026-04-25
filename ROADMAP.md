# Unsub — Development Roadmap

> **Purpose:** A trackable, step-by-step plan for building Unsub.
> - **For an AI assistant:** stable task IDs, explicit checkboxes, verifiable *Definition of Done* per phase, and a single Decision Log so past choices aren't re-litigated.
> - **For a human:** phase summaries up front, clear status at a glance, no noise.
> See [PRD.md](PRD.md) for the product spec.

---

## How to use this file

- **Status markers:** `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked
- **Task IDs** are stable (e.g. `P1-T03`) — reference them in commits, branches, and discussions.
- **When resuming work:** read *Current Focus* first, then the active phase.
- **When a task finishes:** flip its checkbox. When all tasks in a phase are done **and** the phase's *Definition of Done* is met, flip the phase header's status.
- **When a non-trivial choice is made** (stack, library, schema trade-off): add a row to the *Decision Log* at the bottom.

---

## Current Focus

- **Active phase:** Phase 1 — Email scan + manual tracker
- **Next task:** `P1-T01` — Register Gmail OAuth app with `gmail.readonly` scope only
- **Last updated:** 2026-04-25

---

## Phase 0 — Foundations `[x]`

**Goal:** A runnable empty app shell with auth, database, and CI. No product features yet.

**Definition of done:** A new user can sign up, log in, and land on an empty dashboard deployed to a staging URL. CI runs lint + typecheck + tests on every push.

**Open decisions** (resolve before coding — see Decision Log):
- `D-01` Frontend framework: React Native vs Flutter
- `D-02` Backend language/framework: Node.js + TypeScript vs Python + FastAPI
- `D-03` Auth provider: Clerk vs Firebase Auth
- `D-04` Postgres host: Supabase vs self-hosted (Railway / Neon / Fly)

**Tasks:**
- `[x]` `P0-T01` Resolve `D-01`–`D-04`; record each in the Decision Log.
- `[x]` `P0-T02` Initialize repo structure (`/app` frontend, `/api` backend, `/packages/shared` types).
- `[x]` `P0-T03` Scaffold frontend with a placeholder `Dashboard` screen and app navigation.
- `[x]` `P0-T04` Scaffold backend with a `/health` endpoint returning `{ status: "ok" }`.
- `[x]` `P0-T05` Provision Postgres; add initial schema (`users`) with Drizzle migrations (`sessions` deferred — Firebase owns session state).
- `[x]` `P0-T06` Integrate chosen auth provider: sign-up, sign-in, sign-out, protected route.
- `[x]` `P0-T07` GitHub Actions CI: lint + typecheck + unit tests on every push.
- `[x]` `P0-T08` Deploy staging environment; staging URL documented in README.

**Staging URLs:**
- API: https://unsub-api.onrender.com (`/health`, `/me`)
- DB: Neon project `unsub`, branch `staging`
- Auth: Firebase project `unsub-dev`

---

## Phase 1 — Email scan + manual tracker `[ ]`

**Goal:** User connects Gmail, sees a list of detected subscriptions, and can edit/add entries manually.

**Definition of done:** A real user connects their Gmail, opens the app, and sees a list of their actual subscriptions (provider, amount, frequency, next renewal) — accurate enough to be useful without editing.

**Tasks:**
- `[ ]` `P1-T01` Register Gmail OAuth app with `gmail.readonly` scope only.
- `[ ]` `P1-T02` Implement OAuth flow on backend; store refresh token encrypted at rest (AES-256).
- `[ ]` `P1-T03` Email fetcher: pull messages matching keyword filter (invoice, subscription, receipt, renewal, confirm your plan).
- `[ ]` `P1-T04` Parser: extract `provider`, `amount`, `currency`, `frequency`, `next_renewal_date` from headers + body (regex + heuristics, LLM fallback optional).
- `[ ]` `P1-T05` `subscriptions` table schema; persist parsed results linked to user.
- `[ ]` `P1-T06` Subscription list UI — grouped by category, sorted by next-charge date.
- `[ ]` `P1-T07` Manual add / edit / delete subscription flow.
- `[ ]` `P1-T08` Dashboard v1: total monthly spend, total yearly spend, subscription count.
- `[ ]` `P1-T09` Outlook OAuth (same flow, second provider).
- `[ ]` `P1-T10` Parser accuracy eval: run on seed inbox of ≥50 real emails; target ≥80% correct extraction.

---

## Phase 2 — Virtual cards (Kill Switch) `[ ]`

**Goal:** User can generate a virtual card per subscription and freeze/close it from the app.

**Definition of done:** User generates a card labeled "Netflix" in the app, uses it on netflix.com as the payment method, sees the charge land in transactions, then taps **Kill Card** and confirms the next Netflix charge attempt is declined at the network.

**Tasks:**
- `[ ]` `P2-T01` Stripe Issuing sandbox account; API keys in `.env` (never committed).
- `[ ]` `P2-T02` KYC / Treasury onboarding — document blockers if not achievable in sandbox.
- `[ ]` `P2-T03` `POST /cards` — create a virtual card tied to a `subscription_id`.
- `[ ]` `P2-T04` Card details screen revealing PAN/CVV/expiry via Stripe-hosted element (no raw PAN touches our backend).
- `[ ]` `P2-T05` Freeze / unfreeze endpoint and UI toggle.
- `[ ]` `P2-T06` Cancel / close (permanent) flow with confirmation dialog.
- `[ ]` `P2-T07` Webhook handler for `issuing.authorization.created` → write transaction row.
- `[ ]` `P2-T08` Per-card transaction history view.
- `[ ]` `P2-T09` Migration-hint UI: "Replace your payment method on {provider} with this card."

---

## Phase 3 — Ghost detection `[ ]`

**Goal:** Detect subscriptions the user isn't actually using and surface them for cancellation.

**Definition of done:** At least one subscription in a real user's account is flagged as a "ghost" with a justifiable reason, and the user can kill it directly from the flag.

**Tasks:**
- `[ ]` `P3-T01` Track interaction signals per subscription: last inbound email from provider, last manual user check-in.
- `[ ]` `P3-T02` Ghost rule v1 (simple): no provider email in 60+ days **and** still charging → flag.
- `[ ]` `P3-T03` Nightly job that re-evaluates ghost status for all subscriptions.
- `[ ]` `P3-T04` Ghost Alert card on dashboard; deep-link into the Kill flow.
- `[ ]` `P3-T05` Push notification: pre-charge alert 48h before next renewal.
- `[ ]` `P3-T06` Push notification: free-trial expiry countdown with one-tap "Kill card before charge".
- `[ ]` `P3-T07` *(stretch)* LLM-scored ghost confidence using full provider email history.

---

## Phase 4 — Browser extension (auto-fill) `[ ]`

**Goal:** At checkout on any merchant site, the user can one-click fill an Unsub virtual card.

**Definition of done:** On a fresh browser, user installs the extension, signs in, visits Netflix's payment-method page, and fills the Netflix-specific Unsub card with one click.

**Tasks:**
- `[ ]` `P4-T01` Extension scaffold — Manifest V3, Chrome + Firefox targets.
- `[ ]` `P4-T02` Auth handshake with main app (shared session cookie or OAuth-to-self).
- `[ ]` `P4-T03` Domain-keyed card picker popup (show cards matching current site).
- `[ ]` `P4-T04` Auto-detect checkout form fields; fill PAN/CVV/expiry/name safely.
- `[ ]` `P4-T05` Inline "Generate new card for {domain}" action from the popup.
- `[ ]` `P4-T06` Submit to Chrome Web Store + Firefox Add-ons; track review status.

---

## Decision Log

Format: `D-XX (YYYY-MM-DD) — decision — reason`

- `D-01 (2026-04-25)` — **Frontend: React Native via Expo (Expo Go in Phase 0; dev-client at Phase 2)** — Solo dev on Windows; EAS handles iOS cloud builds; Expo Router + expo-secure-store remove boilerplate. Dev-client deferred to Phase 2 to avoid an EAS round-trip in early iteration; Stripe Issuing's PCI element may force the move then.
- `D-02 (2026-04-25)` — **Backend: Node.js + TypeScript + Fastify** — Shared TS schemas via `/packages/shared`. Lighter than Nest, cleaner than Express; first-class Zod support via `fastify-type-provider-zod`. PRD §5 lists Node + TS as an option.
- `D-03 (2026-04-25)` — **Auth: Firebase Auth** — Free tier; mature mobile SDK; `firebase-admin` verifies ID tokens trivially server-side. PRD §5 lists Firebase Auth.
- `D-04 (2026-04-25)` — **Postgres: Neon + Drizzle ORM** — Free tier, Git-branch-per-DB-branch (useful for CI/PR previews), scale-to-zero, standard wire protocol. Drizzle is TS-first with no engine binary (no Windows friction). Supabase rejected because it bundles auth we don't need.

---

## Out of scope (for now)

- Native Android / iOS apps (React Native or Flutter covers both).
- Team / family / shared accounts.
- Non-USD / EUR currencies — revisit when expanding.
- Premium "Professional Invoice Management" tier (post-MVP upsell per PRD §7).
