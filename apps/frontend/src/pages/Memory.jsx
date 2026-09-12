import { useEffect, useState } from 'react';

export default function Memory() {
  const [memoryItems, setMemoryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  const [reference, setReference] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchMemory = async () => {
    try {
      const res = await fetch('/api/memory');
      if (!res.ok) throw new Error('Failed to fetch memory items');
      const data = await res.json();
      if (data.success) setMemoryItems(data.items || []);
    } catch (err) {
      console.error(err);
      alert('Error loading memory: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMemory();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!reference || !content) return;
    setSubmitting(true);
    
    try {
      const res = await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference, metadata: { content } })
      });
      if (!res.ok) { const txt = await res.text(); throw new Error(txt); }
      setReference('');
      setContent('');
      setShowForm(false);
      fetchMemory();
    } catch (err) {
      console.error(err);
      alert('Error saving memory: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">Client Memory</h1>
          <p className="page-subtitle">Manage isolated long-term context for AI interactions.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn btn-primary">
          {showForm ? 'Cancel' : 'Add Memory'}
        </button>
      </header>
      
      {showForm && (
        <div className="card" style={{ marginBottom: '2rem', border: '1px solid var(--brand-primary)', boxShadow: '0 0 0 4px rgba(79, 70, 229, 0.1)' }}>
          <h3 style={{ margin: '0 0 1.5rem 0', color: 'var(--text-primary)' }}>New Memory Entry</h3>
          <form onSubmit={handleCreate} style={{ display: 'grid', gap: '1rem' }}>
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '500', marginBottom: '0.5rem' }}>Memory Reference</label>
                <input 
                  type="text" 
                  value={reference} 
                  onChange={(e) => setReference(e.target.value)} 
                  required 
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', boxSizing: 'border-box' }}
                  placeholder="e.g. client.preferences.ui"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '500', marginBottom: '0.5rem' }}>Memory Content</label>
                <textarea 
                  value={content} 
                  onChange={(e) => setContent(e.target.value)} 
                  required 
                  rows="3"
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', boxSizing: 'border-box' }}
                  placeholder="Client prefers minimalist design with high contrast."
                ></textarea>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Saving...' : 'Save Memory'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        {loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading memory...</p>
        ) : memoryItems.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No memory entries found.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {memoryItems.map((m, i) => (
              <div key={m.id} className="list-item">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0' }}>{m.reference}</h4>
                  <span style={{ fontSize: '0.8rem', background: 'var(--bg-active)', color: 'var(--brand-primary)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>{m.status}</span>
                </div>
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{m.metadata?.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
