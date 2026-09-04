import React, { useState } from "react";
import { PublicLayout } from "../layouts/PublicLayout.js";

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    id: "faq-ans-1",
    question: "How does AI job matching work?",
    answer:
      "FreelanceOS extracts key requirements, tech stacks, and budget constraints from job posts, then computes a multi-factor compatibility score against your skills and experience profile.",
  },
  {
    id: "faq-ans-2",
    question: "Does FreelanceOS work with Upwork and LinkedIn?",
    answer:
      "Yes. Our Manifest V3 Chrome Extension seamlessly connects your active browser sessions to capture job postings directly from Upwork and LinkedIn in real time.",
  },
  {
    id: "faq-ans-3",
    question: "What is included in the Pro 7-Day Free Trial?",
    answer:
      "You receive full access to all Pro tier features—including unlimited matches, 50 AI proposals, Client Brain insights, and extension sync—for 7 days without upfront commitment.",
  },
  {
    id: "faq-ans-4",
    question: "What does Client Brain do?",
    answer:
      "Client Brain synthesizes communication records, past project scopes, and notes to deliver actionable summaries, relationship health scores, and tactical next-step recommendations.",
  },
  {
    id: "faq-ans-5",
    question: "What are the AI proposal generation limits?",
    answer:
      "The Free Starter tier includes 5 AI proposals per month. The Pro tier provides 50 proposals per month, with custom high-volume allocations available on Enterprise.",
  },
];

export const LandingPage: React.FC = () => {
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  const toggleFaq = (id: string) => {
    setExpandedFaq(expandedFaq === id ? null : id);
  };

  return (
    <PublicLayout>
      {/* Hero Section */}
      <section id="hero" className="landing-hero" aria-labelledby="hero-title">
        <div className="hero-container">
          <div className="hero-badge">
            <span className="badge-dot" aria-hidden="true" />
            <span>Next-Generation Freelance Intelligence</span>
          </div>
          <h1 id="hero-title" className="hero-title">
            The AI Operating System for High-Growth Freelancers
          </h1>
          <p className="hero-subtitle">
            Automate client discovery, rank high-paying Upwork and LinkedIn opportunities with
            precision AI matching, and craft winning proposals in seconds.
          </p>

          <div className="hero-cta-group">
            <a href="/index.html" className="btn btn-primary btn-lg" id="hero-primary-cta">
              Get Started Free
            </a>
            <a href="/login.html" className="btn btn-secondary btn-lg" id="hero-secondary-cta">
              Sign In
            </a>
          </div>

          <div className="hero-trust-highlights">
            <div className="trust-item">
              <span className="trust-icon" aria-hidden="true">
                ✓
              </span>
              <span>7-Day Free Pro Trial</span>
            </div>
            <div className="trust-item">
              <span className="trust-icon" aria-hidden="true">
                ✓
              </span>
              <span>No Credit Card Required</span>
            </div>
            <div className="trust-item">
              <span className="trust-icon" aria-hidden="true">
                ✓
              </span>
              <span>100% Privacy-Safe Workspace</span>
            </div>
          </div>

          {/* Product Preview Visual */}
          <div className="hero-preview-wrapper" aria-hidden="true">
            <div className="preview-card">
              <div className="preview-header">
                <div className="window-dots">
                  <span className="dot red" />
                  <span className="dot yellow" />
                  <span className="dot green" />
                </div>
                <span className="preview-title">FreelanceOS Match Center</span>
              </div>
              <div className="preview-content">
                <div className="preview-stat-card">
                  <span className="stat-label">Compatibility Score</span>
                  <span className="stat-val">94% Fit</span>
                </div>
                <div className="preview-match-row">
                  <div className="match-info">
                    <span className="match-role">Senior Full-Stack TypeScript Architect</span>
                    <span className="match-meta">Upwork • Fixed $4,500 • Verified Client</span>
                  </div>
                  <span className="badge badge-high">High Priority</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Four Core Product Pillars */}
      <section
        id="features"
        className="landing-section landing-features"
        aria-labelledby="features-title"
      >
        <div className="section-container">
          <div className="section-header">
            <span className="section-kicker">Core Capabilities</span>
            <h2 id="features-title" className="section-title">
              Built for Every Stage of Your Freelance Pipeline
            </h2>
            <p className="section-desc">
              From sourcing opportunities to long-term client retention, FreelanceOS streamlines
              your workflow with targeted intelligence.
            </p>
          </div>

          <div className="features-grid">
            <article className="feature-card">
              <div className="feature-icon-wrapper" aria-hidden="true">
                🎯
              </div>
              <h3 className="feature-card-title">AI Job Matching</h3>
              <p className="feature-card-desc">
                Connect your Upwork and LinkedIn pipelines with our Chrome extension. Evaluate
                opportunities with deterministic skill coverage, budget alignment, and ranked fit
                scores.
              </p>
            </article>

            <article className="feature-card">
              <div className="feature-icon-wrapper" aria-hidden="true">
                🧠
              </div>
              <h3 className="feature-card-title">Client Brain Intelligence</h3>
              <p className="feature-card-desc">
                Understand client history, communication styles, and past project dynamics. Client
                Brain uncovers actionable risks, relationship summaries, and tailored next steps.
              </p>
            </article>

            <article className="feature-card">
              <div className="feature-icon-wrapper" aria-hidden="true">
                ✍️
              </div>
              <h3 className="feature-card-title">Proposal &amp; Scope Intelligence</h3>
              <p className="feature-card-desc">
                Generate structured, high-converting proposals tailored to each job's explicit
                requirements. Analyze deliverables, calculate timeline estimates, and communicate
                with authority.
              </p>
            </article>

            <article className="feature-card">
              <div className="feature-icon-wrapper" aria-hidden="true">
                ⚡
              </div>
              <h3 className="feature-card-title">Unified Global Search</h3>
              <p className="feature-card-desc">
                Instant keyboard-driven search (<kbd>Ctrl+K</kbd> or <kbd>/</kbd>) across all your
                Clients, Jobs, Match records, and Timeline activity events in milliseconds.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section
        id="how-it-works"
        className="landing-section landing-how-it-works"
        aria-labelledby="how-it-works-title"
      >
        <div className="section-container">
          <div className="section-header">
            <span className="section-kicker">Simple 3-Step Workflow</span>
            <h2 id="how-it-works-title" className="section-title">
              How FreelanceOS Works
            </h2>
            <p className="section-desc">
              A frictionless loop designed to help you spend less time searching and more time
              delivering high-value work.
            </p>
          </div>

          <div className="workflow-steps">
            <div className="step-card">
              <div className="step-number" aria-hidden="true">
                1
              </div>
              <h3 className="step-title">Ingest</h3>
              <p className="step-desc">
                Sync job posts directly from Upwork and LinkedIn using the lightweight Manifest V3
                Chrome extension or manual feed.
              </p>
            </div>

            <div className="step-divider" aria-hidden="true">
              →
            </div>

            <div className="step-card">
              <div className="step-number" aria-hidden="true">
                2
              </div>
              <h3 className="step-title">Match &amp; Analyze</h3>
              <p className="step-desc">
                AI algorithms score budget alignment, verify skill overlap, and analyze client
                history with deep risk assessment.
              </p>
            </div>

            <div className="step-divider" aria-hidden="true">
              →
            </div>

            <div className="step-card">
              <div className="step-number" aria-hidden="true">
                3
              </div>
              <h3 className="step-title">Win Clients</h3>
              <p className="step-desc">
                Generate tailored proposals, respond to inquiries through Reply Studio, and track
                client delivery milestones effortlessly.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Transparent Pricing Section */}
      <section
        id="pricing"
        className="landing-section landing-pricing"
        aria-labelledby="pricing-title"
      >
        <div className="section-container">
          <div className="section-header">
            <span className="section-kicker">Transparent Pricing</span>
            <h2 id="pricing-title" className="section-title">
              Plans Designed for Freelancers at Every Stage
            </h2>
            <p className="section-desc">
              Start free today and upgrade as your freelance revenue expands. No hidden fees.
            </p>
          </div>

          <div className="pricing-grid">
            <article className="pricing-card starter-card">
              <div className="pricing-card-header">
                <h3 className="plan-name">Starter</h3>
                <p className="plan-tagline">
                  Essential intelligence for freelancers getting started.
                </p>
                <div className="plan-price">
                  <span className="price-val">$0</span>
                  <span className="price-period">Free forever</span>
                </div>
              </div>
              <ul className="plan-features">
                <li>
                  <span className="check" aria-hidden="true">
                    ✓
                  </span>{" "}
                  5 job matches per day
                </li>
                <li>
                  <span className="check" aria-hidden="true">
                    ✓
                  </span>{" "}
                  5 AI proposals per month
                </li>
                <li>
                  <span className="check" aria-hidden="true">
                    ✓
                  </span>{" "}
                  Basic Unified Search
                </li>
                <li>
                  <span className="check" aria-hidden="true">
                    ✓
                  </span>{" "}
                  Standard platform support
                </li>
              </ul>
              <div className="pricing-cta">
                <a href="/index.html" className="btn btn-secondary btn-block">
                  Get Started Free
                </a>
              </div>
            </article>

            <article className="pricing-card pro-card popular">
              <div className="popular-badge">Most Popular • 7-Day Free Trial</div>
              <div className="pricing-card-header">
                <h3 className="plan-name">Pro</h3>
                <p className="plan-tagline">
                  Complete automation for serious independent consultants.
                </p>
                <div className="plan-price">
                  <span className="price-val">$29</span>
                  <span className="price-period">/ month</span>
                </div>
              </div>
              <ul className="plan-features">
                <li>
                  <span className="check" aria-hidden="true">
                    ✓
                  </span>{" "}
                  <strong>Unlimited</strong> job matches
                </li>
                <li>
                  <span className="check" aria-hidden="true">
                    ✓
                  </span>{" "}
                  <strong>50</strong> AI proposals per month
                </li>
                <li>
                  <span className="check" aria-hidden="true">
                    ✓
                  </span>{" "}
                  Full Client Brain intelligence
                </li>
                <li>
                  <span className="check" aria-hidden="true">
                    ✓
                  </span>{" "}
                  Chrome extension sync (Upwork &amp; LinkedIn)
                </li>
                <li>
                  <span className="check" aria-hidden="true">
                    ✓
                  </span>{" "}
                  Deep match score breakdowns &amp; risk alerts
                </li>
                <li>
                  <span className="check" aria-hidden="true">
                    ✓
                  </span>{" "}
                  Priority AI processing speed
                </li>
              </ul>
              <div className="pricing-cta">
                <a href="/index.html" className="btn btn-primary btn-block">
                  Start 7-Day Free Trial
                </a>
              </div>
            </article>

            <article className="pricing-card enterprise-card">
              <div className="pricing-card-header">
                <h3 className="plan-name">Enterprise</h3>
                <p className="plan-tagline">Custom scale for top-tier agencies and studios.</p>
                <div className="plan-price">
                  <span className="price-val">Custom</span>
                  <span className="price-period">volume</span>
                </div>
              </div>
              <ul className="plan-features">
                <li>
                  <span className="check" aria-hidden="true">
                    ✓
                  </span>{" "}
                  <strong>Unlimited</strong> AI proposals
                </li>
                <li>
                  <span className="check" aria-hidden="true">
                    ✓
                  </span>{" "}
                  Dedicated AI model capacity
                </li>
                <li>
                  <span className="check" aria-hidden="true">
                    ✓
                  </span>{" "}
                  Multi-seat team sharing
                </li>
                <li>
                  <span className="check" aria-hidden="true">
                    ✓
                  </span>{" "}
                  Custom integrations &amp; exports
                </li>
                <li>
                  <span className="check" aria-hidden="true">
                    ✓
                  </span>{" "}
                  Dedicated account manager &amp; SLA
                </li>
              </ul>
              <div className="pricing-cta">
                <a href="/index.html" className="btn btn-secondary btn-block">
                  Contact Sales
                </a>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* Privacy & Trust Section */}
      <section
        id="privacy"
        className="landing-section landing-privacy"
        aria-labelledby="privacy-title"
      >
        <div className="section-container">
          <div className="section-header">
            <span className="section-kicker">Security &amp; Privacy</span>
            <h2 id="privacy-title" className="section-title">
              Privacy-First &amp; Secure by Design
            </h2>
            <p className="section-desc">
              Your business data, client notes, and proposals belong exclusively to you.
            </p>
          </div>

          <div className="privacy-highlights-grid">
            <div className="privacy-card">
              <div className="privacy-icon" aria-hidden="true">
                🔒
              </div>
              <h3 className="privacy-card-title">Strict Tenant Isolation</h3>
              <p className="privacy-card-desc">
                Every query, match, and client note is cryptographically scoped to your account.
                Cross-tenant access is impossible by design.
              </p>
            </div>

            <div className="privacy-card">
              <div className="privacy-icon" aria-hidden="true">
                🛡️
              </div>
              <h3 className="privacy-card-title">Zero PII Tracking</h3>
              <p className="privacy-card-desc">
                We do not sell your data or deploy invasive third-party tracking pixels. Analytics
                are privacy-safe and aggregated.
              </p>
            </div>

            <div className="privacy-card">
              <div className="privacy-icon" aria-hidden="true">
                💼
              </div>
              <h3 className="privacy-card-title">Client Data Confidentiality</h3>
              <p className="privacy-card-desc">
                Your client budgets, private negotiations, and proprietary scopes are protected with
                enterprise-grade encryption.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Accordion Section */}
      <section id="faq" className="landing-section landing-faq" aria-labelledby="faq-title">
        <div className="section-container">
          <div className="section-header">
            <span className="section-kicker">Got Questions?</span>
            <h2 id="faq-title" className="section-title">
              Frequently Asked Questions
            </h2>
            <p className="section-desc">
              Everything you need to know about getting started with FreelanceOS.
            </p>
          </div>

          <div className="faq-accordion" role="region" aria-label="FAQ Accordion">
            {FAQ_ITEMS.map((item, idx) => {
              const isExpanded = expandedFaq === item.id;
              return (
                <div key={item.id} className="faq-item">
                  <button
                    className="faq-question"
                    aria-expanded={isExpanded}
                    aria-controls={item.id}
                    id={`faq-q-${idx + 1}`}
                    onClick={() => toggleFaq(item.id)}
                  >
                    <span>{item.question}</span>
                    <span className="faq-icon" aria-hidden="true">
                      {isExpanded ? "−" : "+"}
                    </span>
                  </button>
                  <div
                    id={item.id}
                    className={`faq-answer ${isExpanded ? "" : "hidden"}`}
                    role="region"
                    aria-labelledby={`faq-q-${idx + 1}`}
                  >
                    <p>{item.answer}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section
        id="final-cta"
        className="landing-section landing-final-cta"
        aria-labelledby="final-cta-title"
      >
        <div className="section-container">
          <div className="final-cta-card">
            <h2 id="final-cta-title" className="final-cta-title">
              Ready to Accelerate Your Freelance Pipeline?
            </h2>
            <p className="final-cta-subtitle">
              Join high-performing independent professionals scaling their client operations with
              FreelanceOS.
            </p>
            <div className="final-cta-actions">
              <a href="/index.html" className="btn btn-primary btn-lg">
                Start Your Free Trial
              </a>
              <a href="/login.html" className="btn btn-secondary btn-lg">
                Sign In to Workspace
              </a>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
};
