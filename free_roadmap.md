# Unsub — Free Tier Roadmap

> **Pivot context:** the original PRD assumed mail scraping + virtual cards as the core MVP. After dogfooding, two issues were forcing factors:
>
> - **Mail scraper accuracy is gated on inbox volume** — testing accounts have too few subs to drive real precision/recall work.
> - **Virtual cards (Stripe Issuing) require KYC/Treasury** — heavy, and gated on legal/business setup.
>
> This file refocuses delivery on a **free tier** that works without either: manual subscription tracking + cost rollups + pre-charge notifications. The mail/bank scrapers and virtual cards become **premium** features, deferred behind a paywall once free works.
>
> Original full roadmap: [ROADMAP.md](ROADMAP.md). It stays as historical context — Phase 0 + Phase 1 work shipped from it is **kept** and forms the substrate this free tier sits on top of.

---

## Free vs premium scope

| Feature                                       | Free                 | Premium                     |
| --------------------------------------------- | -------------------- | --------------------------- |
| Sign-up / sign-in (Firebase)                  | ✓ (already shipped)  | ✓                           |
| Manual add / edit / delete subscription       | ✓ (already shipped)  | ✓                           |
| Combined cost (monthly + yearly per currency) | ✓ (already shipped)  | ✓                           |
| Mark as trial / cancelled                     | ✓ (already shipped)  | ✓                           |
| In-app "Charges this week" banner             | ✓ (already shipped)  | ✓                           |
| **Pre-charge native push notification**       | **✓ (this roadmap)** | ✓                           |
| Gmail / Outlook scanning                      | —                    | ✓ (already shipped, hidden) |
| Bank account scanning                         | —                    | future                      |
| Virtual cards / Kill Switch                   | —                    | future (PRD Phase 2)        |
| Ghost detection                               | —                    | future (PRD Phase 3)        |
| Browser auto-fill extension                   | —                    | future (PRD Phase 4)        |

---

## How to use this file

Same conventions as [ROADMAP.md](ROADMAP.md): `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked. Task IDs use the `F<phase>-T<n>` prefix (F = free).

---

## Current Focus

- **Active phase:** Phase F1 — Manual tracker polish (F0 done)
- **Next task:** `F1-T01` — "Mark as cancelled" button in the inline edit form
- **Last updated:** 2026-04-26

---

## Phase F0 — UI rollback `[x]`

**Goal:** the dashboard shows only the manual flow. Mail-scraping backend stays wired (option a from the pivot discussion) but is no longer reachable from the UI.

**Definition of done:** the dashboard has no "Connect Gmail" / "Scan inbox" buttons, no scan-error banner, no Google-OAuth-related state. Backend `/auth/google/*` and `/scan/run` routes still exist (so Phase 1 commits stay clean and tests still pass), but no frontend code references them.

**Tasks:**

- `[x]` `F0-T01` Remove the "Connect your inbox" card from `app/app/(app)/dashboard.tsx` (Connect Gmail + Scan inbox + reconnect-error UI).
- `[x]` `F0-T02` Drop now-unused dashboard state: `connecting`, `connectError`, `scanError`, `scanSummary`, `scanning`, `scanNeedsReconnect`, `onScan`, `onConnectGmail`, `Linking` import, `ConnectStartResponse` and `ScanResponse` types, ten orphan styles.
- `[x]` `F0-T03` Update README — `Status` section now points to `free_roadmap.md`; calls out that mail scraping is UI-gated for future premium.
- `[x]` `F0-T04` (Done at the same time as creating `free_roadmap.md`.) ROADMAP.md `Current Focus` cross-links to the new file.

---

## Phase F1 — Manual tracker polish `[ ]`

**Goal:** the manual flow feels finished, not bare-bones.

**Definition of done:** the user can mark a subscription as cancelled directly (no delete-and-readd dance); deleting a subscription requires confirmation; the empty state is welcoming, not blank.

**Tasks:**

- `[ ]` `F1-T01` Add a "Mark as cancelled" button to the inline edit form (toggles `status` between `active` ↔ `cancelled`). Backend already supports it (PATCH `/subscriptions/:id`).
- `[ ]` `F1-T02` Confirm-before-delete on the ✕ button (a small inline confirm rather than a modal — modal-free RN web is simpler).
- `[ ]` `F1-T03` Empty-state polish: when `subs.length === 0`, open the AddSubscriptionForm by default with a friendly hint above it ("Track your first subscription").
- `[ ]` `F1-T04` Currency / amount formatting via `Intl.NumberFormat`: `€17.99` instead of `17.99 EUR`. Locale-aware (browser default).
- `[ ]` `F1-T05` Persist the `showCancelled` toggle in `expo-secure-store` so it survives reloads.

---

## Phase F2 — Enhanced in-app banner `[ ]`

**Goal:** when a sub renews in <24h, the user notices it the moment they open the app.

**Definition of done:** if any active or trial sub renews within 24 hours, a dismissible top-of-page banner appears in addition to the "Charges this week" card. Banner persists dismissal in local storage so it doesn't reappear that day.

**Tasks:**

- `[ ]` `F2-T01` Compute imminent-renewal candidates (≤24h, status active/trial) on dashboard mount.
- `[ ]` `F2-T02` Render a colored banner above the page header listing them ("ChatGPT Plus charges in 12 hours · $20.00").
- `[ ]` `F2-T03` Dismiss button stores `{date, ids}` in `expo-secure-store`; same set on the same day stays hidden.
- `[ ]` `F2-T04` Click the banner → scrolls to the corresponding subscription card (highlight pulse).

---

## Phase F3 — Native push (Expo) + daily cron `[ ]`

**Goal:** even when the app is closed, the user gets a push 24h before a subscription renews.

**Definition of done:** running the daily cron sends a single Expo push notification per upcoming charge to each opted-in user's registered devices; the user can toggle notifications off and on; duplicate sends are prevented across cron runs.

**Tasks:**

- `[ ]` `F3-T01` Drizzle schema: `notification_prefs` (user_id, push_enabled bool, hours_before int default 24, updated_at).
- `[ ]` `F3-T02` Drizzle schema: `device_push_tokens` (id, user_id FK, expo_push_token unique, platform, last_seen_at).
- `[ ]` `F3-T03` Drizzle schema: `notification_log` (subscription_id + scheduled_for unique — prevents duplicate sends across cron runs).
- `[ ]` `F3-T04` `lib/expo-push.ts` — wrapper around `https://exp.host/--/api/v2/push/send`, batched (≤100 tokens per request).
- `[ ]` `F3-T05` Backend: `POST /devices/register` (auth-gated) accepts `{ token, platform }`, upserts.
- `[ ]` `F3-T06` Backend: `GET /notification-prefs` and `PATCH /notification-prefs` — auth-gated.
- `[ ]` `F3-T07` Backend: `POST /notify/run` — guarded by `X-Cron-Secret` header equal to `CRON_SECRET` env var. Finds active+trial subs renewing in the next `hours_before` window, looks up registered tokens, sends pushes, writes to `notification_log`.
- `[ ]` `F3-T08` Frontend: install `expo-notifications`. After sign-in, request permission, get an Expo push token via `getExpoPushTokenAsync`, POST to `/devices/register`.
- `[ ]` `F3-T09` Frontend: a small "Notifications" section on the dashboard with a toggle (push on/off) wired to `PATCH /notification-prefs`.
- `[ ]` `F3-T10` `.github/workflows/notify-cron.yml` — runs daily at 09:00 UTC, hits `/notify/run` with the cron secret. Secret stored as a GitHub Actions repo secret.
- `[ ]` `F3-T11` `eas init` to link the project to your Expo account (writes `extra.eas.projectId` into `app.json`). One-time.
- `[ ]` `F3-T12` First Android dev-client / preview build via EAS so push actually works on a real device. (Expo Go can receive pushes too, but only via Expo's hosted projects.)
- `[ ]` `F3-T13` README — document `CRON_SECRET`, the cron workflow, and the EAS setup steps.

---

## Open decisions for later (not blocking)

- **Premium gating UX.** Once free works, do we put a "Premium" tab/section showing what they'd get? Or a waitlist signup? Or just silence until it ships? — defer to when free is in users' hands.
- **Notification timing.** Default `hours_before = 24`. Add `48` and `72` presets to the toggle? — see if anyone asks.
- **Multi-device push.** A user with multiple devices gets multiple notifications on each. Acceptable for free tier; premium might want "primary device" picking.
- **Self-host vs Expo Push API.** Expo Push is free + simple; switching to direct APNs/FCM only matters if Expo's service has uptime issues for us.
- **Web push.** Defer indefinitely unless we see lots of desktop-only users — native push covers the dominant case.

---

## Decision log additions

- `D-05 (2026-04-26)` — **Pivot to free MVP first.** Manual tracker + cost rollups + pre-charge notifications ship as free; mail/bank scrapers + virtual cards stay deferred behind a future premium paywall. Reason: mail scraper accuracy is gated on inbox volume (test accounts too sparse), and virtual cards require KYC. Lowers risk-of-non-shipping; validates the core "user notices unwanted subs" loop first.
- `D-06 (2026-04-26)` — **Notification channels: in-app banner + native push via Expo, no email.** Reason: user preference; native push has the best UX once a dev-client/preview build exists. Email + web push deferred (low marginal value over native).
- `D-07 (2026-04-26)` — **No categories in free MVP.** Flat sorted list works at current scale (~17 subs). Revisit if dashboard becomes hard to scan.
- `D-08 (2026-04-26)` — **Mail-scraping backend stays wired but unreachable from UI.** Cleaner diff than deleting; tests stay exercised; trivial to reactivate for premium. The Phase 1 work isn't wasted — it's gated.
