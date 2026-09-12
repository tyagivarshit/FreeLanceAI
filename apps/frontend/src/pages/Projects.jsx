import { useEffect, useState } from 'react';

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  // Form state
  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (data.success) setProjects(data.items || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!title || !clientId) return;
    setSubmitting(true);
    
    try {
      await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description: "New project", clientId })
      });
      setTitle('');
      setClientId('');
      setShowForm(false);
      fetchProjects();
    } catch (err) {
      console.error("Failed to create project", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">Manage and track your active projects.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn btn-primary">
          {showForm ? 'Cancel' : 'Create Project'}
        </button>
      </header>
      
      {showForm && (
        <div className="card" style={{ marginBottom: '2rem', border: '1px solid var(--brand-primary)', boxShadow: '0 0 0 4px rgba(79, 70, 229, 0.1)' }}>
          <h3 style={{ margin: '0 0 1.5rem 0', color: 'var(--text-primary)' }}>New Project</h3>
          <form onSubmit={handleCreate} style={{ display: 'grid', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '500', marginBottom: '0.5rem' }}>Project Title</label>
                <input 
                  type="text" 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)} 
                  required 
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', boxSizing: 'border-box' }}
                  placeholder="Website Redesign"
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
                {submitting ? 'Saving...' : 'Save Project'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        {loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading projects...</p>
        ) : projects.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No projects found. Click "Create Project" to start.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {projects.map((p, i) => (
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
