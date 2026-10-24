# Roadmap: from devnet to open to the public

Where Rialto stands on 2026-10-24 and what is left before real people pay real money. Items marked **owner** need the project owners (money, accounts, legal); the rest is code or server work.

## Where it stands

- Live at https://galleriarialto.com on **Solana devnet** (test money), x402 end to end: the buyer's wallet pays the seller and Rialto's commission directly; Rialto holds no key and no funds.
- 53 first-party integrations (fal.ai, ElevenLabs, Tripo) sold at **API cost + margin (15%) + commission (5%, min $0.001)**.
- Accounts, dashboard, sellers publishing their own APIs, MCP server for agents.
- Operator panel at `/admin`: profit, purchases, users, peak hours, prices, keys and wallets, and a "Ready for Solana mainnet" checklist.

## 1. Before launch (blocking)

### Real money on mainnet
- [ ] **owner** Send any amount of real USDC to the commission wallet `GW1joGToHBm2z9qXiHro8vP8agJvoGLqvAVjRJQrVDrz` (it has no USDC account on mainnet yet).
- [ ] **owner** Pick the integrations payout wallet (cost + margin is paid there; it can be the same address) and fund it with any amount of USDC once.
- [ ] **owner** Create a private Solana RPC (Helius or QuickNode free tier) and paste it in `/admin` → Keys & wallets.
- [ ] **owner** Set the GitHub repository variable `SOLANA_NETWORK=mainnet` (Settings → Secrets and variables → Actions → Variables).
- [ ] **owner** Turn on auto top-up on fal.ai and confirm the fal key is a permanent one.
- [ ] Switch the server to `SOLANA_NETWORK=mainnet`, set both wallets in `/admin`, redeploy.
- [ ] One real $0.001 purchase (`npm run x402:check -- --pay`) and `npm run e2e:live`, both checked on the explorer, before the site says "mainnet".
- [ ] Set the daily limit of integration sales (`/admin` → Prices and limits, today $5/day) to what we are willing to spend on fal per day.

### Buying must be easy
- [ ] Today a buyer who pays on-chain runs the local signer (`npm run mcp`) with their own wallet key; the hosted MCP only buys simulated APIs. Pick one:
  - [ ] a one-command package (`npx rialto-mcp`) that sets up the signer and a spending limit, or
  - [ ] pay from a browser wallet (Phantom, Solflare) in the dashboard, still non-custodial.

### Account security
- [ ] Email verification on sign-up.
- [ ] Password recovery by email (today only the operator can reset one, from the server).
- [ ] Two-factor authentication, required for admins (`/admin` can change the wallet the commission goes to).
- [ ] Email the admins whenever a payout wallet or an upstream key is changed; confirm before applying a wallet change.
- [ ] Sellers: confirm a payout address before publishing (a typo is a lost payment); show the explorer link.

### Server
- [ ] Firewall on (`ufw`: only 22, 80, 443). Today it is off.
- [ ] SSH: keys only, password login off. Today password login is on.
- [ ] Off-server backups (Backblaze B2 or S3, encrypted). Today the nightly backup lives on the same disk as the database.
- [ ] Automatic rollout from GitHub Actions: repository variables `VPS_HOST=169.58.108.100`, `VPS_USER=deploy` and secret `VPS_SSH_KEY`. Today a push only builds the image; rollout is by hand.

### Legal
- [ ] **owner** Terms of use and privacy policy on the site (none today); drafts can be written here, a lawyer should read them.
- [ ] **owner** Ask an accountant about charging a commission on payments between third parties, crypto revenue and tax.
- [ ] Acceptable-use rules for generated content (it runs on our fal account and follows fal's usage policy), and a way to report abuse.

## 2. Right after launch

- [ ] Monitoring and alerts: site down (UptimeRobot), fal balance low, failure rate up, daily limit reached.
- [ ] Check real upstream costs against fal's billing for the first weeks; the per-call cost of credit- or token-priced models (Tripo, Hunyuan 3D, Trellis, language models) is an estimate.
- [ ] Refresh fal prices automatically (fal's pricing API) instead of by hand in `lib/gateway/integrations.ts`.
- [ ] Backfill the upstream cost of purchases made before 2026-10-24 (recorded as 0, so `/admin` overstates their profit).
- [ ] Clear messages to buyers when a call fails (a failed call is not charged; verify this with real money).
- [ ] Export purchases as CSV from `/admin` for accounting.
- [ ] A status page.

## 3. Later

- [ ] Postgres instead of SQLite when one server is no longer enough.
- [ ] Reputation from measured results instead of what sellers declare.
- [ ] Seller payouts in other tokens, and other chains if buyers ask.
- [ ] Re-render the pitch video with the real demo cost ($0.633 in API calls, not $1.08).
