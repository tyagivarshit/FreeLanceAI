import { useEffect, useState } from 'react';

export default function Billing() {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBilling() {
      try {
        const res = await fetch('/api/billing/subscription');
        if (res.redirected) { window.location.href = res.url; return; }
        if (res.ok) {
          const data = await res.json();
          if (data.success) setSubscription(data.subscription);
        }
      } catch (err) {
        console.error("Failed to load billing", err);
      } finally {
        setLoading(false);
      }
    }
    fetchBilling();
  }, []);

  const handleCheckout = async () => {
    try {
      const res = await fetch('/api/billing/checkout', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePortal = async () => {
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">Billing & Subscription</h1>
          <p className="page-subtitle">Manage your plans and billing history.</p>
        </div>
      </header>
      
      <div className="card">
        <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1.25rem', color: 'var(--text-primary)' }}>Current Plan</h2>
        {loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading subscription details...</p>
        ) : subscription ? (
          <div>
            <div style={{ display: 'grid', gap: '1rem', marginBottom: '2rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Status</label>
                <div style={{ display: 'inline-block', background: 'var(--bg-active)', color: 'var(--brand-primary)', padding: '0.25rem 0.75rem', borderRadius: '99px', fontSize: '0.85rem', fontWeight: '600' }}>{subscription.status}</div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Plan ID</label>
                <div style={{ fontSize: '1rem', color: 'var(--text-primary)', fontWeight: '500' }}>{subscription.planId}</div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Current Period End</label>
                <div style={{ fontSize: '1rem', color: 'var(--text-primary)', fontWeight: '500' }}>{new Date(subscription.currentPeriodEnd).toLocaleDateString()}</div>
              </div>
            </div>
            <button onClick={handlePortal} className="btn btn-secondary">Manage Billing (Stripe Portal)</button>
          </div>
        ) : (
          <div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>You are currently on the Free plan.</p>
            <button onClick={handleCheckout} className="btn btn-primary">Upgrade to Pro</button>
          </div>
        )}
      </div>
    </div>
  );
}
