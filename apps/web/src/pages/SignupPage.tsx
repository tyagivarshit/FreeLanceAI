import React, { useState, useMemo } from "react";
import { AuthLayout } from "../layouts/AuthLayout.js";
import { authService } from "../services/authService.js";
import { Button } from "../shared/Button.js";

export const SignupPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorTitle, setErrorTitle] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [successEmail, setSuccessEmail] = useState<string | null>(null);

  const passwordRules = useMemo(() => {
    return {
      length: password.length >= 12,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      digit: /[0-9]/.test(password),
      special: /[^A-Za-z0-9]/.test(password),
    };
  }, [password]);

  const metCount = Object.values(passwordRules).filter(Boolean).length;
  const strengthPercentage = (metCount / 5) * 100;
  const strengthClass =
    metCount <= 2 ? "strength-weak" : metCount <= 4 ? "strength-medium" : "strength-strong";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    setErrorTitle("");

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorTitle("Registration Failed");
      setErrors(["Please fill out all required fields."]);
      return;
    }

    setLoading(true);

    try {
      const result = await authService.signup({ email: trimmedEmail, password });
      if (result.success && result.user) {
        setSuccessEmail(result.user.email);
      } else {
        const title =
          result.code === "DUPLICATE_EMAIL" ? "Account Already Exists" : "Registration Failed";
        const errList = result.errors
          ? result.errors
          : [result.message || "An unexpected error occurred during signup."];
        setErrorTitle(title);
        setErrors(errList);
      }
    } catch (err: any) {
      setErrorTitle("Connection Failed");
      setErrors([
        err.message || "Unable to connect to the server. Please check your internet connection.",
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start managing your freelance business with FreelanceOS"
    >
      {/* Success Panel */}
      {successEmail ? (
        <div id="success-panel" className="success-panel" role="region" aria-live="polite">
          <div className="success-icon" aria-hidden="true">
            ✓
          </div>
          <h2>Verify your email</h2>
          <p id="success-message">
            We've sent a verification link to {successEmail}. Please click the link to activate your
            account.
          </p>
          <div className="success-actions">
            <p className="notice">
              Check your spam folder if you don't receive it within a few minutes.
            </p>
            <a
              href="/login.html"
              className="btn btn-secondary btn-sm"
              style={{ marginTop: "1rem" }}
            >
              Proceed to Login
            </a>
          </div>
        </div>
      ) : (
        /* Main Form */
        <form id="signup-form" onSubmit={handleSubmit} noValidate>
          {errors.length > 0 && (
            <div id="error-alert" className="error-alert" role="alert" aria-live="assertive">
              <div className="error-icon" aria-hidden="true">
                ⚠
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

          <div className="form-group">
            <label htmlFor="email">Email address</label>
            <input
              type="email"
              id="email"
              name="email"
              autoComplete="email"
              required
              aria-required="true"
              placeholder="you@example.com"
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
              name="password"
              autoComplete="new-password"
              required
              aria-required="true"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />

            {/* Password Requirements Checklist */}
            <div className="password-requirements" id="password-requirements">
              <div className="strength-bar-container">
                <div
                  className={`strength-bar ${strengthClass}`}
                  id="strength-bar"
                  style={{ width: `${strengthPercentage}%` }}
                />
              </div>
              <ul>
                <li id="req-length" className={`requirement ${passwordRules.length ? "met" : ""}`}>
                  At least 12 characters
                </li>
                <li
                  id="req-uppercase"
                  className={`requirement ${passwordRules.uppercase ? "met" : ""}`}
                >
                  At least one uppercase letter
                </li>
                <li
                  id="req-lowercase"
                  className={`requirement ${passwordRules.lowercase ? "met" : ""}`}
                >
                  At least one lowercase letter
                </li>
                <li id="req-digit" className={`requirement ${passwordRules.digit ? "met" : ""}`}>
                  At least one number
                </li>
                <li
                  id="req-special"
                  className={`requirement ${passwordRules.special ? "met" : ""}`}
                >
                  At least one special character
                </li>
              </ul>
            </div>
          </div>

          <Button type="submit" id="submit-button" block loading={loading}>
            <span id="button-text">{loading ? "Creating account..." : "Create account"}</span>
          </Button>

          <div className="auth-footer-prompt" style={{ textAlign: "center", marginTop: "1.25rem" }}>
            <span style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
              Already have an account?{" "}
              <a href="/login.html" style={{ color: "var(--primary-400)", fontWeight: 500 }}>
                Sign In
              </a>
            </span>
          </div>
        </form>
      )}
    </AuthLayout>
  );
};
