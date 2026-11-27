import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { EyeIcon, EyeOffIcon } from '../components/Icons';
import logoImg from '../assets/logo.png';

export default function Login() {
  const { login } = useAuth();
  const { lang, toggleLang, t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Quietly pre-warm the serverless backend function and DB connection pool while user is on login screen
    fetch('/api/health').catch(() => { });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      // Prefetch primary operational screens into browser cache immediately after login
      import('./NewBill');
      import('./BillHistory');
    } catch (err) {
      const fallback = lang === 'te' ? 'లాగిన్ విఫలమైంది. దయచేసి మళ్ళీ ప్రయత్నించండి' : 'Login failed. Please try again.';
      const msg = err.response?.data?.error || err.response?.data?.message || err.message || fallback;
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page" style={{ background: '#f7f8fa' }}>
      <div className="login-card fade-in" style={{ border: '1px solid rgba(16, 42, 67, 0.10)', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
          <button
            type="button"
            onClick={toggleLang}
            style={{
              padding: '6px 12px',
              fontSize: '0.8rem',
              fontWeight: 600,
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              color: '#0b5394',
              cursor: 'pointer',
              minHeight: '40px',
            }}
          >
            {lang === 'en' ? 'తెలుగు' : 'English'}
          </button>
        </div>

        <div className="login-brand" style={{ textAlign: 'center', marginBottom: '20px' }}>
          <img
            src={logoImg}
            alt="Vijaya Durga Agencies Logo"
            width={80}
            height={80}
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              objectFit: 'cover',
              border: '1px solid rgba(16, 42, 67, 0.12)',
              marginBottom: '12px',
            }}
          />
          <h1 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#0b5394', lineHeight: '1.2', margin: 0 }}>
            {t('VIJAYA DURGA AGENCIES') || 'VIJAYA DURGA AGENCIES'}
          </h1>
          <p style={{ color: '#52606d', fontSize: '0.84rem', marginTop: '4px', fontWeight: 500 }}>
            {lang === 'te' ? 'ఇన్‌వాయిస్ & బిల్లింగ్ పోర్టల్' : 'Invoice & Billing Portal'}
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
            <label htmlFor="login-email" className="form-label u-fw-semibold" >
              {lang === 'te' ? 'యూజర్ నేమ్ లేదా ఇమెయిల్' : 'Username or Email'}
            </label>
            <input
              id="login-email"
              name="username"
              type="text"
              autoComplete="username"
              className="form-input form-input-lg"
              placeholder={lang === 'te' ? 'యూజర్ నేమ్ లేదా ఇమెయిల్ నమోదు చేయండి' : 'Enter username or email'}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-password" className="form-label u-fw-semibold" >
              {lang === 'te' ? 'పాస్‌వర్డ్' : 'Password'}
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                className="form-input form-input-lg"
                placeholder={lang === 'te' ? 'పాస్‌వర్డ్ నమోదు చేయండి' : 'Enter password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingRight: '52px', width: '100%' }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? (lang === 'te' ? 'పాస్‌వర్డ్ దాచు' : 'Hide password') : (lang === 'te' ? 'పాస్‌వర్డ్ చూపు' : 'Show password')}
                aria-pressed={showPassword}
                style={{
                  position: 'absolute',
                  right: '4px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#52606d',
                  minWidth: '48px',
                  minHeight: '48px',
                  padding: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title={showPassword ? (lang === 'te' ? 'పాస్‌వర్డ్ దాచు' : 'Hide password') : (lang === 'te' ? 'పాస్‌వర్డ్ చూపు' : 'Show password')}
              >
                {showPassword ? <EyeOffIcon size={20} color="#0b5394" /> : <EyeIcon size={20} color="#52606d" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-large"
            style={{ width: '100%', marginTop: '8px', background: '#0b5394', fontWeight: 600 }}
            disabled={loading}
          >
            {loading ? (lang === 'te' ? 'లాగిన్ అవుతోంది...' : 'Signing in...') : (lang === 'te' ? 'లాగిన్ అవ్వండి' : 'Sign In')}
          </button>
        </form>
      </div>
    </main>
  );
}
