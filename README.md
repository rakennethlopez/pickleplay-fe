# pickleplay-fe

Frontend for Pickleplay court booking: Next.js 16 (App Router, Cache Components), React 19,
Tailwind 4, shadcn/ui, TanStack Query. It is a BFF: the browser only talks to `src/app/api/*`,
which calls the [`pickleplay`](../pickleplay) API with the API key on the server.

Read `node_modules/next/dist/docs/` before changing routing or caching (see `AGENTS.md`).

## Run

```bash
cp .env.example .env     # set PICKLEPLAY_API_URL and PICKLEPLAY_API_KEY (same key as the API)
npm install
npm run dev              # http://localhost:3000, or: npx next dev -p 3100
```

Start the API first (see its README). Checks: `npm run typecheck`, `npm run lint`, `npm test`,
`npm run test:e2e` (Playwright).

## What exists

Guest flow: `/` home, `/book` choose court, `/book/[courtId]` pick a time, `/checkout/[holdId]`,
`/pay/[holdId]` send money + upload the receipt, `/booking/[token]` private status page (with
replace receipt), `/find` lookup by reference + mobile (view only). Courts, slot rules, day parts,
the hold time, upload limit and review target all come from the API, so nothing about them is
hardcoded here. Placeholders the business has not supplied yet (`[CONTACT]`, `[REFUND POLICY]`,
`[TOTAL]`, `[GCASH NUMBER]`, `[ACCOUNT NAME]`) live in `src/lib/placeholders.ts`.

The private link token is issued when the first receipt is submitted, so the booking page URL is
the guest's way back (there is a "Copy my private link" button). Uploads go browser -> BFF -> API
as multipart; the BFF only checks size and that a file is present, the API checks the real type.

Admin app (`/admin`, never linked from the public site): `/admin/login`, then `/admin/payments`
(the review queue with overdue / due-soon flags) and `/admin/payments/[bookingId]` (receipt,
statuses, history, Approve / Reject dialogs, logged phone reveal). The session lives in httpOnly,
SameSite=strict cookies set by the BFF; the browser never sees a token. `src/proxy.ts` keeps the
session fresh for page loads and sends signed-out visitors to sign-in, and `lib/admin-refresh.ts`
makes simultaneous requests share one refresh (the API's refresh token is single-use). Buttons are
only shown for what the signed-in role may do, but the API checks every action regardless.
Receipts are fetched through `/api/admin/payments/[id]/receipts/[receiptId]`, which follows a
short-lived signed link server-side and streams the bytes, so staff never get a link to keep.

When using the in-app browser pane for manual checks, a page with a streamed (Suspense) section may
look stuck until the pane paints a frame; that is the pane, not the app.

Cancelling: on the private page the server decides what is offered (`canSelfCancel` shows Cancel
booking, `canRequestCancel` shows Ask to cancel at `/booking/[token]/cancel`), and a code step
appears only if the API says one is required (SMS on). The refund wording never promises money:
it says staff will review it, and says it was processed only once staff recorded that.
Admin: `/admin/cancellations` (queue with the selected request beside it; approve with a refund
status, or reject with an explanation) and `/admin/refunds` (move a refund along, or record what
was sent). After a decision the confirmation stays at the top and the decided item stays selected,
even though it leaves the filtered list. The sidebar only lists sections the role can read.

SMS: tabled for v1, but the copy already follows the API's `smsEnabled` flag (`/settings/public`).
With it off (the default, and also while the setting loads) the checkout says the mobile number
finds a lost booking and the pages say they update on their own; with it on they say the link and
the decision are texted to the masked number. See `features/booking/sms-copy.test.tsx`.

Admin management screens: Overview, Calendar, Bookings (read only, phones masked), Courts, Blocked
hours, Pricing & hours (rate, slots, opening hours, payment accounts, hold and review timings) and
Staff & roles. The sidebar lists a section if the role holds any of its permissions, and `/admin`
sends each person to the first one they can open. Admin BFF routes for these screens are thin pipes
(`adminProxy`): the API validates every field and permission. A change the API refuses because
existing bookings are in the way shows those bookings in the message. Hours are entered and sent in
Philippine time (+08:00).

Hardening: pages and BFF answers send `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy:
no-referrer` (booking links carry a secret in the address), a restrictive `Permissions-Policy` and
HSTS; `/booking` and `/admin` are `noindex` and `no-store`. Accessibility: axe-core runs on the main
guest and staff screens (`src/features/a11y.test.tsx`; colour contrast is not measurable in jsdom and
is checked by hand against 4.5:1), default buttons are 44 px high and the public flow uses 48 px.
Not done: a Content-Security-Policy (needs per-request nonces with Next and Sentry); add one before
going live. Deploying: `docker build -t pickleplay-fe .` (`NEXT_PUBLIC_SENTRY_DSN` is a build arg;
`PICKLEPLAY_API_URL`, `PICKLEPLAY_API_KEY` and the cookie settings are read when the container
runs); CI is in `.github/workflows/ci.yml`. The Playwright e2e suite needs the API and database
running, so it is not part of CI yet.

Not built yet: the SMS status / Retry screens for staff (SMS is tabled).
