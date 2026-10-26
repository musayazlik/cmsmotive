# Customer notifications

Customers see notifications in their account (bell in the top bar, `/account/notifications`) and, depending on their preferences, by email.

## What is sent

| Message | When | Email category |
| --- | --- | --- |
| New version available | A release is uploaded for a product the customer owns and their update window covers it (`updatesUntil` empty or after the release) | New versions |
| Purchase confirmed | `checkout.completed` webhook | Subscriptions & updates |
| Subscription renews soon | Within 3 days of `currentPeriodEnd` for an active or trialing subscription; shows date and amount | Subscriptions & updates |
| Subscription ends soon | Within 3 days of the end of a subscription that is set to cancel | Subscriptions & updates |
| Subscription renewed | The paid period moved forward (renewal webhook) | Subscriptions & updates |
| Cancellation scheduled / subscription ended | Status change from the webhook | Subscriptions & updates |
| Payment failed | Status becomes `past_due` or `unpaid` | Always mailed (not optional) |
| Updates ending | One-time purchase whose update window ends within 7 days | Subscriptions & updates |
| Refund processed | `refund.created` webhook (full or partial) | Subscriptions & updates |

In-account messages are always kept. Customers choose which categories are also mailed under **Notifications → Email me about**; both default to on.

## How it works

- `Notification` rows hold a `type` and a small `data` payload. The text is produced when it is shown or mailed (`lib/notification-text.ts`), in the reader's language (account language for email).
- Every message has a `dedupeKey` (unique per user), so repeated webhooks, retries and overlapping job runs never message anyone twice. A renewal reminder is keyed by the subscription and its period end, so the next period gets its own.
- Webhook messages are written inside the same transaction as the commerce records (`lib/commerce.ts`). New-release messages are written when the package upload completes (R2 route and UploadThing callback), and again by the scheduled job if that failed (`ProductRelease.notifiedAt` is the claim).
- Email is sent separately (`deliverPendingEmails`): after a webhook, after an R2 release upload, and by the scheduled job. A failed send is retried up to 3 times; messages older than 7 days are not mailed. Nothing is mailed until Plunk is configured (`PLUNK_SECRET_KEY`, `PLUNK_FROM_EMAIL`).

## Scheduled job

Reminders ("renews in 3 days") need something to run on a schedule. Set `CRON_SECRET` (at least 16 characters, e.g. `openssl rand -hex 32`) and call the endpoint every 15–60 minutes:

```sh
curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://YOUR-DOMAIN/api/cron/notifications
```

With Dokploy, add this as a schedule on the application (or any external cron service). The response reports how many releases were announced, how many reminders were queued and how many emails were sent, skipped or failed. Running it more often than needed is harmless.

## Checks

```sh
pnpm test:notifications
pnpm test:notifications:db
pnpm test:commerce:db
```

After `pnpm db:deploy` and `pnpm db:generate`, restart a running development server so it loads the new Prisma client.
