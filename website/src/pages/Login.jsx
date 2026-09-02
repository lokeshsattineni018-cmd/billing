import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { EyeIcon, EyeOffIcon } from '../components/Icons';
import logoImg from '../assets/logo.png';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Pre-warm the serverless backend function and DB connection pool while user is on login screen
    fetch('/api/health').catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Login failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card fade-in">
        <div className="login-brand" style={{ textAlign: 'center', marginBottom: '28px' }}>
          <img
            src={logoImg}
            alt="VIJAYA DURGA AGENCIES Logo"
            style={{
              width: '90px',
              height: '90px',
              borderRadius: '50%',
              objectFit: 'cover',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.1)',
              border: 'none',
              marginBottom: '12px',
            }}
          />
          <h1 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0b5394', letterSpacing: '0.5px', lineHeight: '1.2' }}>
            VIJAYA DURGA AGENCIES
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '4px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
            Invoice & Billing Portal
          </p>
        </div>

        {error && (
          <div
            style={{
              background: '#fef2f2',
              border: '1.5px solid #f87171',
              borderRadius: '8px',
              padding: '12px 16px',
              color: '#991b1b',
              fontSize: '0.85rem',
              fontWeight: 700,
              marginBottom: '20px',
              textAlign: 'center',
            }}
          >
            {error}
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 700 }}>Username or Email</label>
            <input
              type="text"
              className="form-input form-input-lg"
              placeholder="Enter username or email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 700 }}>Password</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input form-input-lg"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingRight: '44px', width: '100%' }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748b',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOffIcon size={20} color="#0b5394" /> : <EyeIcon size={20} color="#64748b" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-large"
            style={{ width: '100%', marginTop: '8px', background: '#0b5394', fontWeight: 800 }}
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
