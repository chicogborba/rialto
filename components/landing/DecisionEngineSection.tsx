import { InteractiveMatrix } from "@/components/visualizations/InteractiveMatrix";
import { VISION_QUALIFIED } from "./data";
import { Section } from "./Section";

export function DecisionEngineSection() {
  return (
    <Section
      index="04 / DECISION"
      title={<>Price is a signal.<br />Quality is a signal.<br />Reputation is a signal.<br /><span className="text-signal">The agent decides.</span></>}
      intro="Three providers, one capability. Change what the agent cares about and the winner changes. The scores come from the same pure function the server runs."
    >
      <InteractiveMatrix candidates={VISION_QUALIFIED} />
    </Section>
  );
}
