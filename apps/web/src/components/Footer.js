import React from "react";
export const Footer = () => {
    return (<footer className="landing-footer" role="contentinfo">
      <div className="landing-footer-container">
        <div className="footer-brand">
          <a href="/landing.html" className="brand-logo" aria-label="FreelanceOS Home">
            <span className="logo-mark" aria-hidden="true">
              F
            </span>
            <span className="logo-text">FreelanceOS</span>
          </a>
          <p className="footer-tagline">
            The complete AI operating system for independent freelancers.
          </p>
        </div>

        <div className="footer-links-grid">
          <div className="footer-col">
            <h3 className="footer-col-title">Product</h3>
            <ul className="footer-link-list">
              <li>
                <a href="#features">Features</a>
              </li>
              <li>
                <a href="#how-it-works">How It Works</a>
              </li>
              <li>
                <a href="#pricing">Pricing</a>
              </li>
              <li>
                <a href="#privacy">Privacy &amp; Trust</a>
              </li>
            </ul>
          </div>

          <div className="footer-col">
            <h3 className="footer-col-title">Account</h3>
            <ul className="footer-link-list">
              <li>
                <a href="/login.html">Sign In</a>
              </li>
              <li>
                <a href="/index.html">Create Account</a>
              </li>
              <li>
                <a href="/dashboard.html">Dashboard</a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <p className="copyright">© 2026 FreelanceOS. All rights reserved.</p>
      </div>
    </footer>);
};
