import { useEffect, useState } from 'react';

export default function Attachments() {
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  const [filename, setFilename] = useState('');
  const [projectId, setProjectId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchAttachments = async () => {
    try {
      const res = await fetch('/api/attachments');
      const data = await res.json();
      if (data.success) setAttachments(data.items || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttachments();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!filename || !projectId) return;
    setSubmitting(true);
    
    try {
      await fetch('/api/attachments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, mimeType: 'text/plain', description: 'Uploaded file', projectId })
      });
      setFilename('');
      setProjectId('');
      setShowForm(false);
      fetchAttachments();
    } catch (err) {
      console.error("Failed to upload attachment", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">Attachments</h1>
          <p className="page-subtitle">Securely store and manage project files.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn btn-primary">
          {showForm ? 'Cancel' : 'Upload File'}
        </button>
      </header>
      
      {showForm && (
        <div className="card" style={{ marginBottom: '2rem', border: '1px solid var(--brand-primary)', boxShadow: '0 0 0 4px rgba(79, 70, 229, 0.1)' }}>
          <h3 style={{ margin: '0 0 1.5rem 0', color: 'var(--text-primary)' }}>Upload File</h3>
          <form onSubmit={handleCreate} style={{ display: 'grid', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '500', marginBottom: '0.5rem' }}>Filename</label>
                <input 
                  type="text" 
                  value={filename} 
                  onChange={(e) => setFilename(e.target.value)} 
                  required 
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', boxSizing: 'border-box' }}
                  placeholder="contract.pdf"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '500', marginBottom: '0.5rem' }}>Project ID</label>
                <input 
                  type="text" 
                  value={projectId} 
                  onChange={(e) => setProjectId(e.target.value)} 
                  required 
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', boxSizing: 'border-box' }}
                  placeholder="UUID"
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        {loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading attachments...</p>
        ) : attachments.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No attachments found. Click "Upload File" to add one.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {attachments.map((p, i) => (
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
