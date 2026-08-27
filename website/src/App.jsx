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

function Sidebar({ isOpen, onClose, installPrompt, onInstall }) {
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

        {installPrompt && (
          <div style={{ padding: '0 12px 12px 12px' }}>
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%', padding: '10px 12px', fontSize: '0.82rem', background: '#0b5394' }}
              onClick={onInstall}
            >
              <DownloadIcon size={14} /> Install Mobile App
            </button>
          </div>
        )}

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
  const [installPrompt, setInstallPrompt] = useState(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallApp = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  return (
    <div className="app-layout">
      {/* Mobile Header */}
      <div className="mobile-header">
        <button className="hamburger" onClick={() => setSidebarOpen(true)}>☰</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '10px' }}>
          <img
            src={logoImg}
            alt="Logo"
            style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
          />
          <span className="brand-text" style={{ fontSize: '0.98rem', fontWeight: 800 }}>VIJAYA DURGA AGENCIES</span>
        </div>
      </div>

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        installPrompt={installPrompt}
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
