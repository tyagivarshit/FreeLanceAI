import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Login.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.success) {
        navigate('/dashboard');
      } else {
        setError(data.error || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      setError('An error occurred during login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-form-section">
        <div className="login-form-wrapper">
          <div className="login-logo">
            <div className="login-logo-mark">F</div>
            FreelanceOS
          </div>
          
          <div className="login-header">
            <h1 className="login-title">Welcome back</h1>
            <p className="login-subtitle">Enter your credentials to access your workspace.</p>
          </div>

          {error && (
            <div className="login-error">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="login-input-group">
              <label className="login-label">Email address</label>
              <input 
                type="email" 
                className="login-input" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                placeholder="name@example.com"
                required 
              />
            </div>
            
            <div className="login-input-group">
              <label className="login-label">Password</label>
              <input 
                type="password" 
                className="login-input" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                placeholder="••••••••"
                required 
              />
            </div>

            <button type="submit" className="login-button" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="auth-footer">
            Don't have an account? <Link to="/signup">Sign up</Link>
          </div>
        </div>
      </div>

      <div className="login-brand-section">
        <div className="brand-shape-1"></div>
        <div className="brand-shape-2"></div>
        <div className="brand-content">
          <div className="brand-glass-card">
            <p className="brand-quote">"FreelanceOS has transformed how we manage our entire client lifecycle."</p>
            <p className="brand-author">— Industry Leader</p>
          </div>
        </div>
      </div>
    </div>
  );
}
