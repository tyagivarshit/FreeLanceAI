/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useCallback } from "react";
import { AppLayout } from "../layouts/AppLayout.js";
import { billingService } from "../services/billingService.js";
import { Skeleton } from "../shared/Skeleton.js";
import { Button } from "../shared/Button.js";
import { useToast } from "../hooks/useToast.js";
import { Toast } from "../components/Toast.js";
export const BillingPage = () => {
    const [plans, setPlans] = useState([]);
    const [subscription, setSubscription] = useState(null);
    const [currency, setCurrency] = useState("USD");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [checkoutLoading, setCheckoutLoading] = useState(null);
    const [portalLoading, setPortalLoading] = useState(false);
    const { toast, showToast } = useToast();
    // Check URL query parameters for checkout status
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get("checkout") === "success") {
            showToast("Subscription updated successfully!", false);
        }
        else if (params.get("checkout") === "cancel") {
            showToast("Checkout was cancelled. No charges were made.", true);
        }
    }, [window.location.search, showToast]);
    const loadBillingData = useCallback(async (signal) => {
        setLoading(true);
        setError(null);
        try {
            const [plansRes, subRes] = await Promise.all([
                billingService.getPlans(signal),
                billingService.getSubscription(signal),
            ]);
            setPlans(plansRes.plans || []);
            setSubscription(subRes);
        }
        catch (err) {
            if (err.name === "AbortError")
                return;
            setError(err.message || "Failed to load billing information.");
        }
        finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => {
        const controller = new AbortController();
        loadBillingData(controller.signal);
        return () => controller.abort();
    }, [loadBillingData]);
    const handleUpgrade = async (planId) => {
        setCheckoutLoading(planId);
        try {
            const res = await billingService.createCheckout({ planId });
            if (res.success && res.checkoutUrl) {
                window.location.href = res.checkoutUrl;
            }
            else {
                showToast(res.error || "Failed to initialize checkout.", true);
            }
        }
        catch (err) {
            showToast(err.message || "Failed to initialize checkout.", true);
        }
        finally {
            setCheckoutLoading(null);
        }
    };
    const handleManagePortal = async () => {
        setPortalLoading(true);
        try {
            const res = await billingService.createPortal();
            if (res.success && res.portalUrl) {
                window.location.href = res.portalUrl;
            }
            else {
                showToast(res.error || "Failed to open Stripe Customer Portal.", true);
            }
        }
        catch (err) {
            showToast(err.message || "Failed to open Stripe Customer Portal.", true);
        }
        finally {
            setPortalLoading(false);
        }
    };
    const getPriceForCurrency = (prices, curr) => {
        const p = prices.find((item) => item.currency.toUpperCase() === curr.toUpperCase());
        if (p && p.formatted)
            return p.formatted;
        if (p)
            return `${p.currency} ${(p.amountMinor / 100).toFixed(2)}`;
        return "$0.00";
    };
    const formatDate = (isoString) => {
        if (!isoString)
            return "—";
        try {
            return new Date(isoString).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
            });
        }
        catch {
            return "—";
        }
    };
    const currentPlanId = subscription?.planId || "STARTER";
    return (<AppLayout currentPath="/billing.html" breadcrumbTitle="Billing" topbarActions={<div className="billing-currency-selector-wrap">
          <label htmlFor="currency-select" className="currency-label">
            Currency:
          </label>
          <select id="currency-select" className="currency-select" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="USD">USD ($)</option>
            <option value="INR">INR (₹)</option>
            <option value="GBP">GBP (£)</option>
            <option value="EUR">EUR (€)</option>
          </select>
        </div>}>
      <Toast toast={toast}/>

      <section className="welcome-section billing-title-row" aria-label="Billing heading">
        <div>
          <h1 className="welcome-title font-display">Plan &amp; Billing</h1>
          <p className="welcome-subtitle">
            Manage your subscription, monitor AI proposal quotas, and review usage limits.
          </p>
        </div>
      </section>

      {loading ? (<div className="billing-skeleton-container" id="billing-skeleton">
          <Skeleton variant="card" className="billing-hero-skeleton"/>
          <div className="billing-plans-skeleton-grid">
            <Skeleton variant="card" className="plan-card-skeleton"/>
            <Skeleton variant="card" className="plan-card-skeleton"/>
            <Skeleton variant="card" className="plan-card-skeleton"/>
          </div>
        </div>) : error ? (<div className="feed-error-state card-like-error" id="billing-error" role="alert">
          <div className="error-details-row">
            <svg className="icon icon-error-alert" viewBox="0 0 24 24" width="24" height="24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            <div>
              <h2 className="error-card-title">Failed to load billing information</h2>
              <p className="error-card-desc" id="billing-error-msg">
                {error}
              </p>
            </div>
          </div>
          <button className="btn btn-secondary btn-retry-large" id="billing-error-retry" type="button" onClick={() => loadBillingData()}>
            Retry
          </button>
        </div>) : (<div className="billing-content-wrapper" id="billing-content">
          {/* Current Subscription Card */}
          <article className="current-subscription-card" id="subscription-overview">
            <div className="subscription-card-header">
              <div>
                <div className="plan-badge-row">
                  <span className="subscription-plan-title font-display" id="sub-plan-name">
                    {subscription?.planName || `${currentPlanId} Plan`}
                  </span>
                  <span className={`badge badge-${subscription?.status === "active"
                ? "success"
                : subscription?.status === "trialing" || subscription?.source === "TRIAL"
                    ? "trial"
                    : subscription?.status === "past_due"
                        ? "danger"
                        : "primary"}`} id="sub-status-badge">
                    {(subscription?.status || "Free").toUpperCase()}
                  </span>
                  {subscription?.trialDaysRemaining !== null &&
                subscription?.trialDaysRemaining !== undefined && (<span className="badge badge-trial" id="sub-trial-badge">
                        {subscription.trialDaysRemaining} days remaining in trial
                      </span>)}
                </div>
                <p className="subscription-period-desc" id="sub-period-desc">
                  {subscription?.period?.endsAt
                ? `Current period ends on ${formatDate(subscription.period.endsAt)}`
                : "Standard monthly billing cycle"}
                </p>
              </div>

              {subscription?.hasCustomer && (<Button variant="secondary" id="btn-customer-portal" loading={portalLoading} onClick={handleManagePortal} aria-label="Manage billing details in Stripe Customer Portal">
                  Manage Subscription ↗
                </Button>)}
            </div>

            {/* Usage Meters */}
            <div className="subscription-usage-grid" id="subscription-meters">
              <div className="usage-meter-card">
                <div className="meter-label-row">
                  <span className="meter-name">AI Proposals Quota</span>
                  <span className="meter-val" id="meter-proposals-val">
                    {subscription?.limits?.aiProposals?.type === "LIMITED"
                ? `${subscription.usage?.aiProposals ?? 0} / ${subscription.limits.aiProposals.value}`
                : `${subscription?.usage?.aiProposals ?? 0} / ∞`}
                  </span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" id="meter-proposals-fill" style={{
                width: `${subscription?.limits?.aiProposals?.type === "LIMITED" &&
                    subscription.limits.aiProposals.value
                    ? Math.min(100, ((subscription.usage?.aiProposals ?? 0) /
                        subscription.limits.aiProposals.value) *
                        100)
                    : 100}%`,
            }}/>
                </div>
              </div>

              <div className="usage-meter-card">
                <div className="meter-label-row">
                  <span className="meter-name">Daily Job Scans</span>
                  <span className="meter-val" id="meter-scans-val">
                    {subscription?.limits?.jobScans?.type === "LIMITED"
                ? `${subscription.usage?.jobScans ?? 0} / ${subscription.limits.jobScans.value}`
                : `${subscription?.usage?.jobScans ?? 0} / ∞`}
                  </span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" id="meter-scans-fill" style={{
                width: `${subscription?.limits?.jobScans?.type === "LIMITED" &&
                    subscription.limits.jobScans.value
                    ? Math.min(100, ((subscription.usage?.jobScans ?? 0) /
                        subscription.limits.jobScans.value) *
                        100)
                    : 100}%`,
            }}/>
                </div>
              </div>

              <div className="usage-meter-card">
                <div className="meter-label-row">
                  <span className="meter-name">Workspaces</span>
                  <span className="meter-val" id="meter-workspaces-val">
                    {subscription?.limits?.maxWorkspaces?.type === "LIMITED"
                ? `${subscription.usage?.workspaces ?? 1} / ${subscription.limits.maxWorkspaces.value}`
                : "1 / 1"}
                  </span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: "100%" }}/>
                </div>
              </div>
            </div>
          </article>

          {/* Plans Comparison Grid */}
          <section className="billing-plans-section" aria-labelledby="heading-plans">
            <div className="section-header">
              <h2 className="section-title font-display" id="heading-plans">
                Available Subscription Plans
              </h2>
              <p className="section-desc">
                Upgrade or switch plans anytime. Changes take effect immediately.
              </p>
            </div>

            <div className="billing-plans-grid" id="billing-plans-list" role="list">
              {plans.map((plan) => {
                const isCurrent = plan.planId === currentPlanId;
                const isPopular = plan.planId === "PRO";
                const isUpgrading = checkoutLoading === plan.planId;
                const priceFormatted = getPriceForCurrency(plan.prices, currency);
                return (<article key={plan.planId} className={`pricing-card ${isPopular ? "popular" : ""} ${isCurrent ? "current-tier" : ""}`} role="listitem" id={`plan-card-${plan.planId}`}>
                    {isPopular && (<div className="popular-badge">Recommended • 7-Day Free Trial</div>)}
                    <div className="pricing-card-header">
                      <h3 className="plan-name font-display">{plan.name}</h3>
                      <p className="plan-tagline">{plan.description}</p>
                      <div className="plan-price">
                        <span className="price-val">{priceFormatted}</span>
                        <span className="price-period">/ month</span>
                      </div>
                    </div>

                    <ul className="plan-features">
                      {plan.features?.map((feat) => (<li key={feat.featureId}>
                          <span className="check" aria-hidden="true">
                            ✓
                          </span>{" "}
                          {feat.displayName}
                        </li>))}
                    </ul>

                    <div className="pricing-cta">
                      {isCurrent ? (<Button variant="secondary" block disabled>
                          Current Plan
                        </Button>) : (<Button variant={isPopular ? "primary" : "secondary"} block loading={isUpgrading} onClick={() => handleUpgrade(plan.planId)}>
                          {plan.planId === "PRO" ? "Upgrade to Pro" : `Upgrade to ${plan.name}`}
                        </Button>)}
                    </div>
                  </article>);
            })}
            </div>
          </section>
        </div>)}
    </AppLayout>);
};
