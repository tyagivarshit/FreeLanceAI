import { useEffect, useState } from 'react';

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  const [amount, setAmount] = useState('');
  const [clientId, setClientId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchPayments = async () => {
    try {
      const res = await fetch('/api/payments');
      const data = await res.json();
      if (data.success) setPayments(data.items || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!amount || !clientId) return;
    setSubmitting(true);
    
    try {
      await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(amount) * 100, currency: 'USD', clientId })
      });
      setAmount('');
      setClientId('');
      setShowForm(false);
      fetchPayments();
    } catch (err) {
      console.error("Failed to record payment", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">Payments</h1>
          <p className="page-subtitle">Track your incoming payments and invoices.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn btn-primary">
          {showForm ? 'Cancel' : 'Record Payment'}
        </button>
      </header>
      
      {showForm && (
        <div className="card" style={{ marginBottom: '2rem', border: '1px solid var(--brand-primary)', boxShadow: '0 0 0 4px rgba(79, 70, 229, 0.1)' }}>
          <h3 style={{ margin: '0 0 1.5rem 0', color: 'var(--text-primary)' }}>Record Payment</h3>
          <form onSubmit={handleCreate} style={{ display: 'grid', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '500', marginBottom: '0.5rem' }}>Amount (USD)</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={amount} 
                  onChange={(e) => setAmount(e.target.value)} 
                  required 
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', boxSizing: 'border-box' }}
                  placeholder="500.00"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '500', marginBottom: '0.5rem' }}>Client ID</label>
                <input 
                  type="text" 
                  value={clientId} 
                  onChange={(e) => setClientId(e.target.value)} 
                  required 
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', boxSizing: 'border-box' }}
                  placeholder="UUID"
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Saving...' : 'Save Payment'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        {loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading payments...</p>
        ) : payments.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No payments found. Click "Record Payment" to add one.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {payments.map((p, i) => (
              <div key={i} className="list-item">
                <pre>{JSON.stringify(p, null, 2)}</pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
