import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import NewBill from './pages/NewBill';
import BillHistory from './pages/BillHistory';
import BillDetail from './pages/BillDetail';
import CustomerLedger from './pages/CustomerLedger';
import CustomerDirectory from './pages/CustomerDirectory';
import Reports from './pages/Reports';
import ActivityLog from './pages/ActivityLog';
import Settings from './pages/Settings';
import { DashboardIcon, PlusIcon, InvoiceIcon, TrendingUpIcon, SettingsIcon, LogoutIcon, DownloadIcon } from './components/Icons';
import logoImg from './assets/logo.png';
import './index.css';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <div className="spinner" style={{ minHeight: '100vh' }}></div>;
  if (!user) return <Navigate to="/login" replace />;

  return children;
}

function Sidebar({ onInstall }) {
  const { user, logout } = useAuth();
  const { lang, toggleLang, t } = useLanguage();

  const isAdmin = user?.role === 'admin';

  const navItems = [
    { path: '/', label: t('dashboard'), icon: <DashboardIcon size={18} /> },
    { path: '/new-bill', label: t('newInvoice'), icon: <PlusIcon size={18} /> },
    { path: '/bills', label: t('invoiceHistory'), icon: <InvoiceIcon size={18} /> },
    ...(isAdmin
      ? [
          { path: '/reports', label: 'Sales Reports', icon: <TrendingUpIcon size={18} /> },
          { path: '/customers', label: 'Customers Directory', icon: <TrendingUpIcon size={18} /> },
          { path: '/ledger', label: t('customerLedger'), icon: <TrendingUpIcon size={18} /> },
          { path: '/activity-log', label: 'Activity Log', icon: <SettingsIcon size={18} /> },
          { path: '/settings', label: t('settings'), icon: <SettingsIcon size={18} /> },
        ]
      : []),
  ];

  return (
    <aside className="sidebar desktop-only-sidebar">
      {/* Brand Header */}
      <div className="sidebar-brand" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '20px 18px 18px 18px' }}>
        <img
          src={logoImg}
          alt="VIJAYA DURGA AGENCIES Logo"
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            objectFit: 'cover',
            border: '2px solid #0b5394',
            boxShadow: '0 4px 12px rgba(11, 83, 148, 0.2)',
          }}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 style={{ fontSize: '0.96rem', fontWeight: 900, color: '#0b5394', letterSpacing: '-0.3px', lineHeight: '1.2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            VIJAYA DURGA
          </h1>
          <p style={{ fontSize: '0.66rem', color: '#64748b', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: 800 }}>
            AGENCIES • BILLING
          </p>
        </div>
      </div>

      {/* Modern Language Switcher Pill */}
      <div style={{ padding: '10px 14px 4px 14px' }}>
        <button
          type="button"
          onClick={toggleLang}
          style={{
            width: '100%',
            padding: '7px 12px',
            fontSize: '0.78rem',
            fontWeight: 800,
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: '#0b5394',
            transition: 'all 0.2s ease',
          }}
        >
          <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>Language</span>
          <span style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: '6px', color: '#0b5394' }}>
            {lang === 'en' ? 'తెలుగు' : 'English'}
          </span>
        </button>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon-box">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Permanent Install App Button on Desktop */}
      <div style={{ padding: '8px 14px' }}>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ width: '100%', padding: '9px 12px', fontSize: '0.8rem', background: '#ffffff', border: '1.5px solid #0b5394', color: '#0b5394', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: '8px', fontWeight: 800 }}
          onClick={onInstall}
        >
          <DownloadIcon size={14} color="#0b5394" /> {t('installApp')}
        </button>
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="user-avatar" style={{ background: '#0b5394', color: '#ffffff', fontWeight: 900, borderRadius: '8px' }}>
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="user-info">
            <div className="user-name" style={{ fontWeight: 800, fontSize: '0.84rem' }}>{user?.name || 'User'}</div>
            <div className="user-role" style={{ fontSize: '0.7rem', fontWeight: 700, color: '#0b5394', textTransform: 'uppercase' }}>{user?.role || 'staff'}</div>
          </div>
        </div>
        <button className="logout-btn" onClick={logout} style={{ borderRadius: '8px', fontWeight: 700 }}>
          <LogoutIcon size={15} /> {t('signOut')}
        </button>
      </div>
    </aside>
  );
}

function AppLayout() {
  const [installPrompt, setInstallPrompt] = useState(window.deferredInstallPrompt || null);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const { user, logout } = useAuth();
  const { lang, toggleLang, t } = useLanguage();
  const navigate = useNavigate();

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (window.deferredInstallPrompt) {
      setInstallPrompt(window.deferredInstallPrompt);
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      window.deferredInstallPrompt = e;
      setInstallPrompt(e);
    };

    const handlePWAInstallable = () => {
      if (window.deferredInstallPrompt) {
        setInstallPrompt(window.deferredInstallPrompt);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('pwa-installable', handlePWAInstallable);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('pwa-installable', handlePWAInstallable);
    };
  }, []);

  const handleInstallApp = async () => {
    const promptEvent = installPrompt || window.deferredInstallPrompt;
    if (promptEvent) {
      promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === 'accepted') {
        window.deferredInstallPrompt = null;
        setInstallPrompt(null);
      }
    } else {
      setShowInstallGuide(true);
    }
  };

  const isIOS = typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

  return (
    <div className="app-layout">
      {/* Clean Fixed Mobile Top Header */}
      <header className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => navigate('/')}>
          <img
            src={logoImg}
            alt="Logo"
            style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
          />
          <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0b5394' }}>VIJAYA DURGA</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Mobile Language Switcher */}
          <button
            type="button"
            onClick={toggleLang}
            style={{
              padding: '5px 8px',
              fontSize: '0.74rem',
              fontWeight: 800,
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              color: '#0b5394',
            }}
          >
            {lang === 'en' ? 'తెలుగు' : 'English'}
          </button>

          <button
            className="btn btn-secondary btn-sm"
            style={{ padding: '5px 8px', fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: '4px', background: '#ffffff', border: '1px solid #0b5394', color: '#0b5394', borderRadius: '6px', fontWeight: 700 }}
            onClick={handleInstallApp}
          >
            <DownloadIcon size={13} color="#0b5394" /> {t('installApp')}
          </button>

          <button
            className="btn btn-ghost btn-sm"
            style={{ padding: '6px', color: '#64748b' }}
            onClick={() => navigate('/settings')}
            title={t('settings')}
          >
            <SettingsIcon size={17} />
          </button>

          <button
            className="btn btn-ghost btn-sm"
            style={{ padding: '6px', color: '#ef4444' }}
            onClick={logout}
            title={t('signOut')}
          >
            <LogoutIcon size={17} color="#ef4444" />
          </button>
        </div>
      </header>

      {/* Desktop Sidebar */}
      <Sidebar onInstall={handleInstallApp} />

      {/* Main Content Area */}
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/new-bill" element={<NewBill />} />
          <Route path="/bills" element={<BillHistory />} />
          <Route path="/bills/:id" element={<BillDetail />} />
          {isAdmin && <Route path="/reports" element={<Reports />} />}
          {isAdmin && <Route path="/customers" element={<CustomerDirectory />} />}
          {isAdmin && <Route path="/ledger" element={<CustomerLedger />} />}
          {isAdmin && <Route path="/activity-log" element={<ActivityLog />} />}
          {isAdmin && <Route path="/settings" element={<Settings />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Clean Mobile Bottom Navigation Bar */}
      <nav className="mobile-bottom-nav">
        <NavLink to="/" end className={({ isActive }) => `mobile-bottom-tab ${isActive ? 'active' : ''}`}>
          <DashboardIcon size={20} />
          <span>{t('dashboard')}</span>
        </NavLink>
        <NavLink to="/new-bill" className={({ isActive }) => `mobile-bottom-tab ${isActive ? 'active' : ''}`}>
          <div className="mobile-add-btn">
            <PlusIcon size={22} color="#ffffff" />
          </div>
          <span>{t('newInvoice')}</span>
        </NavLink>
        <NavLink to="/bills" className={({ isActive }) => `mobile-bottom-tab ${isActive ? 'active' : ''}`}>
          <InvoiceIcon size={20} />
          <span>{t('invoiceHistory')}</span>
        </NavLink>
        {isAdmin && (
          <NavLink to="/ledger" className={({ isActive }) => `mobile-bottom-tab ${isActive ? 'active' : ''}`}>
            <TrendingUpIcon size={20} />
            <span>{t('customerLedger')}</span>
          </NavLink>
        )}
      </nav>

      {/* Install App Helper Modal */}
      {showInstallGuide && (
        <div className="modal-backdrop" onClick={() => setShowInstallGuide(false)}>
          <div className="modal-content fade-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <img src={logoImg} alt="App Icon" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Install App on Phone</h3>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowInstallGuide(false)}>✕</button>
            </div>

            <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              {isIOS ? (
                <div>
                  <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                    📱 On iPhone / Safari:
                  </p>
                  <ol style={{ paddingLeft: '20px', margin: 0 }}>
                    <li style={{ marginBottom: '6px' }}>Tap the <strong>Share</strong> button (box with upward arrow) in your browser bar.</li>
                    <li style={{ marginBottom: '6px' }}>Scroll down and tap <strong>"Add to Home Screen"</strong> (➕).</li>
                    <li>Tap <strong>"Add"</strong> in the top right.</li>
                  </ol>
                </div>
              ) : (
                <div>
                  <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                    📱 On Android / Chrome:
                  </p>
                  <ol style={{ paddingLeft: '20px', margin: 0 }}>
                    <li style={{ marginBottom: '6px' }}>Tap the <strong>3 dots (⋮)</strong> menu in Chrome.</li>
                    <li style={{ marginBottom: '6px' }}>Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.</li>
                    <li>Confirm by tapping <strong>"Install"</strong>.</li>
                  </ol>
                </div>
              )}
            </div>

            <button
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '16px', padding: '10px' }}
              onClick={() => setShowInstallGuide(false)}
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LanguageProvider>
          <Routes>
            <Route path="/login" element={<LoginWrapper />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            />
          </Routes>
        </LanguageProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

function LoginWrapper() {
  const { user } = useAuth();
  if (user) return <Navigate to="/" replace />;
  return <Login />;
}
