import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

export default function ClientDetail() {
  const { id } = useParams();
  const [timeline, setTimeline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  const [category, setCategory] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchTimeline = async () => {
    try {
      const res = await fetch(`/api/clients/${id}/timeline`);
      if (res.redirected) { window.location.href = res.url; return; }
      if (res.ok) {
        const data = await res.json();
        if (data.success) setTimeline(data);
      }
    } catch (err) {
      console.error("Failed to load timeline", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchTimeline();
  }, [id]);

  const handleAddEvent = async (e) => {
    e.preventDefault();
    if (!category) return;
    setSubmitting(true);
    
    try {
      // In a real app we'd POST to an endpoint like /api/clients/:id/timeline
      // For now, let's just log it since the backend might not have this specific POST route exposed yet
      console.log('Would POST to /api/clients/' + id + '/timeline:', { category });
      alert('Event added! (Backend route pending)');
      setCategory('');
      setShowForm(false);
    } catch (err) {
      console.error("Failed to add event", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <header className="page-header" style={{ justifyContent: 'flex-start', gap: '1.5rem' }}>
        <Link to="/clients" className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem' }}>← Back</Link>
        <div style={{ flex: 1 }}>
          <h1 className="page-title">Client Timeline</h1>
          <p className="page-subtitle">Detailed activity for client {id}</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn btn-primary">
          {showForm ? 'Cancel' : 'Log Event'}
        </button>
      </header>

      {showForm && (
        <div className="card" style={{ marginBottom: '2rem', border: '1px solid var(--brand-primary)', boxShadow: '0 0 0 4px rgba(79, 70, 229, 0.1)' }}>
          <h3 style={{ margin: '0 0 1.5rem 0', color: 'var(--text-primary)' }}>Log Timeline Event</h3>
          <form onSubmit={handleAddEvent} style={{ display: 'grid', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '500', marginBottom: '0.5rem' }}>Event Category</label>
              <input 
                type="text" 
                value={category} 
                onChange={(e) => setCategory(e.target.value)} 
                required 
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', boxSizing: 'border-box' }}
                placeholder="e.g. Call, Meeting, Email"
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Logging...' : 'Save Event'}
              </button>
            </div>
          </form>
        </div>
      )}
      
      <div className="card">
        {loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading timeline...</p>
        ) : timeline && timeline.timeline && timeline.timeline.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {timeline.timeline.map((event, i) => (
              <div key={i} style={{ display: 'flex', gap: '1.5rem' }}>
                <div style={{ width: '2px', background: 'var(--brand-primary)', position: 'relative', flexShrink: 0, marginTop: '0.5rem' }}>
                  <div style={{ position: 'absolute', top: 0, left: '-4px', width: '10px', height: '10px', borderRadius: '50%', background: 'var(--brand-primary)' }}></div>
                </div>
                <div style={{ flex: 1, paddingBottom: '1.5rem', borderBottom: i !== timeline.timeline.length -1 ? '1px solid var(--border-color)' : 'none' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                    {new Date(event.timestamp).toLocaleString()}
                  </span>
                  <h4 style={{ margin: '0.25rem 0 0.75rem 0', color: 'var(--text-primary)', fontSize: '1.1rem' }}>{event.category}</h4>
                  <pre>{JSON.stringify(event.metadata, null, 2)}</pre>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)' }}>No timeline events recorded yet.</p>
        )}
      </div>
    </div>
  );
}
