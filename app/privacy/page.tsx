import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/site/LegalPage";
import { LEGAL_CONTACT } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy · Rialto",
  description: "What data Rialto collects, why, who else sees it, and how to have it deleted.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="This policy explains what personal data Rialto collects, why we need it, who else receives it and what you can ask us to do with it. We collect as little as we can: we do not run ads, sell data or use tracking cookies."
    >
      <section>
        <h2>1. Who is responsible</h2>
        <p>Rialto (galleriarialto.com) is run by its founding team, who decide how your data is used. You can reach us at <a href={LEGAL_CONTACT.href}>{LEGAL_CONTACT.label}</a>. Where Brazil&apos;s data protection law (LGPD) or the GDPR applies, the rights in section 7 are yours.</p>
      </section>

      <section>
        <h2>2. What we collect</h2>
        <ul>
          <li><strong>Account:</strong> your email address, the name you give us, and your password, stored only as a salted scrypt hash (we cannot read it).</li>
          <li><strong>Sessions:</strong> a sign-in cookie (HttpOnly, about 30 days), stored on our side only as a hash, with when it was last used and your browser&apos;s user agent, so you can see and sign out your devices.</li>
          <li><strong>Agents:</strong> their names, spending limits and a hash of their keys (we never store the key itself).</li>
          <li><strong>Wallets:</strong> the Solana addresses you register to get paid or to pay from. Wallet addresses and every on-chain payment are public on the Solana blockchain by nature.</li>
          <li><strong>Purchases:</strong> for each call, the API, the price, the commission, the result the API returned, the start of your agent&apos;s request (up to 500 characters), timings, and the links to the payment transactions.</li>
          <li><strong>Sellers:</strong> your API&apos;s details and price; credentials for your API are stored encrypted (AES-256-GCM).</li>
          <li><strong>Technical data:</strong> IP addresses, used in memory to limit abuse (sign-in attempts, request rates) and in short-lived server logs to keep the service secure.</li>
        </ul>
        <p>We do not ask for, and will never ask for, your wallet&apos;s seed phrase or private key.</p>
      </section>

      <section>
        <h2>3. Why we use it</h2>
        <ul>
          <li>To run the service you asked for: your account, your agents, purchases, payouts and receipts (performance of a contract).</li>
          <li>To keep Rialto secure and prevent fraud and abuse (legitimate interest).</li>
          <li>To keep records of transactions and meet legal obligations, including tax rules and requests from authorities (legal obligation).</li>
          <li>To understand, in aggregate, how the marketplace is used (purchases per hour, popular APIs) and improve it (legitimate interest).</li>
        </ul>
        <p>We do not sell your data, use it for advertising, or train AI models on it.</p>
      </section>

      <section>
        <h2>4. Who else receives data</h2>
        <ul>
          <li><strong>The API you buy from.</strong> Your agent&apos;s request goes to the seller of that API, or, for Rialto&apos;s own integrations, to the AI provider that runs the model (for example fal.ai, ElevenLabs or Tripo). They process it under their own privacy policies. Do not send personal data you do not want them to receive.</li>
          <li><strong>Payment infrastructure.</strong> Payment transactions and wallet addresses go to the x402 facilitator that settles them (PayAI), to our Solana RPC provider (Helius), and to the public Solana blockchain.</li>
          <li><strong>Hosting.</strong> Our servers and backups run on a rented cloud server (Contabo). Code is hosted on GitHub; it contains no user data.</li>
          <li><strong>Authorities,</strong> when the law requires it.</li>
        </ul>
        <p>Some of these providers are outside your country. We choose providers that protect data adequately and only share what each one needs.</p>
      </section>

      <section>
        <h2>5. Cookies</h2>
        <p>Rialto uses one essential cookie, to keep you signed in. There are no analytics, advertising or third-party tracking cookies. Your browser may store a few preferences locally (for example a chosen tab), which never leave your device.</p>
      </section>

      <section>
        <h2>6. How long we keep it</h2>
        <ul>
          <li>Account, agents and purchase records: while your account exists, and afterwards only as long as the law requires us to keep transaction records.</li>
          <li>Sessions: until they expire (about 30 days without use) or you sign out.</li>
          <li>Backups: the database is backed up daily and the last 14 copies are kept, so deleted data disappears from backups within about two weeks.</li>
          <li>On-chain payments: permanent on the Solana blockchain. Nobody, including us, can delete them.</li>
        </ul>
      </section>

      <section>
        <h2>7. Your rights</h2>
        <p>You can ask us to confirm what data we hold about you, give you a copy, correct it, delete it, or stop a particular use of it, and you can withdraw any consent you gave. Write to <a href={LEGAL_CONTACT.href}>{LEGAL_CONTACT.label}</a> from the account&apos;s owner, or with a way to verify it is yours. We answer within 15 days. You can change your name and password and sign out devices yourself in Dashboard → Settings, and revoke agents and wallet approvals in the dashboard.</p>
        <p>You may also complain to your data protection authority (in Brazil, the ANPD).</p>
      </section>

      <section>
        <h2>8. Security</h2>
        <p>Passwords are hashed with scrypt, keys and session tokens are stored only as hashes, third-party credentials are encrypted, the site is served only over HTTPS, and sign-in attempts are rate limited. No system is perfectly secure; if a breach affects your data, we will tell you and the authorities as the law requires.</p>
      </section>

      <section>
        <h2>9. Children</h2>
        <p>Rialto is not meant for anyone under 18, and we do not knowingly collect their data. If you believe a minor has an account, tell us and we will delete it.</p>
      </section>

      <section>
        <h2>10. Changes</h2>
        <p>We may update this policy. The date at the top shows the current version, and we will warn you on the site before important changes take effect. See also our <Link href="/terms">Terms of Service</Link>.</p>
      </section>
    </LegalPage>
  );
}
