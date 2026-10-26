# Creem annual subscriptions

Implemented on 24 October 2026. Live payments are disabled until the operational legal information, product checklist, payment keys and yearly plans are ready. Existing demo products remain concepts. Test mode permits enabled sample plans to open Creem sandbox checkout without marking a concept as released or legal documents as reviewed; the product form explicitly identifies the test and absence of a released package.

## Local and deployment configuration

1. Apply `pnpm db:deploy` and `pnpm db:generate`. Restart a running development server after generating a changed Prisma client.
2. Add secrets to the environment, never source control or chat:

   ```dotenv
   CREEM_MODE=test
   CREEM_API_KEY=creem_test_...
   CREEM_WEBHOOK_SECRET=...
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   BETTER_AUTH_URL=http://localhost:3000
   ```

   In production both site URLs must be the real HTTPS origin. `CREEM_MODE=live` explicitly selects production; every other value selects test. Keep test/live webhook secrets separate. Also configure Better Auth, PostgreSQL, private UploadThing storage and transactional email using `.env.example`.
3. In Creem test mode create an **active recurring yearly** EUR product with a **tax-inclusive** price and **no trial**. The application checks those settings before checkout and when enabling a plan. Use a separate product per service plan. The amount in the panel must match Creem, including cents.
4. In Settings → Legal complete actual hosting/database locations, retention, processors and transfer safeguards. Check identity, applicable tax/register details and all four public legal pages against the real operation before marking reviewed. Account registration additionally follows Settings → General → Accounts.
5. Complete each theme/extension's release checklist, including GPL-compatible code licensing, third-party notices, tested TYPO3 versions and actual support scope. In Subscriptions & packages create its plan, upload its private ZIP release, add the Creem test product ID and enable the plan. Publication and checkout perform separate checks; uploading a file does not publish a concept.
6. For deployed HTTP deliveries, register `https://YOUR-DOMAIN/api/webhooks/creem` in Creem. Subscribe to `checkout.completed`, `subscription.active`, `subscription.paid`, `subscription.scheduled_cancel`, `subscription.canceled`, `subscription.expired`, `subscription.past_due`, `subscription.unpaid`, `subscription.paused`, `refund.created` and `dispute.created`, where available in the Creem dashboard. Copy that endpoint's signing secret to the environment and restart.

### Local webhook forwarding

Run the application with `pnpm dev`, then run `pnpm creem:webhook` in a second terminal. The launcher loads the same Next.js environment files and forwards to `http://localhost:PORT/api/webhooks/creem`; `PORT` defaults to 3000 only when unset. A tunnel is not required with Creem CLI.

Set `CREEM_CLI_WEBHOOK_ID` to an existing **CLI-mode** test endpoint and set `CREEM_WEBHOOK_SECRET` to that endpoint's signing secret. Reusing the ID keeps the signing secret stable between listener runs. Without an ID, the CLI creates a temporary endpoint with a new signing secret; copy that secret into the local environment and restart the app before sending events. HTTP deployment endpoints have their own secrets and must not use this CLI endpoint ID.

The launcher uses the project's `CREEM_API_KEY` and `CREEM_MODE`, so a different saved CLI login cannot silently select another account or environment. Live listening still requires the explicit `--live` flag. Additional CLI options, such as `--once` or `--webhook`, can be passed after `pnpm creem:webhook`.

If the dashboard records **503**, inspect the delivery response: `creem listen could not reach ...` means the server/port is unreachable or timed out; `Webhook not configured` means the app has no signing secret. A **401** means the signature or signing secret does not match. Fix the target or configuration and replay the failed event from the Creem dashboard; CLI deliveries already acknowledged as failed are not retried automatically. See the [Creem CLI documentation](https://docs.creem.io/code/cli).

## Delivery and cancellation

- `/account` lists the signed-in customer's products and private downloads; `/account/billing` opens their own Creem portal for invoices, payment details and cancellation. Public navigation includes My account.
- The product-detail purchase form posts directly to checkout and redirects to Creem. Guests sign in and return to the same product and selected plan. Checkout requires current sales terms and a separate annual recurring-charge acknowledgement. It records their document versions and timestamp. Card details are collected by Creem. The return URL never grants access.
- A verified raw-body HMAC webhook reconciles the subscription through Creem's API. Duplicate and late events cannot create duplicate grants; payment environment and checkout/product ownership are checked server-side.
- Active subscriptions and scheduled cancellation retain updates/support through the paid period. After expiry, previously included ZIP releases remain downloadable. Refunded/disputed entitlements are blocked. GPL code already received remains usable under its license; supported installation counts describe service coverage, not code-use restrictions.
- Release ZIPs use UploadThing **private ACL**, never the public media library. Downloads require verified account ownership and use a short-lived signed URL. Verify private ACL support in the actual UploadThing account before launch.
- Content export/import deliberately excludes financial tables and does not overwrite later newsletter withdrawals. Back up the complete PostgreSQL database separately, including billing tables, and test restoration.

## Checks before enabling live mode

Use an actual test checkout to verify purchase → signed webhook → owned product → private download, yearly renewal, scheduled cancellation, expiry, refund and another account being denied access. Also verify account confirmation, reset email and newsletter double opt-in with the real email configuration. The automated commerce integration suite uses documented API fixtures and an isolated database schema; it does not replace a provider sandbox checkout.

Only after these checks add production Creem product IDs, use production secrets and set `CREEM_MODE=live`. Never use a real card to validate test mode. No production payment has been run as part of this implementation.

## Legal items still requiring the actual business information

The legal copy includes Musa Yazlık, the supplied İstanbul address, `info@cmsmotive.de`, B2B/B2C sales and annual service terms. It cannot supply unknown hosting contracts, retention periods, transfer mechanisms, registration/tax data or provider arrangements. Confirm whether a telephone contact and additional consumer pre-contract information are required for the target markets.

Turkey's consumer subscription rules restrict automatic extension of fixed-term consumer subscriptions. Before live B2C sales, determine the correct contract classification and renewal/termination process with qualified local advice, including how this interacts with Creem as Merchant of Record and EU consumer customers. The recurring-charge checkbox alone is not a legal conclusion. Statutory refund/withdrawal rights are not removed by a blanket “no refunds” rule. Verify any immediate digital delivery acknowledgement and withdrawal handling in the actual hosted checkout. Creem's billing/tax role does not replace the product provider's privacy and service obligations.

## Primary references

- [Creem documentation](https://docs.creem.io/llms.txt)
- [TYPO3 trademark policy](https://docs.typo3.org/m/typo3/guide-policy/main/en-us/Association/TrademarkUsagePolicy.html)
- [TYPO3 open source licenses](https://typo3.com/typo3-cms/what-is-typo3/open-source/licenses)
- [Türkiye consumer subscription guidance](https://tuketici.ticaret.gov.tr/yayinlar/tuketici-bilgi-rehberi/abonelik-sozlesmeleri-hakkinda-bilgilendirme)
- [KVKK information duty guidance](https://www.kvkk.gov.tr/Icerik/5394/Aydinlatma-Yukumlulugunun-Yerine-Getirilmesi-Rehberi)

## Verification commands

```sh
pnpm typecheck
pnpm lint
pnpm i18n:check
pnpm test:commerce
pnpm test:commerce:db
pnpm test:backup:db
pnpm build
```

Database suites create and drop their own random test schemas. They require a development database user allowed to create schemas and do not change the application's records.
