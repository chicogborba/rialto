# Roadmap

Where Rialto stands on 2026-10-27 and what is left. Items marked **owner** need the project owners (money, accounts, legal); the rest is code or server work.

## Where it stands

- Live at https://galleriarialto.com on **Solana mainnet** (real USDC, PayAI facilitator, Helius RPC), x402 end to end: the buyer's wallet pays the seller and Rialto's commission directly; Rialto holds no funds. First real purchase on 2026-10-26.
- 53 first-party integrations (fal.ai, ElevenLabs, Tripo) sold at **API cost + margin (15%) + commission (5%, min $0.001)**.
- Accounts, dashboard, sellers publishing their own APIs (with a free dry run), MCP server for agents.
- Agents with their own 3D critter (dressed by the owner or rolled), an appetite from Frugal to All-in that shapes what they are told and the limits they get, and a `rate_purchase` tool that feeds provider trust.
- Deploys from `main` through GitHub Actions, with a backup, a health check and automatic rollback.
- Operator panel at `/admin`: profit, purchases, users, peak hours, prices, keys and wallets, and a "Ready for Solana mainnet" checklist.

## 1. Before launch (blocking)

### Real money on mainnet
- [x] **owner** Send any amount of real USDC to the commission wallet `GW1joGToHBm2z9qXiHro8vP8agJvoGLqvAVjRJQrVDrz` (it has no USDC account on mainnet yet).
- [x] **owner** Fund the integrations payout wallet `8p9mDB1ZZfKTe5uzJLj2XPQKrQV3yUKCzAmycDm3crPx` (cost + margin is paid there) with any amount of USDC once, then set it in `/admin` → Keys & wallets.
- [x] **owner** Create a private Solana RPC (Helius or QuickNode free tier) and paste it in `/admin` → Keys & wallets.
- [x] **owner** Set the GitHub repository variable `SOLANA_NETWORK=mainnet` (Settings → Secrets and variables → Actions → Variables).
- [ ] **owner** Turn on auto top-up on fal.ai and confirm the fal key is a permanent one.
- [x] Switch the server to `SOLANA_NETWORK=mainnet`, set both wallets in `/admin`, redeploy.
- [x] One real purchase on mainnet, paid from a Phantom wallet through the allowance, checked on the explorer (2026-10-26).
- [ ] `npm run e2e:live` against mainnet.
- [ ] Set the daily limit of integration sales (`/admin` → Prices and limits, today $5/day) to what we are willing to spend on fal per day.

### Buying must be easy
- [x] Pay from an existing wallet (Phantom, Solflare, Backpack…): Dashboard → Wallet → *Pay from your wallet*. The owner approves a spending limit once (SPL `ApproveChecked` to Rialto's spender, which pays the SOL fee); the hosted MCP then pays on-chain sellers from that wallet with x402, no pop-up per call. Code: `lib/x402/delegate.ts`, `lib/wallet/allowance.ts`, `components/account/Wallet.tsx`.
- [ ] Run `npm run delegate:check` on devnet (needs a little devnet SOL on the spender) and then on mainnet, and confirm PayAI's mainnet facilitator accepts delegate-signed transfers as the reference facilitator does.
- [x] In `/admin` → Keys & wallets: generate the spender key and send it ~0.01 SOL.
- [ ] Try it with Phantom on desktop and on a phone (Phantom's in-app browser).

### Account security
- [x] Email verification on sign-up: Resend in `us-east-1`, deployed and verified through a real Gmail inbox on 2026-10-26.
- [x] Password recovery by email: deployed and verified, including old-session revocation and single-use codes; see `docs/EMAIL.md`.
- [ ] Two-factor authentication, required for admins (`/admin` can change the wallet the commission goes to).
- [ ] Email the admins whenever a payout wallet or an upstream key is changed; confirm before applying a wallet change.
- [ ] Sellers: confirm a payout address before publishing (a typo is a lost payment); show the explorer link.

### Server
- [ ] Firewall on (`ufw`: only 22, 80, 443). Today it is off.
- [ ] SSH: keys only, password login off. Today password login is on.
- [ ] Off-server backups (Backblaze B2 or S3, encrypted). Today the nightly backup lives on the same disk as the database.
- [x] **owner** Automatic rollout from GitHub Actions: the workflow and the server are ready (backup, health check, automatic rollback). Add repository variables `VPS_HOST=169.58.108.100`, `VPS_USER=deploy` and the secret `VPS_SSH_KEY` (contents of `~/.ssh/rialto_deploy`).

### Legal
- [x] **owner** Terms of use and privacy policy on the site (`/terms`, `/privacy`, accepted at sign-up).
- [ ] **owner** Have a lawyer read them.
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
- [x] Agents rate what they buy (`rate_purchase`); ratings move provider reputation.
- [ ] Show quality from agents' ratings instead of the seller's own estimate once a provider has enough of them.
- [ ] Official wallet logos on the Wallet page for wallets that are not installed (today a coloured initial).
- [ ] Seller payouts in other tokens, and other chains if buyers ask.
- [ ] Re-render the pitch video with the real demo cost ($0.633 in API calls, not $1.08).
