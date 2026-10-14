#!/usr/bin/env python3
"""Records a real terminal session for the demo.

A shell runs in a pseudo-terminal and this script types into it the way a person would: the
connect command, then `claude`, then a request. Claude Code, the MCP calls and the payment are
all real; nothing here writes to the screen except the programs themselves.

    RIALTO_KEY=rl_buyer_... python3 scripts/record-terminal.py out/demo-frames/terminal

writes <out>.cast (asciicast v2: every byte the terminal received, with its time) and <out>.json
(the moments worth cutting or narrating on, in seconds). Waits longer than MAX_GAP are shortened:
watching a spinner is not the product.

For a long job (Claude building a whole game) set DEMO_TIMEOUT to the seconds it may take,
DEMO_FOLDER to the folder the shell shows and works in, DEMO_ALLOW=1 so the tools such a job needs
are allowed up front instead of asked for one by one, and DEMO_CONNECT=0 for a session without Rialto.
"""
import codecs
import fcntl
import json
import os
import pty
import random
import re
import select
import shutil
import struct
import subprocess
import sys
import termios
import time

COLS, ROWS = 138, 36
# a long job keeps its real clock, so that what happened elsewhere meanwhile (the purchases, in the
# database) can be placed on it
MAX_GAP = 1.6 if float(os.environ.get("DEMO_TIMEOUT", "180")) <= 200 else 1e9
BASE = os.environ.get("DEMO_BASE", "http://localhost:3100")
# the address shown in place of BASE, so the terminal agrees with the browser footage ("" = show BASE)
SHOWN = os.environ.get("DEMO_SHOWN_ORIGIN", "https://galleriarialto.com")
CONNECT = os.environ.get("DEMO_CONNECT", "1") != "0"
KEY = os.environ["RIALTO_KEY"] if CONNECT else ""
TIMEOUT = float(os.environ.get("DEMO_TIMEOUT", "180"))
ALLOW = os.environ.get("DEMO_ALLOW", "0") == "1"
# the same effort for every session that is compared with another one
EFFORT = f" --effort {os.environ['DEMO_EFFORT']}" if os.environ.get("DEMO_EFFORT") else ""
OUT = sys.argv[1]
ASK = os.environ.get("DEMO_ASK", "I'm building a monster-collecting game. Use rialto to look up the Pokémon pikachu for it, then tell me in three short lines what you got and what the call cost.")
WORKDIR = os.environ.get("DEMO_FOLDER", "/tmp/rialto-demo/monster-game")
NAME = os.path.basename(WORKDIR)
ANSI = re.compile(r"\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[@-_]")

shutil.rmtree(WORKDIR, ignore_errors=True)
os.makedirs(WORKDIR)
if ALLOW:
    # what building a small project takes: files, Rialto, fetching what it bought, looking at it
    os.makedirs(os.path.join(WORKDIR, ".claude"))
    with open(os.path.join(WORKDIR, ".claude", "settings.local.json"), "w") as f:
        json.dump({"permissions": {
            "defaultMode": "acceptEdits",
            "allow": ["Read", "Write", "Edit", "Glob", "Grep", "Bash", "mcp__rialto"],
            # nothing that opens windows on this machine or installs packages
            "deny": ["Bash(open:*)", "Bash(npm:*)", "Bash(npx:*)", "Bash(brew:*)", "Bash(pip:*)", "Bash(pip3:*)"],
        }}, f)
env = {k: v for k, v in os.environ.items() if not k.startswith("CLAUDE")}
env.update(TERM="xterm-256color", COLORTERM="truecolor", RIALTO_KEY=KEY, LANG="en_US.UTF-8")
env.pop("RIALTO_KEY") if not CONNECT else None
# a connection left over from an earlier take would make "mcp add" say it already exists
subprocess.run(["claude", "mcp", "remove", "rialto"], cwd=WORKDIR, env=env, capture_output=True)

pid, fd = pty.fork()
if pid == 0:
    os.chdir(WORKDIR)
    os.execvpe("/bin/zsh", ["zsh", "-f"], env)
fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", ROWS, COLS, 0, 0))

events = []  # (time, text)
decode = codecs.getincrementaldecoder("utf-8")("replace")  # a character split across two reads stays whole
text = ""  # everything shown so far, without the escape codes: what the waits look at
marks = {}
t0 = time.time()
recording = False


def pump(seconds):
    """Read whatever the terminal prints for this long."""
    global text
    end = time.time() + seconds
    while True:
        left = end - time.time()
        if left <= 0:
            return
        ready, _, _ = select.select([fd], [], [], min(left, 0.05))
        if not ready:
            continue
        try:
            data = os.read(fd, 65536)
        except OSError:
            return
        if not data:
            return
        chunk = decode.decode(data)
        if recording and chunk:
            events.append((time.time() - t0, chunk))
        text += ANSI.sub("", chunk)


def wait_for(pattern, timeout, since=0):
    end = time.time() + timeout
    while time.time() < end:
        if re.search(pattern, text[since:]):
            return True
        pump(0.1)
    return False


def quiet(for_seconds, timeout):
    """Wait until nothing has been printed for a while."""
    end = time.time() + timeout
    while time.time() < end:
        before = len(events), len(text)
        pump(for_seconds)
        if (len(events), len(text)) == before:
            return True
    return False


def send(data):
    os.write(fd, data.encode())


def type_out(line, low=0.03, high=0.085):
    for ch in line:
        send(ch)
        pump(random.uniform(low, high) * (2.2 if ch == " " else 1))


def mark(name):
    marks[name] = time.time() - t0


# ---- off the record: a plain prompt, and Claude Code without this machine's personal plugins
pump(1.0)
send(f"unsetopt prompt_sp; PROMPT=$'%F{{114}}{NAME}%f %F{{245}}$%f '; alias claude='command claude --setting-sources project,local{EFFORT}'; clear\n")
pump(1.2)
events.clear()
text = ""
t0 = time.time()
recording = True
send("\x0c")  # ctrl-L: the shell redraws its prompt on a clean screen, and that is the first frame
pump(1.2)

# ---- 1. the connect command, pasted the way it comes from the dashboard
if CONNECT:
    mark("paste")
    send(f'claude mcp add --transport http rialto {BASE}/api/mcp --header "Authorization: Bearer $RIALTO_KEY"')
    pump(1.1)
    send("\r")
    if not wait_for(r"Added \w+ MCP server|already exists", 30):
        sys.exit("the connect command did not finish:\n" + text[-600:])
    mark("added")
    pump(1.4)

# ---- 2. Claude Code
mark("claude")
type_out("claude", 0.07, 0.13)
pump(0.35)
send("\r")
quiet(1.5, 40)
if re.search(r"trust\s*this\s*folder", text, re.I):
    # the safety check for a folder Claude Code has not seen: move down to "Yes, I trust this folder"
    mark("trust")
    pump(1.0)
    send("\x1b[B")
    pump(0.5)
    send("\r")
    quiet(1.5, 40)
mark("ready")
pump(0.7)

# ---- 3. the request
start = len(text)
mark("ask")
type_out(ASK, 0.022, 0.05)
pump(0.6)
mark("sent")
send("\r")

# ---- 4. let it work; say yes when it asks whether it may do something
allowed = 0
bought = 0
handled = len(text)
deadline = time.time() + TIMEOUT
DONE = r"(Worked|Cooked|Baked|Brewed|Crunched|Churned|Saut\w+|Cogitated|Crafted|Pondered|Simmered|Stewed|Whisked|Mulled)\s*for\s*\d+"
last_len, last_change = len(text), time.time()
finished = False
while time.time() < deadline:
    pump(0.25)
    if len(text) != last_len:
        last_len, last_change = len(text), time.time()
    fresh = text[handled:]
    if "tool" not in marks and re.search(r"rialto\s*-|Called\s*rialto|Calling\s*rialto|execute_service", text[start:]):
        mark("tool")
    if "called" not in marks and re.search(r"Called\s*rialto", text[start:]):
        mark("called")
    # every purchase leaves its moment, so the film can point at them
    seen = len(re.findall(r"rialto\s*-\s*Execute\s*goal|rialto\s*-\s*execute_service", text[start:]))
    while bought < seen:
        bought += 1
        marks[f"buy{bought}"] = time.time() - t0
    if re.search(r"Do\s*you\s*want\s*to\s*(proceed|make|create|allow)|don.?t\s*ask\s*again|Allow\s*this", fresh):
        if "prompted" not in marks:
            mark("prompted")
        pump(1.1)
        send("\r")
        allowed += 1
        marks[f"allow{allowed}"] = time.time() - t0
        pump(0.6)
        handled = len(text)
        last_len, last_change = len(text), time.time()
        continue
    # while Claude works its spinner keeps printing; a screen that stays still means it has handed back
    still = time.time() - last_change
    if TIMEOUT <= 200:
        if re.search(DONE, text[start:]) or ("tool" in marks and re.search(r"\$0\.00\d", text[start:]) and quiet(3.0, 3.5)):
            finished = True
            break
    elif still > 8 and time.time() - (t0 + marks["sent"]) > 25:
        finished = True
        break
if not finished:
    print("WARNING: stopped at the time limit, Claude may not have finished", file=sys.stderr)
mark("answered")
if TIMEOUT > 200:
    # the screen was already still for a while; the moment it stopped is when the answer was complete
    marks["answered"] = max(marks["sent"], last_change - t0)
pump(3.0 if TIMEOUT > 200 else 7.0)
mark("end")
recording = False

send("/exit\r")
pump(1.5)
try:
    os.kill(pid, 9)
except OSError:
    pass
subprocess.run(["claude", "mcp", "remove", "rialto"], cwd=WORKDIR, env=env, capture_output=True)

# ---- the address on screen: the public one, wherever the local one was printed
if SHOWN and SHOWN != BASE:
    needle, merged = BASE, []
    for t, data in events:
        # a chunk that ends in the middle of the address is joined to the next one first
        if merged and any(merged[-1][1].endswith(needle[:n]) for n in range(1, len(needle))):
            merged[-1] = (merged[-1][0], merged[-1][1] + data)
        else:
            merged.append((t, data))
    events = [(t, data.replace(needle, SHOWN)) for t, data in merged]

# ---- write it out, with the long waits shortened
squeezed = []
shift = 0.0
last = 0.0
moved = dict(marks)
for t, data in events:
    gap = t - last
    if gap > MAX_GAP:
        cut = gap - MAX_GAP
        for name, at in marks.items():
            if at >= t:
                moved[name] -= cut
        shift += cut
    last = t
    squeezed.append((t - shift, data))
total = marks["end"] - shift

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT + ".cast", "w") as f:
    f.write(json.dumps({"version": 2, "width": COLS, "height": ROWS}) + "\n")
    for t, data in squeezed:
        if t <= total:
            f.write(json.dumps([round(t, 4), "o", data]) + "\n")
with open(OUT + ".json", "w") as f:
    json.dump({"seconds": round(total, 3), "cols": COLS, "rows": ROWS, "marks": {k: round(max(0, v), 3) for k, v in moved.items()}, "allowed": allowed, "bought": bought, "finished": finished, "worked": round(marks["answered"] - marks["sent"], 1), "startedAt": round(t0, 3)}, f)
with open(OUT + ".txt", "w") as f:
    f.write(text)
print(f"terminal: {total:.1f}s ({marks['end']:.1f}s real), worked {marks['answered'] - marks['sent']:.0f}s, permission asked {allowed}x, Rialto purchases seen {bought}, finished {finished}")
