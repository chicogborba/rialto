import { InteractiveMatrix } from "@/components/visualizations/InteractiveMatrix";
import { VISION_QUALIFIED } from "./data";
import { Section } from "./Section";

export function DecisionEngineSection() {
  return (
    <Section index="ROUTING ENGINE" title={<>Change its mind.<span className="text-signal"> Live.</span></>}>
      <InteractiveMatrix candidates={VISION_QUALIFIED} />
    </Section>
  );
}
