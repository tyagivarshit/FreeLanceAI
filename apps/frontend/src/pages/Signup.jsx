import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Login.css';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.success) {
        // Typically after signup, it might log you in automatically, 
        // or require email verification. Let's redirect to dashboard if session exists,
        // otherwise to login. The backend signup API issues a cookie if successful.
        navigate('/dashboard');
      } else {
        setError(data.error || 'Signup failed. Please try again.');
      }
    } catch (err) {
      setError('An error occurred during signup. Please try again.');
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
            <h1 className="login-title">Create an account</h1>
            <p className="login-subtitle">Get started with your FreelanceOS workspace.</p>
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

          <form onSubmit={handleSignup}>
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
                placeholder="Create a secure password"
                required 
                minLength={8}
              />
            </div>

            <button type="submit" className="login-button" disabled={loading}>
              {loading ? 'Creating account...' : 'Sign up'}
            </button>
          </form>

          <div className="auth-footer">
            Already have an account? <Link to="/login">Log in</Link>
          </div>
        </div>
      </div>

      <div className="login-brand-section">
        <div className="brand-shape-1"></div>
        <div className="brand-shape-2"></div>
        <div className="brand-content">
          <div className="brand-glass-card">
            <p className="brand-quote">"The ultimate platform for scaling your freelance business to the next level."</p>
            <p className="brand-author">— Join FreelanceOS</p>
          </div>
        </div>
      </div>
    </div>
  );
}
