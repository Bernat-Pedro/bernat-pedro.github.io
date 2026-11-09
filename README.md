# Gather: Friends & Family Events

Gather is a static-site app at `events-manager.html`. Supabase supplies accounts, persistent PostgreSQL data, private image storage, row-level security, and realtime updates. There is no build step or local database; a Supabase project is required for account and data features.

## Set up Supabase

1. Create a Supabase project and enable Email authentication. Choose whether email confirmation is required.
2. In **Project Settings → API**, copy the project URL and the public `anon` key into `supabase-config.js`. These values are intended for browser use. Never put a `service_role` key in that file or any other frontend file.
3. Open the Supabase SQL Editor and run [`supabase/schema.sql`](supabase/schema.sql). It creates the tables, indexes, private buckets, RLS policies, friendship RPCs, and realtime publication entries.
  Then run [`supabase/messaging-upgrade.sql`](supabase/messaging-upgrade.sql) to add Text messaging and the master notification preference. Existing projects only need this second script for the messaging upgrade. It is transactional and rerunnable; no existing accounts or events are deleted.
4. In **Authentication → URL Configuration**, set the site URL and add the deployed `events-manager.html` URL (and your local URL) to the redirect allow list.
5. Serve the repository over HTTPS in production. For local work, run `python3 -m http.server 8000` and open `http://localhost:8000/events-manager.html`.

When updating an existing project, rerun `supabase/schema.sql` to apply idempotent schema and policy changes, including the event visibility setting. Redeploy changed Edge Functions after updating their source.

The public profile directory contains only usernames, avatar paths, and account creation dates. Email addresses remain in Supabase Auth. Events, friendships, requests, notification preferences, notifications, and push subscriptions are stored separately and protected with RLS. Profile and event images are in private buckets and fetched through authenticated Storage requests, so RLS is checked on each fetch.

## Background notifications

In-app reminders and request notifications work while signed in. Browser permission is requested only after the user presses **Enable browser notifications**. Without the optional setup below, browser reminders are limited to an open Gather tab; a browser or operating system may suspend background work.

Background delivery uses the service worker and Supabase Edge Functions. It requires a deployed HTTPS origin, a browser with Web Push support, VAPID keys, and a one-minute scheduled invocation.

1. Generate a VAPID key pair with `npx web-push generate-vapid-keys`. Put the public key in `VAPID_PUBLIC_KEY` in `supabase-config.js`; keep the private key secret.
2. Link the Supabase CLI to this project, then deploy:

   ```sh
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase functions deploy send-event-reminders --no-verify-jwt
   npx supabase functions deploy notify-friend-request
  npx supabase functions deploy notify-message --no-verify-jwt
   npx supabase functions deploy delete-own-account
   npx supabase secrets set CRON_SECRET=YOUR_RANDOM_SECRET VAPID_PUBLIC_KEY=YOUR_PUBLIC_KEY VAPID_PRIVATE_KEY=YOUR_PRIVATE_KEY VAPID_SUBJECT=mailto:YOUR_EMAIL
   ```

   Generate `YOUR_RANDOM_SECRET` locally (for example, `openssl rand -hex 32`) and enter the same value into Supabase Vault in the next step. Do not commit any private keys or secrets.
3. Enable `pg_cron`, `pg_net`, and Vault for the project if they are not enabled. In the SQL Editor, store the same random cron secret with `select vault.create_secret('YOUR_RANDOM_SECRET', 'gather_cron_secret');`.
4. Replace `YOUR_PROJECT_REF` in this SQL and run it to invoke the reminder function once per minute:

   ```sql
   select cron.schedule(
     'gather-event-reminders',
     '* * * * *',
     $$ select net.http_post(
       url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-event-reminders',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'gather_cron_secret')
       ),
       body := '{}'::jsonb
     ); $$
   );
   ```

The scheduled function creates deduplicated reminder rows for the creator and current accepted friends, then sends Web Push where a subscription exists. Friend-request push is sent by its Edge Function; the database trigger also saves an in-app notification. If push is not configured or supported, in-app notifications remain available. On iOS, background web push may require adding the site to the Home Screen; browser and OS power-saving settings can delay delivery.

## Text and notification upgrade

Apply `supabase/messaging-upgrade.sql` before publishing the updated frontend. Redeploy `notify-friend-request` and `send-event-reminders` to make existing push delivery honor the new account-wide notification switch, and deploy `notify-message`. The message function uses `--no-verify-jwt` at the gateway because it verifies the bearer JWT itself with Supabase Auth; it never accepts an anonymous sender. It reuses your existing VAPID secrets and private subscriptions. No extra frontend secret is needed.

Settings now has a master **Notifications Enabled / Notifications Disabled** toggle stored in `notification_preferences.notifications_enabled`. Turning it off suppresses new database notifications, in-app alerts, sound, and server push for messages, events, and friend requests. It also removes this browser's push subscription; re-enable the master switch and press **Enable browser notifications** to subscribe again. This does not revoke the browser's OS-level permission. Previously displayed or already dispatched OS notifications cannot be recalled. Existing notification history and unread message badges remain available while alerts are muted.

Text uses one `messages` table; conversations are derived from participants, with no duplicate conversation system. RLS allows only participants to read history, only the recipient to update read receipts, and only the real sender to insert a message to a current friend. Removing a friendship stops new sends, but both original participants retain their existing private history. The inbox shows latest previews, timestamps, and unread counts. Chats load 50 messages at a time with an Older messages control. Plain text is escaped, and messages are limited to 2,000 characters.

Message inserts create recipient notifications in the database, independent of the sender's push request. Push delivery is an additional best-effort call to `notify-message`; an atomic notification claim prevents repeated calls from duplicating delivery. Network/provider failures leave the durable in-app notification available, but are not automatically retried as browser push. Clicks in the tray or service-worker notifications open `events-manager.html?text=FRIEND_ID`. Enable Supabase Realtime as the migration specifies; the existing channel receives message/read-receipt updates and preference changes.

## Automated checks

Tests do not mutate your production Supabase project. Install test tools outside the static site:

```sh
npm install --prefix /tmp/gather-validation --no-save @electric-sql/pglite playwright
/tmp/gather-validation/node_modules/.bin/playwright install chromium
node tests/messaging-security.mjs
node tests/messaging-browser.mjs
```

The security suite executes the migration and RLS checks in isolated PostgreSQL with three user identities. The browser suite tests the real UI with a mocked Supabase transport, including sending/history, incoming unread badges, message notification links, persisted toggle state, and desktop/tablet/mobile layouts. Start the website on port 8000 first. `GATHER_TEST_MODULES` can override the test dependency directory and `GATHER_TEST_URL` the browser URL. Chromium needs its normal OS libraries; they were loaded under `/tmp/gather-browser-libs` in this container using `LD_LIBRARY_PATH`. Real-device Web Push and production two-account acceptance still require the migration, Edge Function deployments, browser permissions, and VAPID configuration above.

## Privacy and account deletion

RLS, not UI filtering, restricts event reads to the owner and current accepted friends and restricts event mutations to the creator. Friendship operations are security-definer RPCs that validate the signed-in user and reject self, duplicate, or reverse-pending requests. Removing a friendship deletes the access relationship immediately. Deleting an account uses a JWT-verified Edge Function to remove that user's stored images before deleting the Supabase Auth account and its cascading database records.

## Manual acceptance checks

Use two confirmed accounts in separate browser profiles to verify profile setup, username collisions, mutual friend acceptance/removal, private event visibility, creator-only edits, theme persistence, image access, and notification settings. For background reminders, configure the Edge Function and cron job first, create a timed event, enable browser notifications on both accounts as needed, and keep in mind that delivery depends on the browser and operating system.