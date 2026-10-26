import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/site/LegalPage";
import { LEGAL_CONTACT } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service · Rialto",
  description: "The rules for using Rialto, the marketplace where AI agents find, compare and pay for APIs.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro="Rialto is a marketplace where AI agents find, compare and pay for APIs, one call at a time, in USDC on Solana. These terms are the agreement between you and the team that runs Rialto at galleriarialto.com. By creating an account, connecting an agent or publishing an API, you accept them."
    >
      <section>
        <h2>1. What Rialto does, and what it does not</h2>
        <p>Rialto lists APIs (ours and those published by independent sellers), helps your agent choose one, and routes each paid call to it. Payments use the x402 protocol: every purchase is a USDC transfer on the Solana blockchain from the buyer&apos;s wallet straight to the seller, plus a separate transfer of Rialto&apos;s commission.</p>
        <ul>
          <li><strong>Rialto does not hold your money.</strong> We are not a bank, a payment institution or a custodian, and we never keep a balance on your behalf.</li>
          <li>Rialto is a technical intermediary. Unless an API is marked as one of Rialto&apos;s own integrations, it is provided by an independent seller, who is responsible for it.</li>
          <li>Nothing on Rialto is financial, investment, legal or tax advice.</li>
        </ul>
      </section>

      <section>
        <h2>2. Your account</h2>
        <ul>
          <li>You must be at least 18 years old and able to enter into a contract.</li>
          <li>Give a real email address and keep your password secret. You are responsible for everything done with your account, your agents&apos; keys and your wallets.</li>
          <li>Tell us right away if you think your account or a key has been compromised. You can revoke agent keys and sign out every device from the dashboard.</li>
          <li>We may suspend or close an account that breaks these terms, puts other people or the service at risk, or is required to be closed by law.</li>
        </ul>
      </section>

      <section>
        <h2>3. Agents and spending limits</h2>
        <p>An agent is an AI system (Claude Code, Codex or any MCP client) that you connect with a key from your dashboard. Your agent acts on your behalf: <strong>you are responsible for the purchases it makes</strong>, including those it makes because of instructions it read somewhere, within the limits you set.</p>
        <ul>
          <li>You set each agent&apos;s limits (per call and per session). Only you, signed in, can change them.</li>
          <li>Keep agent keys private. Anyone with a key can spend within that agent&apos;s limits.</li>
        </ul>
      </section>

      <section>
        <h2>4. Paying from your wallet</h2>
        <p>You can let your agents pay from a Solana wallet you control (for example Phantom or Solflare). To do so you sign, in your own wallet, an approval that allows Rialto&apos;s spender address to transfer up to an amount you choose from your USDC account. Then:</p>
        <ul>
          <li>Each purchase is sent from your USDC account directly to the seller and to Rialto&apos;s commission address, signed by our spender within your approval. The Solana token program itself prevents any transfer above what is left of it.</li>
          <li>You can lower or <strong>revoke the approval at any time</strong>, from the dashboard or from your wallet. Purchases already made are not undone.</li>
          <li>Choose a limit you are comfortable with. We recommend small limits, raised when you need them.</li>
          <li>You can also pay with your own signer, keeping your wallet key on your machine.</li>
        </ul>
      </section>

      <section>
        <h2>5. Prices, commission and payments</h2>
        <ul>
          <li>Each API shows its price per call before you buy. The buyer pays the seller&apos;s price plus Rialto&apos;s commission (currently 5% of the seller&apos;s price, with a minimum of $0.001 per call). Rialto&apos;s own integrations are priced at what the underlying provider charges us plus a margin.</li>
          <li>We may change the commission and our own prices at any time. A change applies to calls made after it, never to calls already paid.</li>
          <li><strong>On-chain payments are final.</strong> A Solana transaction cannot be reversed by us or by anyone else. Check addresses and limits before you sign.</li>
          <li>A call that fails before its result is delivered is not charged: the payment is only settled after the API answered successfully.</li>
          <li>Solana network fees for purchases are paid by the payment facilitator; the fee for your wallet approval is paid by Rialto.</li>
          <li>You are responsible for any taxes that apply to what you buy or sell.</li>
        </ul>
      </section>

      <section>
        <h2>6. Selling an API</h2>
        <ul>
          <li>You may publish only APIs you have the right to offer, and you are responsible for what they do, what they return, and their compliance with the law and with any third party&apos;s terms.</li>
          <li>You set your price. Each successful call pays it to the payout address you registered, in USDC on Solana. <strong>Rialto cannot recover a payment sent to a wrong address</strong>, so check yours carefully.</li>
          <li>We call your endpoint with the request the buyer&apos;s agent sent. Credentials you give us for your API are stored encrypted and used only to call it.</li>
          <li>We may pause or remove an API that fails often, misleads buyers, or breaks these terms.</li>
        </ul>
      </section>

      <section>
        <h2>7. Rialto&apos;s own integrations and generated content</h2>
        <p>Some APIs are run by Rialto on top of third-party AI providers (such as fal.ai, ElevenLabs and Tripo). Results are generated automatically and may be inaccurate, unexpected or similar to existing works.</p>
        <ul>
          <li>You are responsible for how you use what you buy, and for making sure your use is lawful and respects other people&apos;s rights.</li>
          <li>Your requests are sent to the provider that runs the model, under that provider&apos;s own usage policies, which also apply to you.</li>
          <li>To the extent we have any rights in a result you paid for, we pass them to you.</li>
        </ul>
      </section>

      <section>
        <h2>8. What you may not do</h2>
        <ul>
          <li>Use Rialto for anything illegal, including fraud, money laundering, sanctions evasion or financing of terrorism.</li>
          <li>Generate or publish content that sexualises minors, harasses or threatens people, impersonates someone, or infringes intellectual property or privacy.</li>
          <li>Attack, overload, probe or reverse-engineer the service, get around limits or payments, or access other people&apos;s accounts, keys or data.</li>
          <li>Publish APIs that are malware, phishing, or that collect data from buyers without their knowledge.</li>
        </ul>
      </section>

      <section>
        <h2>9. Blockchain and crypto risks</h2>
        <p>Using a blockchain carries risks outside our control: network outages or congestion, bugs in wallets or protocols, loss of your keys, phishing, and changes in the value or regulation of USDC. You are responsible for securing your wallet. Rialto will never ask for your seed phrase or private key.</p>
      </section>

      <section>
        <h2>10. Availability and changes</h2>
        <p>Rialto is offered &quot;as is&quot; and &quot;as available&quot;. We work to keep it running, but we do not promise it will be uninterrupted or error-free, and we may change, add or remove features and APIs, or limit how much can be bought in a period.</p>
      </section>

      <section>
        <h2>11. Liability</h2>
        <ul>
          <li>To the extent the law allows, Rialto is not liable for indirect or consequential losses, lost profits or data, for the acts of sellers, providers, facilitators or blockchain networks, or for purchases made by your agents within the limits and approvals you set.</li>
          <li>To the extent the law allows, our total liability to you is limited to the commissions Rialto received from your purchases in the three months before the claim.</li>
          <li>Nothing in these terms limits rights that consumer law gives you and that cannot be waived.</li>
          <li>You agree to compensate Rialto for claims caused by your breach of these terms or by the APIs you publish.</li>
        </ul>
      </section>

      <section>
        <h2>12. Ending the agreement</h2>
        <p>You can stop using Rialto at any time and ask us to delete your account (see the <Link href="/privacy">Privacy Policy</Link>). Revoke your wallet approval when you leave. Sections that by their nature should survive (payments made, liability, disputes) continue after the account is closed.</p>
      </section>

      <section>
        <h2>13. Changes to these terms</h2>
        <p>We may update these terms. The date at the top shows the current version; for important changes we will warn you on the site before they take effect. If you keep using Rialto after that, you accept the new version.</p>
      </section>

      <section>
        <h2>14. Law and disputes</h2>
        <p>These terms are governed by the laws of Brazil. Before going to court, write to us at <a href={LEGAL_CONTACT.href}>{LEGAL_CONTACT.label}</a> and we will try to solve the problem with you. Consumers keep the right to bring a claim in the courts of their own place of residence.</p>
      </section>
    </LegalPage>
  );
}
