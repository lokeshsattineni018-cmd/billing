import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import NewBill from './pages/NewBill';
import BillHistory from './pages/BillHistory';
import BillDetail from './pages/BillDetail';
import CustomerLedger from './pages/CustomerLedger';
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

function Sidebar({ isOpen, onClose, onInstall }) {
  const { user, logout } = useAuth();

  const isOwnerOrAdmin = user?.role === 'owner' || user?.role === 'admin';

  const navItems = [
    { path: '/', label: 'Dashboard', icon: <DashboardIcon size={18} /> },
    { path: '/new-bill', label: 'New Invoice', icon: <PlusIcon size={18} /> },
    { path: '/bills', label: 'Invoice History', icon: <InvoiceIcon size={18} /> },
    ...(isOwnerOrAdmin
      ? [{ path: '/ledger', label: 'Customer Ledger', icon: <TrendingUpIcon size={18} /> }]
      : []),
    { path: '/settings', label: 'Settings', icon: <SettingsIcon size={18} /> },
  ];

  return (
    <>
      <div className={`sidebar-overlay ${isOpen ? 'visible' : ''}`} onClick={onClose}></div>
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-brand" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '24px 16px 20px 16px' }}>
          <img
            src={logoImg}
            alt="VIJAYA DURGA AGENCIES Logo"
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              objectFit: 'cover',
              border: '2px solid rgba(255, 255, 255, 0.25)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
              marginBottom: '10px',
            }}
          />
          <h1 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#ffffff', letterSpacing: '0.5px', lineHeight: '1.2' }}>
            VIJAYA DURGA
          </h1>
          <p style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            AGENCIES • BILLING
          </p>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              onClick={onClose}
            >
              <span className="nav-icon-box">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Permanent Install App Button */}
        <div style={{ padding: '12px 14px' }}>
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: '100%', padding: '11px 12px', fontSize: '0.85rem', background: 'linear-gradient(135deg, #0b5394, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: '8px', fontWeight: 700 }}
            onClick={() => {
              onClose();
              setTimeout(() => onInstall(), 150);
            }}
          >
            <DownloadIcon size={16} /> Install App on Phone
          </button>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="user-avatar">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="user-info">
              <div className="user-name">{user?.name || 'User'}</div>
              <div className="user-role">{user?.role || 'staff'}</div>
            </div>
          </div>
          <button className="logout-btn" onClick={logout}>
            <LogoutIcon size={16} /> Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}

function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(window.deferredInstallPrompt || null);
  const [showInstallGuide, setShowInstallGuide] = useState(false);

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
      {/* Mobile Header */}
      <div className="mobile-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button className="hamburger" onClick={() => setSidebarOpen(true)}>☰</button>
          <img
            src={logoImg}
            alt="Logo"
            style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover' }}
          />
          <span className="brand-text" style={{ fontSize: '0.92rem', fontWeight: 800 }}>VIJAYA DURGA</span>
        </div>

        <button
          className="btn btn-primary btn-sm"
          style={{ padding: '6px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px', background: '#0b5394' }}
          onClick={handleInstallApp}
        >
          <DownloadIcon size={14} /> Install App
        </button>
      </div>

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onInstall={handleInstallApp}
      />

      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/new-bill" element={<NewBill />} />
          <Route path="/bills" element={<BillHistory />} />
          <Route path="/bills/:id" element={<BillDetail />} />
          <Route path="/ledger" element={<CustomerLedger />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Mobile Bottom Navigation Bar for Simple 1-Page Mobile Use */}
      <nav className="mobile-bottom-nav">
        <NavLink to="/" end className={({ isActive }) => `mobile-bottom-tab ${isActive ? 'active' : ''}`}>
          <DashboardIcon size={20} />
          <span>Home</span>
        </NavLink>
        <NavLink to="/new-bill" className={({ isActive }) => `mobile-bottom-tab ${isActive ? 'active' : ''}`}>
          <div className="mobile-add-btn">
            <PlusIcon size={22} color="#ffffff" />
          </div>
          <span>New Bill</span>
        </NavLink>
        <NavLink to="/bills" className={({ isActive }) => `mobile-bottom-tab ${isActive ? 'active' : ''}`}>
          <InvoiceIcon size={20} />
          <span>Invoices</span>
        </NavLink>
        <NavLink to="/ledger" className={({ isActive }) => `mobile-bottom-tab ${isActive ? 'active' : ''}`}>
          <TrendingUpIcon size={20} />
          <span>Ledger</span>
        </NavLink>
      </nav>

      {/* Install App Helper Guide Modal */}
      {showInstallGuide && (
        <div className="modal-backdrop" onClick={() => setShowInstallGuide(false)}>
          <div className="modal-content fade-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <img src={logoImg} alt="App Icon" style={{ width: '36px', height: '36px', borderRadius: '50%' }} />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Install App on Phone</h3>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowInstallGuide(false)}>✕</button>
            </div>

            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              {isIOS ? (
                <div>
                  <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                    📱 On iPhone / Safari:
                  </p>
                  <ol style={{ paddingLeft: '20px', margin: 0 }}>
                    <li style={{ marginBottom: '6px' }}>Tap the <strong>Share</strong> button (box with upward arrow) at the bottom of Safari.</li>
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
                    <li style={{ marginBottom: '6px' }}>Tap the <strong>3 dots (⋮)</strong> menu in the top right of Chrome.</li>
                    <li style={{ marginBottom: '6px' }}>Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.</li>
                    <li>Confirm by tapping <strong>"Install"</strong>.</li>
                  </ol>
                </div>
              )}
            </div>

            <button
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '18px', padding: '12px' }}
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
      </AuthProvider>
    </BrowserRouter>
  );
}

function LoginWrapper() {
  const { user } = useAuth();
  if (user) return <Navigate to="/" replace />;
  return <Login />;
}
