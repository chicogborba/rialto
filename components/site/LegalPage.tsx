import Link from "next/link";
import { PageShell } from "./PageShell";
import { LEGAL_CONTACT, LEGAL_UPDATED } from "@/lib/legal";

/** A long legal document in the site's light style: one readable column, numbered sections, a contact line. */
export function LegalPage({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <PageShell>
      <article className="mx-auto w-full max-w-3xl py-6 md:py-10">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-coal/50">Last updated {LEGAL_UPDATED}</p>
        <h1 className="mt-3 text-[clamp(2.4rem,6vw,3.8rem)] font-bold leading-[0.95] tracking-[-0.05em]">{title}</h1>
        <p className="mt-5 text-lg leading-relaxed text-coal/75">{intro}</p>
        <div className="legal mt-10 space-y-8 border-t-2 border-coal pt-8 text-[16px] leading-relaxed text-coal/85 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:tracking-[-0.03em] [&_h2]:text-coal [&_li]:mt-1.5 [&_p]:mt-3 [&_strong]:text-coal [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_a]:font-bold [&_a]:text-coal [&_a]:underline [&_a]:decoration-lime [&_a]:decoration-4 [&_a]:underline-offset-4">
          {children}
        </div>
        <p className="mt-12 border-t-2 border-coal/15 pt-6 text-sm text-coal/60">
          Questions about this document, your account or your data: write to <a href={LEGAL_CONTACT.href} className="font-bold text-coal underline decoration-lime decoration-4 underline-offset-4">{LEGAL_CONTACT.label}</a>. See also the{" "}
          <Link href={title === "Terms of Service" ? "/privacy" : "/terms"} className="font-bold text-coal underline decoration-lime decoration-4 underline-offset-4">
            {title === "Terms of Service" ? "Privacy Policy" : "Terms of Service"}
          </Link>
          .
        </p>
      </article>
    </PageShell>
  );
}
