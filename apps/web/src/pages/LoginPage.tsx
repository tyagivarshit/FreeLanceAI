/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from "react";
import { AuthLayout } from "../layouts/AuthLayout.js";
import { authService } from "../services/authService.js";
import { Button } from "../shared/Button.js";

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorTitle, setErrorTitle] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [successUser, setSuccessUser] = useState<any>(null);
  const [verificationSuccess, setVerificationSuccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("verified") === "true") {
      setVerificationSuccess(true);
    } else if (params.get("verifyError")) {
      const errorMsg = params.get("message") || "Email verification link is invalid or expired.";
      setErrorTitle("Email Verification Failed");
      setErrors([errorMsg]);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    setErrorTitle("");

    const trimmedEmail = email.trim();
    const errs: string[] = [];

    if (!trimmedEmail) {
      errs.push("Email address is required.");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errs.push("Please enter a valid email address.");
    }

    if (!password) {
      errs.push("Password is required.");
    }

    if (errs.length > 0) {
      setErrorTitle("Validation failed");
      setErrors(errs);
      return;
    }

    setLoading(true);

    try {
      const result = await authService.login({ email: trimmedEmail, password });
      if (result.success && result.user) {
        setSuccessUser(result.user);
        setTimeout(() => {
          window.location.href = "/dashboard.html";
        }, 800);
      } else {
        const msg = result.message || "An unexpected error occurred.";
        switch (result.code) {
          case "ACCOUNT_LOCKED":
            setErrorTitle("Account Locked");
            setErrors([msg]);
            break;
          case "PENDING_VERIFICATION":
            setErrorTitle("Verification Pending");
            setErrors([msg]);
            break;
          case "ACCOUNT_SUSPENDED":
            setErrorTitle("Account Suspended");
            setErrors([msg]);
            break;
          case "ACCOUNT_DISABLED":
            setErrorTitle("Account Disabled");
            setErrors([msg]);
            break;
          case "MAX_SESSIONS_EXCEEDED":
            setErrorTitle("Concurrent Sessions Exceeded");
            setErrors([msg]);
            break;
          case "INVALID_CREDENTIALS":
            setErrorTitle("Authentication Failure");
            setErrors(["Invalid email or password."]);
            break;
          default:
            setErrorTitle("Authentication Failure");
            setErrors([msg]);
            break;
        }
      }
    } catch (err: any) {
      const code = err?.code;
      const msg = err?.message || "An unexpected error occurred.";
      switch (code) {
        case "ACCOUNT_LOCKED":
          setErrorTitle("Account Locked");
          setErrors([msg]);
          break;
        case "PENDING_VERIFICATION":
          setErrorTitle("Verification Pending");
          setErrors([msg]);
          break;
        case "ACCOUNT_SUSPENDED":
          setErrorTitle("Account Suspended");
          setErrors([msg]);
          break;
        case "ACCOUNT_DISABLED":
          setErrorTitle("Account Disabled");
          setErrors([msg]);
          break;
        case "MAX_SESSIONS_EXCEEDED":
          setErrorTitle("Concurrent Sessions Exceeded");
          setErrors([msg]);
          break;
        case "INVALID_CREDENTIALS":
          setErrorTitle("Authentication Failure");
          setErrors(["Invalid email or password."]);
          break;
        default:
          if (err?.statusCode && err.statusCode < 500) {
            setErrorTitle("Authentication Failure");
            setErrors([msg]);
          } else {
            setErrorTitle("Network Error");
            setErrors([
              err.message || "Could not connect to the authentication server. Please try again.",
            ]);
          }
          break;
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Log in to your FreelanceOS workspace">
      {/* Verification Success Banner */}
      {verificationSuccess && (
        <div
          id="verification-success-banner"
          style={{
            backgroundColor: "rgba(35, 134, 54, 0.15)",
            border: "1px solid #238636",
            color: "#3fb950",
            padding: "12px 16px",
            borderRadius: "8px",
            marginBottom: "20px",
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <span style={{ fontWeight: "bold", fontSize: "16px" }}>✓</span>
          <span>Email verified successfully! You can now log in to your account.</span>
        </div>
      )}

      {/* Accessible Error Alert */}
      {errors.length > 0 && (
        <div
          id="error-alert"
          className="error-alert"
          role="region"
          aria-live="assertive"
          aria-label="Error details"
        >
          <div className="error-icon" aria-hidden="true">
            ✕
          </div>
          <div className="error-content">
            <h3 id="error-title">{errorTitle}</h3>
            <ul id="error-list">
              {errors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Success Panel */}
      {successUser ? (
        <div id="success-panel" className="success-panel" role="region" aria-live="polite">
          <div className="success-icon" aria-hidden="true">
            ✓
          </div>
          <h2>Authentication Successful</h2>
          <p id="success-message">
            Welcome back! You have successfully established a secure session as {successUser.email}.
            Redirecting to dashboard...
          </p>
        </div>
      ) : (
        /* Login Form */
        <form id="login-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="email">Work Email</label>
            <input
              type="email"
              id="email"
              placeholder="name@company.com"
              required
              autoComplete="email"
              aria-required="true"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              placeholder="••••••••••••"
              required
              autoComplete="current-password"
              aria-required="true"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <Button type="submit" id="submit-button" block loading={loading}>
            <span id="button-text">{loading ? "Verifying..." : "Log in"}</span>
          </Button>

          <div className="auth-footer-prompt" style={{ textAlign: "center", marginTop: "1.25rem" }}>
            <span style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
              Don't have an account?{" "}
              <a href="/index.html" style={{ color: "var(--primary-400)", fontWeight: 500 }}>
                Sign Up
              </a>
            </span>
          </div>
        </form>
      )}
    </AuthLayout>
  );
};

