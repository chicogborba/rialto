// Looks for frames that Chrome rendered wrong: a frame that differs from both of its neighbours
// while the neighbours agree with each other (a caption that vanishes for one frame, a tiled frame).
//
//   node scripts/check-flicker.mjs out/rialto-pitch.mp4
//
// Exits with 1 and lists the frames when it finds any. Needs ffmpeg.
import { spawnSync } from "node:child_process";

const file = process.argv[2] ?? "out/rialto-pitch.mp4";
const W = 192;
const H = 108;
const { stdout, status } = spawnSync("ffmpeg", ["-nostdin", "-loglevel", "error", "-i", file, "-vf", `scale=${W}:${H},format=gray`, "-f", "rawvideo", "-"], { maxBuffer: 1 << 30 });
if (status !== 0 || !stdout.length) {
  console.error(`Could not read ${file}.`);
  process.exit(1);
}
const size = W * H;
const count = Math.floor(stdout.length / size);
/** mean absolute difference between frames a and b, in grey levels */
const diff = (a, b) => {
  let sum = 0;
  for (let i = 0; i < size; i++) sum += Math.abs(stdout[a * size + i] - stdout[b * size + i]);
  return sum / size;
};

const suspects = [];
for (let i = 1; i < count - 1; i++) {
  const before = diff(i - 1, i);
  const after = diff(i, i + 1);
  if (before > 0.8 && after > 0.8 && diff(i - 1, i + 1) < Math.min(before, after) * 0.5) suspects.push(i);
}
if (suspects.length) {
  console.error(`${file}: ${suspects.length} suspect frame(s): ${suspects.join(", ")}`);
  console.error("Render again; if it persists, check that Config.setConcurrency(1) is still in remotion.config.ts.");
  process.exit(1);
}
console.log(`${file}: ${count} frames, no flicker found.`);
