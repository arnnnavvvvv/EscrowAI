// Small shared building blocks — panel shell, status pill, gradient text, status dot.

import type { ReactNode } from "react";

type Tone = "neutral" | "accent" | "pass" | "drop" | "changed";

/** A titled panel with the standard border, gradient fill, and shadow. */
export function Panel({
  title,
  aside,
  children
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      <header className="panel__head">
        <span className="panel__title">{title}</span>
        {aside}
      </header>
      <div className="panel__body">{children}</div>
    </section>
  );
}

/** A compact status pill. */
export function Pill({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`pill${tone === "neutral" ? "" : ` pill--${tone}`}`}>{children}</span>;
}

/** Text filled with the signature accent gradient. */
export function GradientText({ children }: { children: ReactNode }) {
  return <span className="gradient-text">{children}</span>;
}

/** A small status dot; `live` pulses. */
export function Dot({ tone = "neutral", live }: { tone?: Tone; live?: boolean }) {
  const cls = ["dot"];
  if (live) cls.push("dot--live");
  else if (tone === "drop") cls.push("dot--drop");
  else if (tone === "accent") cls.push("dot--accent");
  return <span className={cls.join(" ")} />;
}

/** Map a classification to a pill tone. */
export function classTone(classification: string): Tone {
  if (classification === "unaffected") return "pass";
  if (classification === "behavior-changed") return "changed";
  return "drop";
}
