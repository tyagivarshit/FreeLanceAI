import React, { useState } from "react";

export const Navbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="landing-header" role="banner">
      <div className="landing-header-container">
        <a href="/landing.html" className="brand-logo" aria-label="FreelanceOS Home">
          <span className="logo-mark" aria-hidden="true">
            F
          </span>
          <span className="logo-text">FreelanceOS</span>
        </a>

        {/* Desktop Navigation */}
        <nav
          className={`landing-nav ${mobileMenuOpen ? "nav-open" : ""}`}
          id="main-nav"
          aria-label="Main Navigation"
        >
          <ul className="nav-links" role="menubar">
            <li role="none">
              <a
                href="#features"
                className="nav-link"
                role="menuitem"
                onClick={() => setMobileMenuOpen(false)}
              >
                Features
              </a>
            </li>
            <li role="none">
              <a
                href="#how-it-works"
                className="nav-link"
                role="menuitem"
                onClick={() => setMobileMenuOpen(false)}
              >
                How It Works
              </a>
            </li>
            <li role="none">
              <a
                href="#pricing"
                className="nav-link"
                role="menuitem"
                onClick={() => setMobileMenuOpen(false)}
              >
                Pricing
              </a>
            </li>
            <li role="none">
              <a
                href="#privacy"
                className="nav-link"
                role="menuitem"
                onClick={() => setMobileMenuOpen(false)}
              >
                Privacy
              </a>
            </li>
            <li role="none">
              <a
                href="#faq"
                className="nav-link"
                role="menuitem"
                onClick={() => setMobileMenuOpen(false)}
              >
                FAQ
              </a>
            </li>
          </ul>
        </nav>

        {/* Header Action CTAs */}
        <div className="header-actions">
          <a href="/login.html" className="btn btn-secondary nav-login-btn">
            Sign In
          </a>
          <a href="/index.html" className="btn btn-primary nav-signup-btn">
            Get Started Free
          </a>
          <button
            id="mobile-menu-toggle"
            className="mobile-menu-btn"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
            aria-controls="main-nav"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <span className="menu-bar" aria-hidden="true" />
            <span className="menu-bar" aria-hidden="true" />
            <span className="menu-bar" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
};
