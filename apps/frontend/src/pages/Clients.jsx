import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchClients = async () => {
    try {
      const res = await fetch('/api/clients');
      const data = await res.json();
      if (data.success) setClients(data.clients);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name || !email) return;
    setSubmitting(true);
    
    try {
      await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email })
      });
      setName('');
      setEmail('');
      setShowForm(false);
      fetchClients();
    } catch (err) {
      console.error("Failed to create client", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="page-subtitle">Manage your client relationships.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn btn-primary">
          {showForm ? 'Cancel' : 'Create Client'}
        </button>
      </header>
      
      {showForm && (
        <div className="card" style={{ marginBottom: '2rem', border: '1px solid var(--brand-primary)', boxShadow: '0 0 0 4px rgba(79, 70, 229, 0.1)' }}>
          <h3 style={{ margin: '0 0 1.5rem 0', color: 'var(--text-primary)' }}>New Client</h3>
          <form onSubmit={handleCreate} style={{ display: 'grid', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '500', marginBottom: '0.5rem' }}>Client Name</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  required 
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', boxSizing: 'border-box' }}
                  placeholder="Acme Corp"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '500', marginBottom: '0.5rem' }}>Email Address</label>
                <input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required 
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', boxSizing: 'border-box' }}
                  placeholder="contact@acme.com"
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Saving...' : 'Save Client'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        {loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading clients...</p>
        ) : clients.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No clients found. Click "Create Client" to start.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {clients.map(c => (
              <div key={c.id} className="list-item">
                <Link to={`/clients/${c.id}`} style={{ textDecoration: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-primary)', fontSize: '1.1rem' }}>{c.name}</h4>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{c.email}</span>
                  </div>
                  <span style={{ background: 'var(--bg-active)', color: 'var(--brand-primary)', padding: '0.25rem 0.75rem', borderRadius: '99px', fontSize: '0.8rem', fontWeight: '600' }}>
                    {c.status}
                  </span>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
