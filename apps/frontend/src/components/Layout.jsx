import { NavLink, Outlet, useNavigate } from 'react-router-dom';

export default function Layout() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout failed', err);
    } finally {
      navigate('/login');
    }
  };

  return (
    <div className="dashboard-body">
      <aside id="sidebar" className="sidebar" aria-label="Main Navigation">
        <div className="sidebar-header">
          <div className="logo" aria-hidden="true">F</div>
          <span className="brand-name">FreelanceOS</span>
        </div>

        <nav className="sidebar-nav" aria-label="Primary nav" style={{ flex: 1 }}>
          <NavLink to="/dashboard" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-label">Dashboard</span>
          </NavLink>
          
          <NavLink to="/clients" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-label">Clients</span>
          </NavLink>

          <NavLink to="/projects" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-label">Projects</span>
          </NavLink>
          
          <NavLink to="/payments" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-label">Payments</span>
          </NavLink>
          
          <NavLink to="/attachments" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-label">Attachments</span>
          </NavLink>
          
          
          <div className="nav-divider"></div>
          <span style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Setup</span>
          <NavLink to="/prompts" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-label">Prompt Registry</span>
          </NavLink>
          <NavLink to="/memory" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-label">Client Memory</span>
          </NavLink>
          <NavLink to="/policies" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-label">Policy Engine</span>
          </NavLink>
          <div className="nav-divider"></div>

          <NavLink to="/billing" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-label">Billing</span>
          </NavLink>

          <NavLink to="/settings" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-label">Settings</span>
          </NavLink>
        </nav>

        <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)' }}>
          <button 
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              background: 'transparent',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--error, #ef4444)',
              fontWeight: '500',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = '#fef2f2'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      <main id="main-content" className="main-content">
        <header className="top-nav">
          <div className="search-bar">
             <input type="search" placeholder="Search across FreelanceOS..." aria-label="Search" />
          </div>
        </header>
        <div className="content-container">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
