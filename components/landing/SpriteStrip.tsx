/**
 * A four-frame pixel "run cycle" of the mascot, drawn as plain SVG rects.
 * Stands in for the sprite sheet the hired (fictional) provider delivers in the story.
 */
const FRAMES: [number, number, number, number][] = [
  // leg y-offsets per frame: [front-left, front-right, back-left, back-right]
  [0, 1, 1, 0],
  [1, 0, 0, 1],
  [0, 1, 1, 0],
  [1, 0, 0, 1],
];

function Frame({ x, legs, bob }: { x: number; legs: [number, number, number, number]; bob: number }) {
  return (
    <g transform={`translate(${x}, ${bob})`}>
      <rect x={3} y={3} width={18} height={12} fill="#ee7a35" />
      <rect x={3} y={3} width={18} height={1} fill="#f59a5f" />
      <rect x={1} y={7} width={2} height={4} fill="#ee7a35" />
      <rect x={21} y={7} width={2} height={4} fill="#ee7a35" />
      <rect x={7} y={6} width={2} height={4} fill="#17120f" />
      <rect x={15} y={6} width={2} height={4} fill="#17120f" />
      {[4, 7, 15, 18].map((lx, i) => (
        <rect key={lx} x={lx} y={15} width={2} height={5 - legs[i] * 2} fill="#ee7a35" />
      ))}
    </g>
  );
}

export function SpriteStrip() {
  return (
    <div className="border-2 border-ink bg-paper p-2 shadow-[6px_6px_0_var(--color-signal)]">
      <svg viewBox="0 0 104 22" className="block h-auto w-56 md:w-80" shapeRendering="crispEdges" role="img" aria-label="Sprite sheet: four frames of a run cycle">
        {FRAMES.map((legs, i) => (
          <Frame key={i} x={1 + i * 26} legs={legs} bob={i % 2} />
        ))}
      </svg>
      <p className="mt-1 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-ink/60">hero_run.png · 4 frames · demo output</p>
    </div>
  );
}
