// Records the browser footage for the product demo from a running Rialto, by driving the installed
// Chrome over the DevTools protocol (no extra dependencies).
//
//   DEMO_BASE=http://localhost:3100 node scripts/record-demo.mjs            every take
//   ... node scripts/record-demo.mjs landing signup                         only these takes
//   ... node scripts/record-demo.mjs --shots                                stills of each step, no video
//
// Each take becomes public/demo/takes/<name>.mp4 plus <name>.json: how long it runs, the moments worth
// cutting or narrating on ("marks", in seconds) and where the pointer was, so the video can draw its
// own cursor. The account it signs up is a throwaway (…@example.com): remove it afterwards with
// `npm run user:admin -- purge @example.com` in the app.
import { spawn, spawnSync } from "node:child_process";
import { createPrivateKey, randomBytes, sign } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const BASE = (process.env.DEMO_BASE ?? "http://localhost:3100").replace(/\/$/, "");
/** The page prints its own address in the install command; the footage shows the public one instead. */
const SHOWN = process.env.DEMO_SHOWN_ORIGIN ?? "https://galleriarialto.com";
const VIEW = { width: 1600, height: 900, scale: 1.2 };
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const root = path.resolve(import.meta.dirname, "..");
const OUT = path.join(root, "public/demo/takes");
const STATE = path.join(root, "out/demo-state.json");
const args = process.argv.slice(2);
const SHOTS = args.includes("--shots");
const wanted = args.filter((a) => !a.startsWith("--"));
const PERSON = { name: "Alex Rivera", email: "alex@example.com", agent: "My Claude Code" };

const CAST = path.join(root, "out/demo-frames/terminal");
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function unbase58(text) {
  let n = 0n;
  for (const ch of text) n = n * 58n + BigInt(B58.indexOf(ch));
  const out = [];
  for (; n > 0n; n >>= 8n) out.unshift(Number(n & 255n));
  for (const ch of text) {
    if (ch !== "1") break;
    out.unshift(0);
  }
  return Buffer.from(out);
}
function base58(bytes) {
  let n = BigInt(`0x${Buffer.from(bytes).toString("hex") || "0"}`);
  let out = "";
  for (; n > 0n; n /= 58n) out = B58[Number(n % 58n)] + out;
  for (const b of bytes) {
    if (b !== 0) break;
    out = `1${out}`;
  }
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => performance.timeOrigin / 1000 + performance.now() / 1000;

// ---- a very small DevTools client
class Page {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.waiting = new Map();
    this.listeners = new Map();
    ws.addEventListener("message", (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id) {
        const p = this.waiting.get(msg.id);
        this.waiting.delete(msg.id);
        if (msg.error) p?.reject(new Error(`${p.method}: ${msg.error.message}`));
        else p?.resolve(msg.result);
      } else for (const fn of this.listeners.get(msg.method) ?? []) fn(msg.params);
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.waiting.set(id, { resolve, reject, method }));
  }
  on(event, fn) {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), fn]);
  }
  async js(expression) {
    const r = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`in page: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
    return r.result.value;
  }
  async until(expression, what = expression, ms = 30_000) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (await this.js(`!!(${expression})`).catch(() => false)) return;
      await sleep(80);
    }
    throw new Error(`timed out waiting for ${what}`);
  }
}

// ---- the take being recorded
let page;
let take = null;
const pointer = { x: VIEW.width / 2, y: VIEW.height * 0.6 };

function mark(name) {
  if (take) take.marks[name] = Number((now() - take.t0).toFixed(3));
}
function track(extra = {}) {
  if (take) take.cursor.push({ t: Number((now() - take.t0).toFixed(3)), x: Math.round(pointer.x), y: Math.round(pointer.y), ...extra });
}

async function begin(name) {
  const dir = path.join(root, "out/demo-frames", name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  take = { name, dir, t0: now(), frames: [], marks: {}, cursor: [] };
  track();
  if (!SHOTS) await page.send("Page.startScreencast", { format: "jpeg", quality: 93, maxWidth: VIEW.width * VIEW.scale, maxHeight: VIEW.height * VIEW.scale, everyNthFrame: 1 });
}

async function end() {
  await sleep(250);
  const t = take;
  const duration = now() - t.t0;
  if (!SHOTS) await page.send("Page.stopScreencast");
  take = null;
  if (SHOTS || t.frames.length === 0) return;
  // hold each frame until the next one arrived, then resample to a steady 30 fps
  const list = t.frames.map((f, i) => `file '${f.file}'\nduration ${Math.max(0.001, (t.frames[i + 1]?.t ?? duration) - f.t).toFixed(4)}`).join("\n");
  writeFileSync(path.join(t.dir, "list.txt"), `${list}\nfile '${t.frames.at(-1).file}'\n`);
  mkdirSync(OUT, { recursive: true });
  const lead = t.frames[0].t;
  const ff = spawnSync("ffmpeg", ["-nostdin", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", path.join(t.dir, "list.txt"), "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-crf", "15", "-g", "30", "-movflags", "+faststart", path.join(OUT, `${t.name}.mp4`)], { stdio: "inherit" });
  if (ff.status !== 0) throw new Error(`ffmpeg failed for ${t.name}`);
  // the film starts at its first frame, so times are counted from there
  const shift = (v) => Number(Math.max(0, v - lead).toFixed(3));
  writeFileSync(
    path.join(OUT, `${t.name}.json`),
    `${JSON.stringify({ seconds: shift(duration), view: VIEW, marks: Object.fromEntries(Object.entries(t.marks).map(([k, v]) => [k, shift(v)])), cursor: t.cursor.map((c) => ({ ...c, t: shift(c.t) })) })}\n`,
  );
  console.log(`${t.name}: ${shift(duration).toFixed(1)}s, ${t.frames.length} frames, marks ${Object.keys(t.marks).join(" ")}`);
}

let shotNo = 0;
async function shot(label) {
  if (!SHOTS) return;
  const { data } = await page.send("Page.captureScreenshot", { format: "jpeg", quality: 80 });
  const dir = path.join(root, "out/demo-shots");
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, `${String(++shotNo).padStart(2, "0")}-${label}.jpg`), Buffer.from(data, "base64"));
}

// ---- hands
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
async function moveTo(x, y, ms = 650) {
  const from = { ...pointer };
  const start = performance.now();
  // by the clock, not by a count of steps: a step takes as long as Chrome takes to answer
  for (let k = 0; k < 1; ) {
    k = Math.min(1, (performance.now() - start) / ms);
    const e = ease(k);
    pointer.x = from.x + (x - from.x) * e;
    // a slight arc, the way a hand moves a mouse
    pointer.y = from.y + (y - from.y) * e - Math.sin(e * Math.PI) * Math.min(40, Math.abs(x - from.x) * 0.06);
    await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: pointer.x, y: pointer.y });
    track();
    await sleep(8);
  }
}
async function press() {
  track({ down: true });
  await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x: pointer.x, y: pointer.y, button: "left", clickCount: 1 });
  await sleep(70);
  await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: pointer.x, y: pointer.y, button: "left", clickCount: 1 });
  track();
}
/** centre of the element a page expression finds, scrolled into view if it is not */
async function where(find, { at = [0.5, 0.5], tries = 2 } = {}) {
  await page.until(find, find, 20_000);
  // kept clear of the top bar and of the bottom quarter, where the video puts its captions; an
  // element the page cannot scroll that far (the last thing on it) is taken where it is
  const box = await page.js(`(() => { const e = ${find}; const r = e.getBoundingClientRect(); if (${tries} > 0 && (r.top < 110 || r.bottom > innerHeight - 250)) { e.scrollIntoView({ block: "center", behavior: "smooth" }); return null; } return [r.left, r.top, r.width, r.height]; })()`);
  if (!box) {
    await sleep(700);
    return where(find, { at, tries: tries - 1 });
  }
  return { x: box[0] + box[2] * at[0], y: box[1] + box[3] * at[1] };
}
async function click(find, opts = {}) {
  const p = await where(find, opts);
  await moveTo(p.x, p.y, opts.ms ?? 650);
  await sleep(opts.rest ?? 180);
  await press();
}
async function type(text, { each = 55 } = {}) {
  for (const ch of text) {
    await page.send("Input.insertText", { text: ch });
    await sleep(each * (0.6 + Math.random() * 0.8));
  }
}
async function clearField() {
  await page.js(`document.activeElement?.select?.()`);
  await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Backspace", code: "Backspace", windowsVirtualKeyCode: 8 });
  await page.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Backspace", code: "Backspace", windowsVirtualKeyCode: 8 });
}
async function wheel(total, ms = 900) {
  const start = performance.now();
  let done = 0;
  for (let k = 0; k < 1; ) {
    k = Math.min(1, (performance.now() - start) / ms);
    const target = total * ease(k);
    await page.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: pointer.x, y: pointer.y, deltaX: 0, deltaY: target - done });
    done = target;
    await sleep(8);
  }
}
const byText = (tags, text) => `[...document.querySelectorAll(${JSON.stringify(tags)})].find((e) => e.textContent.trim().startsWith(${JSON.stringify(text)}) && e.getClientRects().length)`;
const field = (label) => `[...document.querySelectorAll("label")].find((l) => l.textContent.trim().startsWith(${JSON.stringify(label)}))?.querySelector("input,select,textarea")`;
async function goto(url) {
  await page.send("Page.navigate", { url: `${BASE}${url}` });
  await page.until(`document.readyState === "complete"`, `load ${url}`);
}

// ---- the takes
const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : {};
const save = () => {
  mkdirSync(path.dirname(STATE), { recursive: true });
  writeFileSync(STATE, JSON.stringify(state));
};

/**
 * Films a long terminal session (Claude building a whole game) with a time map: real speed up to the
 * moment the request is sent, the work fast-forwarded into a few seconds, real speed again for the
 * end. The film is already cut; its json says where each moment landed and how fast the middle ran.
 */
async function filmSession(name, fastSeconds) {
  const base = path.join(root, "out/game", name);
  const session = JSON.parse(readFileSync(`${base}.json`, "utf8"));
  const m = session.marks;
  const a = m.sent + 0.5;
  const b = Math.max(a + 1, m.answered - 0.8);
  const fast = fastSeconds ?? Math.min(18, Math.max(8, (b - a) / 25));
  // [seconds of the session, seconds of the film]
  const knots = [[0, 0]];
  const add = (to, rate) => knots.push([to, knots.at(-1)[1] + (to - knots.at(-1)[0]) / rate]);
  // Claude Code starting up (and asking whether to trust the folder) is not what the film is about
  if (m.claude !== undefined && m.ready !== undefined && m.ready - m.claude > 3) {
    add(m.claude + 0.9, 1);
    add(m.ready - 0.3, 2.5);
  }
  add(a, 1);
  add(b, (b - a) / fast);
  add(session.seconds, 1);
  const map = (v, from, to) => {
    for (let i = 1; i < knots.length; i++) if (v <= knots[i][from]) return knots[i - 1][to] + ((v - knots[i - 1][from]) * (knots[i][to] - knots[i - 1][to])) / (knots[i][from] - knots[i - 1][from]);
    return knots.at(-1)[to];
  };
  const total = knots.at(-1)[1];
  await page.send("Page.navigate", { url: `file://${path.join(root, "scripts/terminal-player.html")}` });
  await page.until(`typeof window.load === "function"`, "the terminal page");
  await page.js(`load(${JSON.stringify(readFileSync(`${base}.cast`, "utf8"))})`);
  await sleep(500);
  const dir = path.join(root, "out/demo-frames", `${name}-film`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const frames = Math.ceil(total * 30);
  const list = [];
  let file = "";
  for (let f = 0; f <= frames; f++) {
    if ((await page.js(`advance(${map(f / 30, 1, 0)})`)) || !file) {
      file = path.join(dir, `${String(f).padStart(5, "0")}.jpg`);
      const { data } = await page.send("Page.captureScreenshot", { format: "jpeg", quality: 93 });
      writeFileSync(file, Buffer.from(data, "base64"));
    }
    list.push(`file '${file}'\nduration ${(1 / 30).toFixed(5)}`);
  }
  writeFileSync(path.join(dir, "list.txt"), `${list.join("\n")}\nfile '${file}'\n`);
  mkdirSync(OUT, { recursive: true });
  const ff = spawnSync("ffmpeg", ["-nostdin", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", path.join(dir, "list.txt"), "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-crf", "15", "-g", "30", "-movflags", "+faststart", path.join(OUT, `${name}.mp4`)], { stdio: "inherit" });
  if (ff.status !== 0) throw new Error(`ffmpeg failed for ${name}`);
  const marks = Object.fromEntries(Object.entries(m).map(([k, v]) => [k, Number(map(v, 0, 1).toFixed(3))]));
  writeFileSync(path.join(OUT, `${name}.json`), `${JSON.stringify({ seconds: Number(total.toFixed(3)), view: VIEW, marks: { ...marks, fastFrom: Number(map(a, 0, 1).toFixed(3)), fastTo: Number(map(b, 0, 1).toFixed(3)) }, speed: Math.round((b - a) / fast), worked: session.worked, bought: session.bought, cursor: [] })}\n`);
  console.log(`${name}: ${total.toFixed(1)}s of film from ${session.seconds.toFixed(0)}s of session, the work at ${Math.round((b - a) / fast)}x`);
}

/**
 * Films a game being played. The folder is served as it is; the keys come from a small script that
 * runs in the page: out/game/<name>-bot.js when there is one (written after reading that game's
 * code), else arrow keys at random. The picture is the game's own; its sound is laid over in the video.
 */
// upright, like the games: the picture is the canvas and little else
const GAME_VIEW = { width: 600, height: 780, scale: 2 };
/**
 * Runs in the game's page before its own scripts: everything the game sends to the speakers (an
 * <audio> element, a Web Audio graph) is also fed to one recorder. What the film gets is the sound
 * the game really made, at the moments it made it.
 */
const AUDIO_TAP = `(() => {
  if (window.__tap || location.protocol === "file:" || !/^(127\\.0\\.0\\.1|localhost)$/.test(location.hostname) || location.port === "3100") return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  const connect = AudioNode.prototype.connect;
  let mix, out, recorder, chunks = [];
  window.__sounds = [];
  const master = () => {
    if (!mix) {
      mix = new AC();
      const record = mix.createMediaStreamDestination();
      // music, effects and a voice at once add up past full scale: headroom, then a limiter
      const limiter = mix.createDynamicsCompressor();
      limiter.threshold.value = -14; limiter.knee.value = 8; limiter.ratio.value = 12; limiter.attack.value = 0.003; limiter.release.value = 0.2;
      out = mix.createGain();
      out.gain.value = 0.42;
      connect.call(out, limiter);
      connect.call(limiter, record);
      out.stream = record.stream;
    }
    if (mix.state === "suspended") mix.resume().catch(() => {});
    return mix;
  };
  const feed = (stream) => { try { if (stream.getAudioTracks().length) connect.call(master().createMediaStreamSource(stream), out); } catch (e) { console.warn("audio tap", e); } };
  // a Web Audio graph: whatever reaches a context's speakers also reaches a stream of that context
  const taps = new WeakMap();
  AudioNode.prototype.connect = function (target, ...rest) {
    const result = connect.call(this, target, ...rest);
    try {
      if (target && target === this.context.destination && this.context !== mix) {
        let tap = taps.get(this.context);
        if (!tap) { tap = this.context.createMediaStreamDestination(); taps.set(this.context, tap); feed(tap.stream); }
        connect.call(this, tap);
      }
    } catch (e) { console.warn("audio tap", e); }
    return result;
  };
  // an <audio> element: its own stream, once it has sound to give
  const seen = new WeakSet();
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...args) {
    window.__sounds.push({ t: performance.now(), src: String(this.currentSrc || this.src).split("/").pop() });
    if (!seen.has(this)) {
      seen.add(this);
      const hook = () => { try { feed(this.captureStream()); } catch (e) { console.warn("audio tap", e); } };
      if (this.readyState >= 2 && !this.paused) hook(); else this.addEventListener("playing", hook, { once: true });
    }
    return play.apply(this, args);
  };
  window.__tap = {
    start() { master(); chunks = []; recorder = new MediaRecorder(out.stream, { mimeType: "audio/webm;codecs=opus", audioBitsPerSecond: 160000 }); recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data); recorder.start(250); return performance.now(); },
    stop() { return new Promise((resolve) => { if (!recorder) return resolve(""); recorder.onstop = () => { const reader = new FileReader(); reader.onloadend = () => resolve(String(reader.result).split(",")[1] ?? ""); reader.readAsDataURL(new Blob(chunks, { type: "audio/webm" })); }; recorder.stop(); }); },
  };
})()`;
/**
 * The player in the film. It only reads where the cars are and presses the arrow keys: every tick it
 * plays each place it could steer to two seconds ahead and goes where it lasts longest. It starts
 * the game and restarts it after a crash with the space bar.
 */
const AUTOPILOT = `(() => {
  const g = window.__film, opt = window.__filmOptions || {};
  const ev = (type, key) => window.dispatchEvent(new KeyboardEvent(type, { key, code: key === " " ? "Space" : key, bubbles: true }));
  const held = { ArrowLeft: false, ArrowRight: false };
  const hold = (key, on) => { if (held[key] !== on) { held[key] = on; ev(on ? "keydown" : "keyup", key); } };
  const TICK = 30, VMAX = 300 * TICK / 1000, HORIZON = 70;
  const seenY = new WeakMap();
  let lo = Infinity, hi = -Infinity, idle = 0, goal = null, played = 0, crashed = false, started = false;
  const size = (o) => ({ x: o.x, y: o.y, w: o.w || 38, h: o.h || 68 });
  setInterval(() => {
    const state = String(g.state), cars = (g.cars || []).map(size);
    const player = size(g.player || { x: 0, y: 0 });
    if (!/^play/.test(state)) {
      hold("ArrowLeft", false); hold("ArrowRight", false);
      if (/crash|over/.test(state)) crashed = true;
      // the title screen stays up long enough to be looked at; after a crash the film may end on it
      const wait = started ? 45 : Math.round((opt.titleMs || 1500) / TICK);
      if (/title|menu|over/.test(state) && !(crashed && opt.endOnCrash) && ++idle >= wait) { idle = 0; started = true; ev("keydown", " "); ev("keyup", " "); }
      return;
    }
    idle = 0;
    played += TICK / 1000;
    for (const c of cars) { lo = Math.min(lo, c.x - c.w / 2 - 6); hi = Math.max(hi, c.x + c.w / 2 + 6); }
    const left = Math.min(lo, player.x - player.w / 2) + player.w / 2, right = Math.max(hi, player.x + player.w / 2) - player.w / 2;
    const raw = g.cars || [];
    const moving = cars.map((c, i) => { const before = seenY.get(raw[i]); seenY.set(raw[i], c.y); return { ...c, vy: before === undefined ? 6 : c.y - before }; });
    const lasts = (target) => {
      let x = player.x;
      for (let t = 1; t <= HORIZON; t++) {
        x += Math.max(-VMAX, Math.min(VMAX, target - x));
        for (const c of moving) {
          const y = c.y + c.vy * t;
          if (Math.abs(x - c.x) < (player.w + c.w) / 2 + 2 && Math.abs(player.y - y) < (player.h + c.h) / 2 + 4) return t;
        }
      }
      return HORIZON + 1;
    };
    let best = player.x, bestScore = -1e9;
    if (opt.crashAfter && played > opt.crashAfter) {
      // time to show what a crash looks and sounds like: drive at the nearest car ahead
      const ahead = cars.filter((c) => c.y < player.y).sort((a, b) => b.y - a.y)[0];
      if (ahead) { hold("ArrowLeft", ahead.x - player.x < -4); hold("ArrowRight", ahead.x - player.x > 4); }
      return;
    }
    for (let x = left; x <= right; x += 12) {
      const score = lasts(x) * 10 - Math.abs(x - player.x) * 0.05 - (goal === null ? 0 : Math.abs(x - goal) * 0.04);
      if (score > bestScore) { bestScore = score; best = x; }
    }
    goal = best;
    hold("ArrowLeft", best - player.x < -5);
    hold("ArrowRight", best - player.x > 5);
  }, TICK);
})()`;

/**
 * A copy of the game for the film, with one line added: a window through which the autopilot can
 * read the state the game keeps to itself (it changes nothing in how the game plays).
 */
function filmingCopy(folder) {
  const copy = mkdtempSync(path.join(os.tmpdir(), "rialto-game-"));
  spawnSync("cp", ["-R", `${folder}/.`, copy]);
  const file = path.join(copy, "index.html");
  const html = readFileSync(file, "utf8");
  const hook = `window.__film = { get state() { return state; }, get player() { return player; }, get cars() { return cars; } };`;
  const at = html.lastIndexOf("})();");
  // a game that keeps its state in a closure gets the window inside it; one that does not, after its script
  writeFileSync(file, at >= 0 ? `${html.slice(0, at)}${hook}\n${html.slice(at)}` : html.replace(/<\/script>(?![\s\S]*<\/script>)/, `;${hook}</script>`));
  return copy;
}

async function filmGame(name, original, seconds = 16, options = {}) {
  if (!existsSync(path.join(original, "index.html"))) throw new Error(`no game in ${original}`);
  const folder = filmingCopy(original);
  const gamePort = 4700 + Math.floor(Math.random() * 200);
  const server = spawn("python3", ["-m", "http.server", String(gamePort), "--bind", "127.0.0.1", "--directory", folder], { stdio: "ignore" });
  try {
    await sleep(900);
    await page.send("Emulation.setDeviceMetricsOverride", { width: GAME_VIEW.width, height: GAME_VIEW.height, deviceScaleFactor: GAME_VIEW.scale, mobile: false });
    await page.send("Page.navigate", { url: `http://127.0.0.1:${gamePort}/index.html` });
    await page.until(`document.readyState === "complete"`, "the game");
    await sleep(1500);
    const botFile = path.join(root, "out/game", `${name}-bot.js`);
    const bot = existsSync(botFile) ? readFileSync(botFile, "utf8") : AUTOPILOT;
    const saved = { view: { ...VIEW } };
    Object.assign(VIEW, GAME_VIEW);
    await begin(name);
    const started = now();
    const tapStart = await page.js(`window.__tap ? window.__tap.start() : performance.now()`).catch(() => 0);
    // a real click first, beside the game: browsers keep a page silent until the visitor has touched it
    await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x: 4, y: 4, button: "left", clickCount: 1 });
    await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: 4, y: 4, button: "left", clickCount: 1 });
    await sleep(300);
    await page.js(`window.__filmOptions = ${JSON.stringify(options)}`);
    await page.js(bot);
    mark("play");
    await sleep(seconds * 1000);
    await shot(name);
    const sound = await page.js(`window.__tap ? window.__tap.stop() : ""`).catch(() => "");
    const played = await page.js(`JSON.stringify((window.__sounds || []).map((s) => ({ t: s.t - ${tapStart}, src: s.src })))`).then(JSON.parse).catch(() => []);
    const lead = take.frames[0]?.t ?? 0;
    const offset = started - take.t0;
    await end();
    Object.assign(VIEW, saved.view);
    // when each sound was played, on the film's clock: the scenes point at them
    if (!SHOTS) {
      const file = path.join(OUT, `${name}.json`);
      const json = JSON.parse(readFileSync(file, "utf8"));
      json.sounds = played.map((s) => ({ t: Number(Math.max(0, s.t / 1000 + offset - lead).toFixed(3)), src: s.src }));
      writeFileSync(file, `${JSON.stringify(json)}\n`);
    }
    // the game's own sound goes into its film: the film starts at its first frame, the recording a moment after the take
    const film = path.join(OUT, `${name}.mp4`);
    if (sound && !SHOTS) {
      const webm = path.join(root, "out/game", `${name}.webm`);
      writeFileSync(webm, Buffer.from(sound, "base64"));
      const silent = path.join(root, "out/game", `${name}-silent.mp4`);
      spawnSync("mv", [film, silent]);
      const delay = Math.max(0, Math.round((offset - lead) * 1000));
      const cut = Math.max(0, lead - offset).toFixed(3);
      const mux = spawnSync("ffmpeg", ["-nostdin", "-y", "-loglevel", "error", "-i", silent, "-ss", cut, "-i", webm, "-filter_complex", `[1:a]adelay=${delay}:all=1,loudnorm=I=-20:TP=-3:LRA=11,apad[a]`, "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", film], { encoding: "utf8" });
      if (mux.status !== 0) { spawnSync("mv", [silent, film]); console.log(`${name}: no sound in the film (${(mux.stderr || "").trim().split("\n").pop()})`); }
      else console.log(`${name}: its sound is in the film (${(Buffer.from(sound, "base64").length / 1024).toFixed(0)} kB recorded)`);
    } else if (!SHOTS) console.log(`${name}: the game made no sound`);
  } finally {
    server.kill();
    await page.send("Emulation.setDeviceMetricsOverride", { width: VIEW.width, height: VIEW.height, deviceScaleFactor: VIEW.scale, mobile: false });
  }
}

/** Takes that are made only when asked for by name: they need a session or a game that the others do not. */
const ON_REQUEST = new Set(["termRialto", "termPlain", "gamePlain", "gameRialto"]);

const TAKES = {
  async termRialto() {
    await filmSession("term-rialto", Number(process.env.FAST_SECONDS) || undefined);
  },
  async termPlain() {
    await filmSession("term-plain");
  },
  async gamePlain() {
    await filmGame("game-plain", process.env.GAME_PLAIN ?? path.join(root, "out/game/take1/plain"), 15);
  },
  async gameRialto() {
    // the title screen, a run with its near misses, and a crash to end on
    await filmGame("game-rialto", process.env.GAME_RIALTO ?? path.join(root, "out/game/take3/rialto"), 29, { titleMs: 3000, crashAfter: 13, endOnCrash: true });
  },

  /** The landing page: it loads, the hero plays, a look down the page, back up and into "Connect an agent". */
  async landing() {
    await page.send("Page.navigate", { url: "about:blank" });
    await sleep(300);
    await begin("landing");
    await page.send("Page.navigate", { url: `${BASE}/` });
    await page.until(`document.querySelector("canvas")?.classList.contains("opacity-100") && !document.body.innerText.includes("OPENING THE MARKET")`, "the hero", 60_000);
    mark("hero");
    await shot("landing-hero");
    await moveTo(1150, 520, 900);
    await sleep(5700);
    mark("scroll");
    await wheel(940, 1500);
    await sleep(1500);
    await shot("landing-video");
    await wheel(600, 1200);
    mark("sides");
    await sleep(2300);
    await shot("landing-sides");
    mark("up");
    await wheel(-1540, 1300);
    await sleep(600);
    mark("cta");
    await click(byText("a", "🤖"), { ms: 800, rest: 350 });
    await page.until(`location.pathname === "/signup"`, "the sign-up page");
    mark("signup");
    await sleep(500);
    await end();
  },

  /** Sign up: three fields and a button. */
  async signup() {
    await goto("/signup?next=/dashboard/agents");
    await page.until(byText("h1", "Create your account"));
    await sleep(600);
    state.password = `${randomBytes(9).toString("base64url")}Aa1`;
    await begin("signup");
    await sleep(700);
    await click(field("Your name"));
    mark("name");
    await type(PERSON.name);
    await click(field("Email"), { ms: 450 });
    mark("email");
    await type(PERSON.email, { each: 45 });
    await click(field("Password"), { ms: 450, at: [0.3, 0.5] });
    mark("password");
    await type(state.password, { each: 40 });
    await sleep(350);
    await shot("signup-filled");
    await click(byText("button", "Create account"), { ms: 600, rest: 300 });
    mark("submit");
    await page.until(`location.pathname === "/dashboard/agents"`, "the dashboard", 30_000);
    await page.until(byText("h1", "Give your agent"));
    mark("dashboard");
    await sleep(900);
    await end();
  },

  /** Create an agent, see its key and the one command, give it money to spend. */
  async agent() {
    await goto("/dashboard/agents");
    await page.until(byText("h1", "Give your agent"));
    await sleep(700);
    const key = new Promise((resolve) => {
      const ids = new Set();
      page.on("Network.responseReceived", (e) => {
        if (e.response.url.endsWith("/api/account/agents") && e.response.status === 201) ids.add(e.requestId);
      });
      page.on("Network.loadingFinished", async (e) => {
        if (!ids.has(e.requestId)) return;
        const body = await page.send("Network.getResponseBody", { requestId: e.requestId });
        resolve(JSON.parse(body.body).apiKey);
      });
    });
    await begin("agent");
    await sleep(600);
    await click(field("Name a new agent"));
    mark("name");
    await clearField();
    await sleep(200);
    await type(PERSON.agent);
    await sleep(250);
    await click(byText("button", "Create agent"), { ms: 500, rest: 250 });
    mark("create");
    await page.until(byText("h2,h3,div,span", "Connect “"), "the key card", 30_000);
    state.agentKey = await key;
    save();
    mark("key");
    await sleep(1700);
    await shot("agent-key");
    // the command, and its copy button
    const copy = `[...document.querySelectorAll("button")].filter((b) => /copy/i.test(b.textContent) && b.getClientRects().length)[1]`;
    await click(copy, { ms: 750, rest: 350 });
    mark("copy");
    await sleep(1500);
    await shot("agent-copied");
    await click(byText("button", "I saved it"), { ms: 700 });
    await sleep(500);
    // money: the account's test dollar goes to the agent
    await click(`[...document.querySelectorAll("label")].find((l) => l.textContent.includes("Amount (USD)"))?.querySelector("input")`, { ms: 700 });
    mark("amount");
    await clearField();
    await type("1", { each: 90 });
    await sleep(250);
    await click(byText("button", "Add from account"), { ms: 500, rest: 250 });
    mark("fund");
    await page.until(`document.body.innerText.includes("Added $1")`, "the money to move", 20_000);
    mark("funded");
    await sleep(2600);
    await shot("agent-funded");
    await end();
  },

  /**
   * Off camera, but real: a shell in a pseudo-terminal, Claude Code inside it, connected with the
   * agent's key and asked for something. scripts/record-terminal.py does the typing and keeps every
   * byte the terminal received; the next take films it.
   */
  async session() {
    if (!state.agentKey) throw new Error("no agent key yet: record the agent take first");
    // let the public devnet node breathe after the dashboard has asked it for balances
    await sleep(20_000);
    const run = spawnSync("python3", [path.join(root, "scripts/record-terminal.py"), CAST], { env: { ...process.env, RIALTO_KEY: state.agentKey, DEMO_BASE: BASE, DEMO_SHOWN_ORIGIN: SHOWN }, encoding: "utf8", timeout: 400_000 });
    if (run.status !== 0) throw new Error(`the terminal session failed: ${(run.stderr || run.stdout).slice(-400)}`);
    console.log(run.stdout.trim());
    const session = JSON.parse(readFileSync(`${CAST}.json`, "utf8"));
    if (!("called" in session.marks) && !("tool" in session.marks)) throw new Error("Claude never called Rialto in the terminal session");
  },

  /**
   * The terminal session, replayed in a terminal emulator and filmed one frame at a time: for each
   * thirtieth of a second, everything the real terminal had received by then is on screen.
   */
  async terminal() {
    const session = JSON.parse(readFileSync(`${CAST}.json`, "utf8"));
    await page.send("Page.navigate", { url: `file://${path.join(root, "scripts/terminal-player.html")}` });
    await page.until(`typeof window.load === "function"`, "the terminal page");
    await page.js(`load(${JSON.stringify(readFileSync(`${CAST}.cast`, "utf8"))})`);
    await sleep(500);
    const dir = path.join(root, "out/demo-frames/terminal-film");
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const frames = Math.ceil(session.seconds * 30);
    const list = [];
    let file = "";
    for (let f = 0; f <= frames; f++) {
      // a new picture only when the terminal received something; otherwise the last one is held
      if ((await page.js(`advance(${f / 30})`)) || !file) {
        file = path.join(dir, `${String(f).padStart(5, "0")}.jpg`);
        const { data } = await page.send("Page.captureScreenshot", { format: "jpeg", quality: 93 });
        writeFileSync(file, Buffer.from(data, "base64"));
      }
      list.push(`file '${file}'\nduration ${(1 / 30).toFixed(5)}`);
    }
    writeFileSync(path.join(dir, "list.txt"), `${list.join("\n")}\nfile '${file}'\n`);
    mkdirSync(OUT, { recursive: true });
    const ff = spawnSync("ffmpeg", ["-nostdin", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", path.join(dir, "list.txt"), "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-crf", "15", "-g", "30", "-movflags", "+faststart", path.join(OUT, "terminal.mp4")], { stdio: "inherit" });
    if (ff.status !== 0) throw new Error("ffmpeg failed for terminal");
    writeFileSync(path.join(OUT, "terminal.json"), `${JSON.stringify({ seconds: session.seconds, view: VIEW, marks: session.marks, cursor: [] })}\n`);
    console.log(`terminal: ${session.seconds.toFixed(1)}s, marks ${Object.keys(session.marks).join(" ")}`);
  },

  /** After the agent has bought something: the overview, down at the list of calls, on the one it just made. */
  async activity() {
    await goto("/dashboard");
    await page.until(byText("h1", "Hi,"));
    const row = `[...document.querySelectorAll("a")].find((a) => a.href.includes("explorer.solana.com"))`;
    await page.until(row, "the call in the dashboard", 20_000);
    state.explorerUrl = await page.js(`(${row}).href`);
    save();
    await sleep(500);
    await begin("activity");
    await sleep(1400);
    mark("overview");
    const p = await where(row);
    mark("calls");
    await sleep(500);
    await moveTo(p.x, p.y, 900);
    mark("transaction");
    await sleep(3200);
    await shot("activity");
    await end();
  },

  /** The same payment on Solana's own explorer: not Rialto's word for it. */
  async explorer() {
    if (!state.explorerUrl) throw new Error("no transaction yet: record the activity take first");
    await page.send("Page.navigate", { url: state.explorerUrl });
    await page.until(`/Signature|Result|Confirmation/.test(document.body.innerText) && /Success|Finalized|Confirmed/i.test(document.body.innerText)`, "the transaction on the explorer", 60_000);
    await sleep(1500);
    await begin("explorer");
    await moveTo(820, 430, 600);
    await sleep(1800);
    mark("page");
    await wheel(260, 1100);
    await sleep(2600);
    await shot("explorer");
    await end();
    // the scene shows the address it was filmed at
    if (!SHOTS) writeFileSync(path.join(OUT, "explorer.json"), `${JSON.stringify({ ...JSON.parse(readFileSync(path.join(OUT, "explorer.json"), "utf8")), url: state.explorerUrl })}\n`);
  },

  /**
   * Off camera: the account links the wallet it wants to be paid at, by signing Rialto's challenge
   * with it. In the product that is a click in Phantom; here the devnet test wallet from the app's
   * .env signs it, because a headless browser has no wallet extension.
   */
  async wallet() {
    const env = readFileSync(path.resolve(root, "../.env"), "utf8");
    const secret = /^SOLANA_TEST_SELLER_SECRET_KEY="?([1-9A-HJ-NP-Za-km-z]+)"?/m.exec(env)?.[1];
    if (!secret) throw new Error("SOLANA_TEST_SELLER_SECRET_KEY is not in the app's .env");
    const bytes = unbase58(secret);
    const address = base58(bytes.subarray(32, 64));
    const key = createPrivateKey({ key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), bytes.subarray(0, 32)]), format: "der", type: "pkcs8" });
    await goto("/dashboard/wallet");
    const post = (url, body) => page.js(`fetch(${JSON.stringify(url)}, { method: "POST", headers: { "content-type": "application/json" }, body: ${JSON.stringify(JSON.stringify(body))} }).then(async (r) => ({ status: r.status, body: await r.json() }))`);
    const challenge = await post("/api/account/wallet/challenge", { address });
    if (challenge.status !== 200) throw new Error(`challenge: ${JSON.stringify(challenge.body)}`);
    const verified = await post("/api/account/wallet/verify", { address, issuedAt: challenge.body.issuedAt, signature: sign(null, Buffer.from(challenge.body.message), key).toString("base64") });
    if (verified.status !== 200) throw new Error(`verify: ${JSON.stringify(verified.body)}`);
    console.log("wallet: linked");
  },

  /** Publish an API: the free example, a price, publish, and there it is in the catalog. */
  async publish() {
    await goto("/dashboard/apis");
    await page.until(byText("button", "⚡ Fill with a free example"));
    await sleep(700);
    await begin("publish");
    await sleep(900);
    await click(byText("button", "⚡ Fill with a free example"), { ms: 800, rest: 300 });
    mark("fill");
    await sleep(900);
    await click(field("API name"), { ms: 600 });
    await clearField();
    await sleep(150);
    await type("Monster Data API", { each: 50 });
    mark("named");
    await sleep(500);
    await shot("publish-filled");
    await click(field("Your price per successful call"), { ms: 800 });
    mark("price");
    await clearField();
    await type("0.004", { each: 110 });
    await sleep(1500);
    await shot("publish-price");
    await click(byText("button", "Publish API"), { ms: 700, rest: 300 });
    mark("publish");
    await page.until(`document.body.innerText.toLowerCase().includes("published") || document.body.innerText.includes("is live")`, "the API to publish", 30_000).catch(() => sleep(2500));
    mark("published");
    await sleep(1500);
    // back up to the list, where it now stands
    await page.until(`document.body.innerText.includes("YOUR APIS (1)") || document.body.innerText.includes("Your APIs (1)")`, "the list", 15_000).catch(() => {});
    await click(byText("div,span,h2,h3", "Your APIs"), { ms: 900, at: [0.2, 3] }).catch(() => wheel(-700, 900));
    mark("listed");
    await sleep(2400);
    await shot("publish-done");
    await end();
  },

  /** The public catalog, with the new API in it. */
  async catalog() {
    await goto("/catalog");
    await page.until(`document.body.innerText.includes("PokéDex") || document.body.innerText.includes("Poke")`, "the catalog", 30_000);
    await sleep(600);
    await begin("catalog");
    await moveTo(900, 520, 700);
    await sleep(900);
    // everything on sale, then the API that was just published, found by name
    await wheel(300, 900);
    await sleep(900);
    mark("list");
    await wheel(-300, 700);
    await click(`document.querySelector('input[type="search"], input[placeholder^="Search"]')`, { ms: 600 });
    await type("monster", { each: 70 });
    mark("found");
    await sleep(2600);
    await shot("catalog");
    await end();
  },

};

// ---- run
const profile = mkdtempSync(path.join(os.tmpdir(), "rialto-demo-"));
const port = 9300 + Math.floor(Math.random() * 400);
const chrome = spawn(CHROME, [
  "--headless=new",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  `--window-size=${VIEW.width},${VIEW.height}`,
  "--hide-scrollbars",
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-extensions",
  "--mute-audio",
  "--autoplay-policy=no-user-gesture-required",
  "--ignore-gpu-blocklist",
  "--enable-gpu",
  "--use-angle=metal",
  "about:blank",
], { stdio: "ignore" });

try {
  let target;
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(250);
    target = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json()).then((l) => l.find((t) => t.type === "page")).catch(() => null);
  }
  if (!target) throw new Error("Chrome did not start");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", reject);
  });
  page = new Page(ws);
  await page.send("Page.enable");
  await page.send("Runtime.enable");
  await page.send("Network.enable");
  await page.send("Emulation.setDeviceMetricsOverride", { width: VIEW.width, height: VIEW.height, deviceScaleFactor: VIEW.scale, mobile: false });
  // no dev-mode badge in the footage, and the public address wherever the page prints its own
  await page.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `(() => {
      const from = ${JSON.stringify(BASE)}, to = ${JSON.stringify(SHOWN)};
      const css = document.createElement("style");
      css.textContent = "nextjs-portal,[data-nextjs-toast],[data-next-badge-root]{display:none!important}";
      const fix = (n) => {
        if (n.nodeType !== 3) return;
        if (n.nodeValue.includes(from)) n.nodeValue = n.nodeValue.replaceAll(from, to);
        // a hint the app only shows on a developer's machine
        if (n.nodeValue.startsWith("You are on localhost") && n.parentElement) n.parentElement.style.display = "none";
      };
      const walk = (n) => { fix(n); for (const c of n.childNodes ?? []) walk(c); };
      addEventListener("DOMContentLoaded", () => {
        document.head.append(css);
        walk(document.body);
        new MutationObserver((list) => list.forEach((m) => { fix(m.target); m.addedNodes.forEach(walk); })).observe(document.body, { subtree: true, childList: true, characterData: true });
      });
    })()`,
  });
  await page.send("Page.addScriptToEvaluateOnNewDocument", { source: AUDIO_TAP });
  page.on("Page.screencastFrame", (e) => {
    void page.send("Page.screencastFrameAck", { sessionId: e.sessionId });
    if (!take) return;
    const file = path.join(take.dir, `${String(take.frames.length).padStart(5, "0")}.jpg`);
    writeFileSync(file, Buffer.from(e.data, "base64"));
    take.frames.push({ t: now() - take.t0, file });
  });

  // a session from an earlier run, so single takes can be redone
  if (state.cookies?.length) await page.send("Network.setCookies", { cookies: state.cookies });
  // warm every route up first: the dev server compiles on first visit, and that is not part of the product
  for (const route of ["/", "/signup", "/dashboard", "/dashboard/agents", "/dashboard/apis", "/catalog"]) await fetch(`${BASE}${route}`).catch(() => {});

  for (const name of Object.keys(TAKES)) {
    if (wanted.length ? !wanted.includes(name) : ON_REQUEST.has(name)) continue;
    await TAKES[name]();
    state.cookies = (await page.send("Network.getCookies", { urls: [BASE] })).cookies;
    save();
  }
} catch (error) {
  console.error(`FAILED${take ? ` in take "${take.name}"` : ""}: ${error.message}`);
  process.exitCode = 1;
} finally {
  chrome.kill();
  await sleep(400);
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch {
    // Chrome can still be letting go of its profile; the OS clears its temp folder anyway
  }
}
