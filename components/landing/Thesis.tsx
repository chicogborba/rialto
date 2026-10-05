import { Section } from "./Section";

const STEPS = ["Goal", "Discovery", "Evaluation", "Decision", "Payment", "Execution", "Result"];

export function Thesis() {
  return (
    <Section index="02 / WHY" light title={<>APIs were built for developers.<br />Agents don&apos;t want endpoints.<br />They want <span className="bg-ink px-2 text-signal">outcomes.</span></>}>
      <div className="grid gap-10 md:grid-cols-2">
        <div className="border-t-4 border-ink pt-4">
          <h3 className="text-3xl font-bold uppercase tracking-tight">x402 solves payment.</h3>
          <p className="mt-3 max-w-md text-ink/70">An HTTP 402 response, payment requirements, a signed authorization, a verified retry. The rail exists and it works.</p>
        </div>
        <div className="border-t-4 border-ink pt-4">
          <h3 className="text-3xl font-bold uppercase tracking-tight">Switchyard solves procurement.</h3>
          <p className="mt-3 max-w-md text-ink/70">Which capability, which provider, how much it is worth, whether to compose several, when to fall back, and whether the result was worth the cost.</p>
        </div>
      </div>
      <p className="mt-10 max-w-3xl border-l-4 border-ink pl-4 text-lg font-medium">
        x402 provides the payment rail. Switchyard adds the layer that decides what to buy, from whom, and when. We didn&apos;t invent x402 and we are not the only x402 marketplace — we&apos;re the decision layer on top.
      </p>
      <ol className="mt-10 grid grid-cols-2 gap-px bg-ink/30 font-mono text-[11px] font-bold uppercase tracking-[0.1em] sm:grid-cols-4 lg:grid-cols-7">
        {STEPS.map((s, i) => (
          <li key={s} className="bg-paper p-3"><span className="text-ink/50">{String(i + 1).padStart(2, "0")}</span><br />{s}</li>
        ))}
      </ol>
    </Section>
  );
}
