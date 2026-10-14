#!/usr/bin/env python3
"""What the agent bought on Rialto while it built the game, read from the platform's own records.

    python3 scripts/game-receipt.py out/game/term-rialto ../prisma/demo.db agent_...

Reads <session>.json for when the session started, lists the agent's settled purchases since then
(out/game/receipt.json) and marks the moment of each one in the session (buy1, buy2, ...), so the
film of the terminal can name them as they happen. Failed attempts are listed apart: they cost nothing.
"""
import json
import sqlite3
import sys

session_path, db_path, agent = sys.argv[1] + ".json", sys.argv[2], sys.argv[3]
session = json.load(open(session_path))
start = session["startedAt"]
end = start + session["marks"]["end"]
rows = sqlite3.connect(db_path).execute(
    "select t.createdAt, t.status, p.name, t.capability, t.amountMicro, t.latencyMs, t.txRef, r.goal, t.error from 'Transaction' t "
    "join Provider p on p.id = t.providerId join Run r on r.id = t.runId where t.agentId = ? and t.createdAt >= ? and t.createdAt <= ? order by t.createdAt",
    (agent, int(start * 1000), int(end * 1000) + 5000),
).fetchall()
bought, failed = [], []
for created, status, provider, capability, micro, latency, tx, goal, error in rows:
    item = {"at": round(created / 1000 - start, 3), "provider": provider, "capability": capability, "usd": micro / 1_000_000, "latencyMs": latency, "tx": tx, "goal": goal}
    (bought if status == "settled" else failed).append(item if status == "settled" else {**item, "status": status, "error": error})
for name in [k for k in session["marks"] if k.startswith("buy")]:
    del session["marks"][name]
for i, item in enumerate(bought):
    session["marks"][f"buy{i + 1}"] = item["at"]
session["bought"] = len(bought)
json.dump(session, open(session_path, "w"))
json.dump({"bought": bought, "failed": failed, "totalUsd": round(sum(b["usd"] for b in bought), 6)}, open(sys.argv[1].rsplit("/", 1)[0] + "/receipt.json", "w"), indent=1)
print(f"{len(bought)} purchases, ${sum(b['usd'] for b in bought):.4f}; {len(failed)} attempts that failed and cost nothing")
for b in bought:
    print(f"  {b['at']:7.1f}s  ${b['usd']:.4f}  {b['provider']:28s} {b['capability']:24s} {b['goal'][:70]}")
for b in failed:
    print(f"  FAILED {b['at']:7.1f}s {b['provider']:28s} {b['status']} {str(b['error'])[:80]}")
