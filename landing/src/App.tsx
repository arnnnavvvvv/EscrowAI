// The landing page — hero with the demo video, the demo-mode replay, how it works, footer.

import { GradientText } from "@escrowai/ui";
import { DemoRun } from "./DemoRun.js";

const REPO = "https://github.com/arnnnavvvvv/EscrowAI";

function Nav() {
  return (
    <nav className="nav">
      <span className="nav__mark">
        <GradientText>Escrow</GradientText>AI
      </span>
      <a className="nav__link" href={REPO} target="_blank" rel="noreferrer">
        GitHub ↗
      </a>
    </nav>
  );
}

function Hero() {
  return (
    <header className="hero">
      <p className="hero__eyebrow">payment-webhook merge gate</p>
      <h1 className="hero__title">
        A <GradientText>200 OK</GradientText> that quietly stopped
        <br /> crediting the payment.
      </h1>
      <p className="hero__lede">
        EscrowAI replays real-shaped webhook events — succeeded, failed, refunded, delivered
        twice, delivered out of order — against <em>both</em> branches of a pull request in an
        isolated sandbox. It diffs what actually happened, not the status code, and blocks
        the merge on anything that would silently stop moving money.
      </p>
      <div className="hero__cta">
        <a className="hero__btn" href="#demo">
          Watch it catch one
        </a>
        <a className="hero__btn hero__btn--ghost" href={REPO} target="_blank" rel="noreferrer">
          Read the code
        </a>
      </div>

      <figure className="hero__video">
        <div className="hero__video-frame" role="img" aria-label="Demo video placeholder">
          <span>demo video</span>
        </div>
      </figure>
    </header>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "01",
      h: "Detect",
      p: "A PR touches a webhook handler — matched by route pattern and file path. EscrowAI reads the diff over GitHub MCP."
    },
    {
      n: "02",
      h: "Replay",
      p: "Base and PR branches boot in separate containers. The fixture library fires at both: single events and multi-step delivery scenarios."
    },
    {
      n: "03",
      h: "Diff",
      p: "Each branch writes an ordered effect log. EscrowAI compares them as a multiset — a money-moving effect that vanished while every delivery still returned 2xx is a silent drop."
    },
    {
      n: "04",
      h: "Gate",
      p: "The verdict lands on the PR in plain English. Merge is held until a human reviews the replay diff and approves in the dashboard."
    }
  ];
  return (
    <section className="how">
      <h2 className="section-title">How it works</h2>
      <div className="how__grid">
        {steps.map((s) => (
          <div className="how__card" key={s.n}>
            <span className="how__n">{s.n}</span>
            <h3 className="how__h">{s.h}</h3>
            <p className="how__p">{s.p}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="footer__line" aria-hidden>
        {Array.from({ length: 40 }).map((_, i) => (
          <span key={i} style={{ animationDelay: `${(i * 0.06).toFixed(2)}s` }} />
        ))}
      </div>
      <div className="footer__row">
        <span>
          <GradientText>Escrow</GradientText>AI
        </span>
        <span className="footer__muted">
          Built for the WeMakeDevs Agent Harness Hackathon · TrueForge
        </span>
        <a href={REPO} target="_blank" rel="noreferrer">
          GitHub ↗
        </a>
      </div>
    </footer>
  );
}

export function App() {
  return (
    <div className="page">
      <Nav />
      <Hero />
      <section id="demo" className="demo-section">
        <h2 className="section-title">A refactor that passes review</h2>
        <p className="section-sub">
          The PR below turns a <code>switch</code> into a lookup table and keys one route
          <code>charge.refund</code> where Stripe sends <code>charge.refunded</code>. Every
          refund still returns 200. Watch the ledger.
        </p>
        <DemoRun />
      </section>
      <HowItWorks />
      <Footer />
    </div>
  );
}
