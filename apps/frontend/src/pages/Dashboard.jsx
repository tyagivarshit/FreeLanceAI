import { useEffect, useState } from 'react';

export default function Dashboard() {
  const [data, setData] = useState(null);
  
  useEffect(() => {
    // Mock fetch for dashboard metrics
    setData({
      activeClients: 12,
      activeProjects: 5,
      revenue: 4500
    });
  }, []);

  if (!data) return <p>Loading dashboard...</p>;

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Overview of your FreelanceOS workspace.</p>
        </div>
      </header>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
        <div className="card">
          <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Clients</h3>
          <p style={{ margin: 0, fontSize: '2.5rem', fontWeight: '700', color: 'var(--text-primary)' }}>{data.activeClients}</p>
        </div>
        <div className="card">
          <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Projects</h3>
          <p style={{ margin: 0, fontSize: '2.5rem', fontWeight: '700', color: 'var(--text-primary)' }}>{data.activeProjects}</p>
        </div>
        <div className="card">
          <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Revenue (MRR)</h3>
          <p style={{ margin: 0, fontSize: '2.5rem', fontWeight: '700', color: 'var(--brand-primary)' }}>${data.revenue}</p>
        </div>
      </div>
    </div>
  );
}
