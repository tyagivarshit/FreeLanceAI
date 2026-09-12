import { useEffect, useState } from 'react';

export default function Settings() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch('/api/settings/profile');
        if (res.redirected) { window.location.href = res.url; return; }
        if (res.ok) {
          const data = await res.json();
          if (data.success) setProfile(data.profile);
        }
      } catch (err) {
        console.error("Failed to load settings", err);
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

  return (
    <div>
      <header className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage your account and preferences.</p>
        </div>
      </header>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div className="card">
          <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1.25rem', color: 'var(--text-primary)' }}>Profile Information</h2>
          {loading ? (
            <p style={{ color: 'var(--text-muted)' }}>Loading profile...</p>
          ) : profile ? (
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Name</label>
                <div style={{ fontSize: '1rem', color: 'var(--text-primary)', fontWeight: '500' }}>{profile.name || 'Not provided'}</div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Email</label>
                <div style={{ fontSize: '1rem', color: 'var(--text-primary)', fontWeight: '500' }}>{profile.email}</div>
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--error)' }}>Could not load profile information.</p>
          )}
        </div>

        <div className="card">
          <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1.25rem', color: 'var(--text-primary)' }}>Security</h2>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="btn btn-secondary">Change Password</button>
            <button className="btn btn-primary">Setup MFA</button>
          </div>
        </div>
      </div>
    </div>
  );
}
