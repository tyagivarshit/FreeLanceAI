import { useEffect, useState } from 'react';

export default function Policies() {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPolicies = async () => {
    try {
      const res = await fetch('/api/policies');
      if (!res.ok) throw new Error('Failed to fetch policies');
      const data = await res.json();
      if (data.success) setPolicies(data.items || []);
    } catch (err) {
      console.error(err);
      alert('Error loading policies: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">Policy Engine</h1>
          <p className="page-subtitle">Configure rule-sets governing AI interactions.</p>
        </div>
      </header>
      
      <div className="card">
        {loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading policies...</p>
        ) : policies.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No policies defined.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {policies.map((p, i) => (
              <div key={p.id} className="list-item">
                <pre>{JSON.stringify(p, null, 2)}</pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
