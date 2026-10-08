/**
 * The Solana logo mark: three bars. It is the only place the page uses Solana's own colours (the
 * gradient below); everything else in the Solana section is the page's palette.
 * Path data is in a 397 × 311 box.
 */
export const SOLANA_MARK = {
  width: 397,
  height: 311,
  paths: [
    "M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z",
    "M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z",
    "M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z",
  ],
  /** bottom-left to top-right */
  gradient: ["#00ffa3", "#dc1fff"],
} as const;

/** The mark drawn on a canvas 2D context, fitted into a box whose left edge is `x`, vertically centred on `cy`. */
export function drawSolanaMark(ctx: CanvasRenderingContext2D, x: number, cy: number, height: number): number {
  const scale = height / SOLANA_MARK.height;
  const gradient = ctx.createLinearGradient(x, cy + height / 2, x + SOLANA_MARK.width * scale, cy - height / 2);
  gradient.addColorStop(0, SOLANA_MARK.gradient[0]);
  gradient.addColorStop(1, SOLANA_MARK.gradient[1]);
  ctx.save();
  ctx.translate(x, cy - height / 2);
  ctx.scale(scale, scale);
  ctx.fillStyle = gradient;
  for (const d of SOLANA_MARK.paths) ctx.fill(new Path2D(d));
  ctx.restore();
  return SOLANA_MARK.width * scale;
}
