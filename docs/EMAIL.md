# Account emails

Rialto uses Resend to send confirmation and password-reset codes. It does not
provision an inbox, receive mail, or subscribe users to marketing.

## Activate sending (Resend + GoDaddy)

1. Create a Resend account and add `galleriarialto.com` under **Domains**, selecting
   **North Virginia (`us-east-1`)** in Advanced options. Enable sending; leave
   receiving off. Disable open and click tracking for these emails.
2. In GoDaddy's DNS management for the domain, add the exact sending records Resend
   supplies: the DKIM TXT record and the sending CNAME records (or SPF/return-path
   records if supplied by the account). These authenticate outgoing mail; they do
   not create an inbox. Use Resend's generated values and priorities rather than
   copying another domain's records. Keep the
   website's A/CNAME records and any existing root MX records intact.
3. Verify the domain in Resend. No mailbox named `no-reply` needs to exist.
4. Create a sending-only API key restricted to this domain. Save it in the local
   `.env` as `RESEND_API_KEY`. For automated deployments, store the key as the
   GitHub Actions repository secret `RESEND_API_KEY`; the deploy workflow transfers
   it to the server's `.env` using a temporary file with restricted permissions,
   then removes that file. `EMAIL_FROM` can be overridden with a repository
   variable; its default is the Rialto sender below. Without the secret, the
   workflow leaves existing server email settings alone. For manual deployments,
   set the key directly in `/opt/rialto/.env`. Never commit it or put it in a
   `NEXT_PUBLIC_` variable.
5. Configure:

   ```dotenv
   EMAIL_TRANSPORT=resend
   EMAIL_FROM="Rialto <no-reply@galleriarialto.com>"
   ```

   Production also needs the existing `SECRETS_KEY` (32 random bytes, base64),
   which protects stored credentials and is used to hash email codes. Keep it
   stable: changing it invalidates pending codes and encrypted operator settings.
6. Deploy the application, then recreate the app container so it reads the updated
   environment (`docker compose up -d app`). Container startup applies the additive
   Prisma schema changes. Back up the database before deploying, as usual.
7. Test signup and password recovery with an address you control, including inbox
   placement and a resend. Keep the sending quota appropriate for tester traffic.

Provider documentation: [verified domains](https://resend.com/docs/dashboard/domains/introduction)
and [send email API](https://resend.com/docs/api-reference/emails/send-email).

## Account behavior

- Signup sends a six-digit code. No account, welcome credit, or session exists
  until the email is confirmed at `/api/auth/verify-email`.
- Pending signup details store only a password hash. Existing accounts keep
  working; they are not forced through a new verification step.
- Codes expire after 10 minutes, are single-use, and stop working after five
  incorrect guesses. Resends wait 60 seconds and replace the previous code.
- Code hashes and attempt limits are stored in SQLite, so restarting the server
  does not reset the limits. Expired records older than a day are cleaned up when
  another code is issued.
- Password recovery starts at `/forgot-password`. The request responds the same
  way for existing and unknown addresses. A successful reset revokes all sessions.
- Changing a password invalidates any reset requested for its previous hash.
- Sending fails closed when Resend is unconfigured or rejects a signup message.
  An existing account can still sign in. Email codes are never returned by the API
  or written to production logs.

## Local development and automated checks

To develop without sending messages, start `next dev` with:

```bash
EMAIL_TRANSPORT=preview npm run dev
```

Messages are private JSON files in `.local/emails/` (git-ignored). Read the code
from the latest file for the address you entered. `EMAIL_PREVIEW_DIR` can select
another local directory. Preview delivery is refused outside development mode;
it is not a production verification bypass.

`npm run check` includes email-auth tests against a disposable SQLite database
and a mocked Resend HTTP API. No real messages are sent by those tests.
`npm run e2e:accounts` reads local preview emails automatically. For a deployed
server, set `E2E_EMAIL` to an inbox you control that supports plus aliases; the
account checks prompt for each real confirmation code. The same confirmation
helper is used by `e2e:live`, which still performs real on-chain payments.

## Live verification — 26 October 2026

Production revision `826b1a1cc9e7b43a53278c2fdc6c57ac883f2630` was verified
through an operator-controlled Gmail test account:

- Confirmation and password-reset messages both arrived in the inbox.
- The confirmation message passed SPF, DKIM, and DMARC checks.
- Signup created no session until the email code was confirmed; login then worked.
- Password recovery revoked both existing test sessions, rejected the old password,
  and allowed login with the new password.
- Reusing either code was refused. Test sessions were signed out afterwards.

The [deployment run](https://github.com/chicogborba/rialto/actions/runs/40436597921)
also checked the revision served by the public health endpoint.
