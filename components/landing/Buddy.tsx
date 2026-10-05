import { cn } from "@/lib/utils";

type Mood = "idle" | "happy" | "wave";

/**
 * 2D pixel version of the agent for use around the page. Pure SVG + CSS:
 * it bobs, blinks and (optionally) waves without any JavaScript.
 */
export function Buddy({ mood = "idle", className }: { mood?: Mood; className?: string }) {
  const happy = mood === "happy";
  return (
    <svg viewBox="0 0 28 24" shapeRendering="crispEdges" className={cn("sy-buddy block h-auto", className)} role="img" aria-label="The Switchyard agent">
      <g className="sy-buddy-body">
        <rect x={5} y={3} width={18} height={12} fill="#ee7a35" />
        <rect x={5} y={3} width={18} height={1} fill="#f59a5f" />
        <rect x={3} y={7} width={2} height={4} fill="#ee7a35" />
        <g className={mood === "wave" ? "sy-buddy-wave" : undefined}>
          <rect x={23} y={7} width={2} height={4} fill="#ee7a35" />
        </g>
        {happy ? (
          <g fill="#17120f">
            <rect x={9} y={6} width={1} height={1} /><rect x={10} y={7} width={1} height={1} /><rect x={11} y={8} width={1} height={1} /><rect x={10} y={9} width={1} height={1} /><rect x={9} y={10} width={1} height={1} />
            <rect x={18} y={6} width={1} height={1} /><rect x={17} y={7} width={1} height={1} /><rect x={16} y={8} width={1} height={1} /><rect x={17} y={9} width={1} height={1} /><rect x={18} y={10} width={1} height={1} />
          </g>
        ) : (
          <g className="sy-buddy-eyes" fill="#17120f">
            <rect x={9} y={6} width={2} height={4} />
            <rect x={17} y={6} width={2} height={4} />
          </g>
        )}
      </g>
      {[6, 9, 17, 20].map((x, i) => (
        <rect key={x} x={x} y={15} width={2} height={5} fill="#ee7a35" className={i % 2 ? "sy-buddy-leg-b" : "sy-buddy-leg-a"} />
      ))}
    </svg>
  );
}
