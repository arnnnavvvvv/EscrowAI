// The effect log — the contract EscrowAI observes. Every side effect the handler performs is appended here in order.

import { appendFileSync, readFileSync, existsSync } from "node:fs";

// Where the ordered effect log is written. EscrowAI reads this file (or GET /__effects) to
// see what the handler actually did, independent of the HTTP status it returned.
const logPath = process.env.EFFECTS_LOG_PATH ?? "/tmp/sample-target-effects.log";

const inMemory = [];

// Record one side effect. `kind` matches EscrowAI's vocabulary: ledger.credit, ledger.debit,
// refund.issue, notification.send. `amount` is in the smallest currency unit.
export function recordEffect(kind, detail) {
  const entry = {
    seq: inMemory.length + 1,
    kind,
    at: new Date().toISOString(),
    ...detail
  };
  inMemory.push(entry);
  try {
    appendFileSync(logPath, JSON.stringify(entry) + "\n");
  } catch {
    // The log file is a convenience mirror; the in-memory list and /__effects are authoritative.
  }
  return entry;
}

// The full ordered effect list since boot.
export function allEffects() {
  return inMemory.slice();
}

// Load any effects a previous process wrote to the log file (used when the container restarts mid-scenario).
export function hydrateFromDisk() {
  if (!existsSync(logPath)) return;
  for (const line of readFileSync(logPath, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      inMemory.push(JSON.parse(line));
    } catch {
      // skip a corrupt line rather than crash on boot
    }
  }
}
