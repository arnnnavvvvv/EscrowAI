// Builds the PR verdict — the gate decision and the comment body — from the scenario diffs.

import type { ScenarioDiff, Verdict } from "./types.js";

const BLOCKING: ReadonlySet<ScenarioDiff["classification"]> = new Set([
  "silent-drop",
  "double-process"
]);

/** Human label for a classification. */
function label(c: ScenarioDiff["classification"]): string {
  return {
    "unaffected": "unaffected",
    "behavior-changed": "behaviour changed",
    "silent-drop": "SILENT DROP",
    "double-process": "DOUBLE PROCESS"
  }[c];
}

/** Render one effect as a compact line. */
function effectLine(e: ScenarioDiff["missingInPr"][number]): string {
  const bits = Object.entries(e.detail)
    .map(([k, v]) => `${k} ${v}`)
    .join(", ");
  return `\`${e.kind}\`${bits ? ` (${bits})` : ""}`;
}

/**
 * Assemble the verdict. The gate blocks on any silent-drop or double-process finding; the
 * comment leads with the undeniable version of the failure.
 */
export function buildVerdict(diffs: ScenarioDiff[], context: { title: string; prBranch: string }): Verdict {
  const findings = diffs.filter((d) => d.classification !== "unaffected");
  const blocking = findings.filter((d) => BLOCKING.has(d.classification));
  const gate: Verdict["gate"] = blocking.length > 0 ? "block" : "pass";

  const headline =
    gate === "block"
      ? `EscrowAI is blocking this merge — ${blocking.length} payment behaviour${
          blocking.length === 1 ? "" : "s"
        } would silently break`
      : findings.length > 0
        ? "EscrowAI: payment behaviour changed, but no money-moving effect was lost"
        : "EscrowAI: payment webhook behaviour is unchanged";

  const lines: string[] = [];
  lines.push(`## ${headline}`);
  lines.push("");
  lines.push(
    `Replayed the webhook fixture library against \`${context.prBranch}\` and the base branch in an isolated sandbox. ${diffs.length} scenario${
      diffs.length === 1 ? "" : "s"
    } checked.`
  );
  lines.push("");

  if (blocking.length > 0) {
    lines.push("### What would break");
    for (const d of blocking) {
      lines.push("");
      lines.push(`**${d.title}** — ${label(d.classification)}`);
      lines.push("");
      lines.push(d.narrative);
      if (d.missingInPr.length > 0) {
        lines.push("");
        lines.push("Effects the base branch produced that this PR does not:");
        for (const e of d.missingInPr) lines.push(`- ${effectLine(e)}`);
      }
      if (d.addedInPr.length > 0) {
        lines.push("");
        lines.push("Effects this PR produces that the base branch does not:");
        for (const e of d.addedInPr) lines.push(`- ${effectLine(e)}`);
      }
      if (d.httpMasked) {
        lines.push("");
        lines.push("> Every delivery still returned a success status. Nothing here shows up in logs or metrics.");
      }
    }
    lines.push("");
  }

  const nonBlockingFindings = findings.filter((d) => !BLOCKING.has(d.classification));
  if (nonBlockingFindings.length > 0) {
    lines.push("### Also changed (not blocking)");
    for (const d of nonBlockingFindings) {
      lines.push(`- **${d.title}** — ${d.narrative}`);
    }
    lines.push("");
  }

  const unaffected = diffs.filter((d) => d.classification === "unaffected");
  if (unaffected.length > 0) {
    lines.push("### Unaffected");
    lines.push(unaffected.map((d) => d.title).join(" · "));
    lines.push("");
  }

  if (gate === "block") {
    lines.push("---");
    lines.push(
      "Merge is held until a human reviews the replay diff and approves in the EscrowAI dashboard."
    );
  }

  return { gate, headline, findings, all: diffs, markdown: lines.join("\n") };
}
