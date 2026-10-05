/** Deterministic 128-bit hex digest (FNV-1a ×4 with different seeds). Not cryptographic — simulation only. */
export function fnv128(input: string): string {
  const seeds = [0x811c9dc5, 0x01000193, 0xdeadbeef, 0x9e3779b1];
  return seeds
    .map((seed) => {
      let h = seed >>> 0;
      for (let i = 0; i < input.length; i++) {
        h ^= input.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
      }
      return h.toString(16).padStart(8, "0");
    })
    .join("");
}
