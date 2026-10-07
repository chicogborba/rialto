/**
 * Pixel art for the race, as rows of palette keys ("." is transparent). Every racer is 24 pixels
 * wide and has two leg rows that swap for the walk cycle. Drawn once into small canvases.
 */
export interface Racer {
  body: string[];
  /** two versions of the rows under the body: the walk cycle */
  legs: [string[], string[]];
  palette: Record<string, string>;
}

const SOLANA: Racer = {
  body: [
    "...kkkkkkkkkkkkkkkkkk...",
    "..kGGGGGGGGGGGGGGGGGGk..",
    "..kggggggggggggggggggk..",
    "..kggggggggggggggggggk..",
    "..kggggkkggggggkkggggk..",
    "kkkbbbbkkbbbbbbkkbbbbkkk",
    "kbbbbbbkkbbbbbbkkbbbbbbk",
    "kbbbbbbkkbbbbbbkkbbbbbbk",
    "kkkbbbbbbbbbbbbbbbbbbkkk",
    "..kppppppppppppppppppk..",
    "..kppppppppppppppppppk..",
    "..kPPPPPPPPPPPPPPPPPPk..",
    "..kkkkkkkkkkkkkkkkkkkk..",
  ],
  legs: [
    ["....pp..pp....pp..pp....", "....pp..pp....pp..pp....", "....pp........pp........", "....pp........pp........", "....kk........kk........"],
    ["....pp..pp....pp..pp....", "....pp..pp....pp..pp....", "........pp........pp....", "........pp........pp....", "........kk........kk...."],
  ],
  palette: { k: "#120a1f", G: "#8dffd0", g: "#14f195", b: "#4fa3e3", p: "#9945ff", P: "#6f2fd0" },
};

const CARD: Racer = {
  body: [
    ".kkkkkkkkkkkkkkkkkkkkkk.",
    ".kCCCCCCCCCCCCCCCCCCCCk.",
    ".kcccccccccccccccccccck.",
    ".kddddddddddddddddddddk.",
    ".kddddddddddddddddddddk.",
    ".kcccccccccccccccccccck.",
    ".kcyyyccccwwkcccwwkccck.",
    ".kcyyyccccwwkcccwwkccck.",
    ".kccccccccccckkccccccck.",
    ".kcwwcwwcwwcwwcccccccck.",
    ".kcccccccccccccccccccck.",
    ".kkkkkkkkkkkkkkkkkkkkkk.",
  ],
  legs: [
    ["......ll........ll......", "......ll........ll......", "......ll................", "......kk................"],
    ["......ll........ll......", "......ll........ll......", "................ll......", "................kk......"],
  ],
  palette: { k: "#120a1f", C: "#8fb4ff", c: "#3f7bf2", d: "#1b2a5c", y: "#ffd23f", w: "#ffffff", l: "#9bb8ff" },
};

const BANK: Racer = {
  body: [
    "...........kk...........",
    ".........kssssk.........",
    ".......kssssssssk.......",
    ".....kssssssssssssk.....",
    "...kSSSSkkSSSSkkSSSSk...",
    "...kkkkkkkkkkkkkkkkkk...",
    "...kdssddssddssddssdk...",
    "...kdssddssddssddssdk...",
    "...kdssddssddssddssdk...",
    "...kdssddssddssddssdk...",
    "...kdssddssddssddssdk...",
    "..kssssssssssssssssssk..",
    "..kkkkkkkkkkkkkkkkkkkk..",
  ],
  legs: [
    [".......dd......dd.......", ".......dd......dd.......", ".......dd...............", ".......kk..............."],
    [".......dd......dd.......", ".......dd......dd.......", "...............dd.......", "...............kk......."],
  ],
  palette: { k: "#120a1f", s: "#e8dfcc", S: "#fffaf0", d: "#8b8171" },
};

const GLOBE: Racer = {
  body: [
    ".........kkkkkk.........",
    ".......kkooooookk.......",
    "......koollloooOOk......",
    ".....koolllllooooOk.....",
    "....kollllloooolllok....",
    "....koollekooolekllk....",
    "....kooolekooooekllk....",
    "....kooooooolloollok....",
    "....kooooolllllooook....",
    ".....kooooolllooook.....",
    "......koooollooook......",
    ".......kkooooookk.......",
    ".........kkkkkk.........",
  ],
  legs: [
    ["........ww....ww........", "........ww....ww........", "........ww..............", "........kk.............."],
    ["........ww....ww........", "........ww....ww........", "..............ww........", "..............kk........"],
  ],
  palette: { k: "#120a1f", o: "#3d8bfd", O: "#8fc0ff", l: "#3fbf6f", e: "#ffffff", w: "#9ec5ff" },
};

export const RACERS = { solana: SOLANA, card: CARD, bank: BANK, globe: GLOBE };

export interface Frames {
  /** [walk frame A, walk frame B] */
  frames: [HTMLCanvasElement, HTMLCanvasElement];
  width: number;
  height: number;
}

function paint(rows: string[], palette: Record<string, string>): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(...rows.map((r) => r.length));
  canvas.height = rows.length;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const color = palette[row[x]];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      }
    });
  }
  return canvas;
}

export function buildFrames(racer: Racer): Frames {
  const a = paint([...racer.body, ...racer.legs[0]], racer.palette);
  const b = paint([...racer.body, ...racer.legs[1]], racer.palette);
  return { frames: [a, b], width: a.width, height: a.height };
}
