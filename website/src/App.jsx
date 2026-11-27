import { BrowserRouter, Routes, Route, Navigate, NavLink, Link, useNavigate } from 'react-router-dom';
import { useState, useEffect, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Modal from './components/Modal';

// Lazy-loaded pages with prefetch capabilities
import { loadNewBill, loadBillHistory, prefetchCoreRoutes } from './utils/routePrefetch';
import { lazyWithRetry } from './utils/chunkLoadRecovery';

const NewBill = lazyWithRetry(loadNewBill);
const BillHistory = lazyWithRetry(loadBillHistory);
export { loadNewBill, loadBillHistory, prefetchCoreRoutes };

// Lazy-loaded pages with automatic stale chunk recovery & reload loop prevention
const BillDetail = lazyWithRetry(() => import('./pages/BillDetail'));
const PublicInvoice = lazyWithRetry(() => import('./pages/PublicInvoice'));

const CustomerDirectory = lazyWithRetry(() => import('./pages/CustomerDirectory'));
const CustomerLedger = lazyWithRetry(() => import('./pages/CustomerLedger'));
const Reports = lazyWithRetry(() => import('./pages/Reports'));
const ActivityLog = lazyWithRetry(() => import('./pages/ActivityLog'));
const Settings = lazyWithRetry(() => import('./pages/Settings'));
const Staff = lazyWithRetry(() => import('./pages/Staff'));
const RecycleBin = lazyWithRetry(() => import('./pages/RecycleBin'));

import { DashboardIcon, PlusIcon, InvoiceIcon, TrendingUpIcon, SettingsIcon, LogoutIcon, DownloadIcon, UserIcon, StaffIcon, MenuIcon, CloseIcon, TrashIcon, LedgerIcon, ActivityIcon } from './components/Icons';
import ErrorBoundary from './components/ErrorBoundary';
import { SkeletonPage } from './components/Skeleton';
import logoImg from './assets/logo.png';
import ShedModeSyncBar from './components/ShedModeSyncBar';
import { initSyncManager } from './services/syncManager';
import './index.css';

// Shared structured skeleton for lazy-loaded route transitions (eliminates white flash)
function PageLoader() {
  return <SkeletonPage />;
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <div className="spinner" style={{ minHeight: '100vh' }}></div>;
  if (!user) return <Navigate to="/login" replace />;


  return children;
}

function Sidebar({ onInstall, onLogout }) {
  const { user } = useAuth();
  const { lang, toggleLang, t } = useLanguage();

  const isAdmin = user?.role === 'admin';

  const navItems = [
    { path: '/', label: t('dashboard'), icon: <DashboardIcon size={18} /> },
    { path: '/new-bill', label: t('newInvoice'), icon: <PlusIcon size={18} /> },
    { path: '/bills', label: t('invoiceHistory'), icon: <InvoiceIcon size={18} /> },
    { path: '/staff', label: t('navStaff'), icon: <StaffIcon size={18} /> },
    ...(isAdmin
      ? [
          { path: '/reports', label: t('salesReports'), icon: <TrendingUpIcon size={18} /> },
          { path: '/customers', label: t('customers'), icon: <UserIcon size={18} /> },
          { path: '/ledger', label: t('customerLedger'), icon: <LedgerIcon size={18} /> },
          { path: '/activity-log', label: t('activityLog'), icon: <ActivityIcon size={18} /> },
          { path: '/recycle-bin', label: t('recycleBin'), icon: <TrashIcon size={18} /> },
          { path: '/settings', label: t('settings'), icon: <SettingsIcon size={18} /> },
        ]
      : []),
  ];

  return (
    <aside className="sidebar desktop-only-sidebar">
      {/* Brand Header */}
      <Link
        to="/"
        className="sidebar-brand"
        aria-label="Vijaya Durga Agencies Home"
        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '20px 18px 18px 18px', textDecoration: 'none' }}
      >
        <img
          src={logoImg}
          alt="Vijaya Durga Agencies Logo"
          width={44}
          height={44}
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            objectFit: 'cover',
            border: 'none',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
          }}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: '0.96rem', fontWeight: 700, color: '#0b5394', letterSpacing: '-0.2px', lineHeight: '1.2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            VIJAYA DURGA
          </div>
          <p style={{ fontSize: '0.7rem', color: '#52606d', marginTop: '2px', fontWeight: 600 }}>
            Agencies • Billing
          </p>
        </div>
      </Link>

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
            transition: 'background-color 150ms cubic-bezier(0.22, 1, 0.36, 1), border-color 150ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>{t('language')}</span>
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
          className="btn-install-sidebar"
          onClick={onInstall}
        >
          <DownloadIcon size={14} color="currentColor" /> {t('installApp')}
        </button>
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="user-avatar" style={{ background: '#0b5394', color: '#ffffff', fontWeight: 700, borderRadius: '8px' }}>
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="user-info">
            <div className="user-name" style={{ fontWeight: 800, fontSize: '0.84rem' }}>{user?.name || 'User'}</div>
            <div className="user-role" style={{ fontSize: '0.7rem', fontWeight: 700, color: '#0b5394', textTransform: 'uppercase' }}>{user?.role || 'staff'}</div>
          </div>
        </div>
        <button className="logout-btn" onClick={onLogout} style={{ borderRadius: '8px', fontWeight: 700 }}>
          <LogoutIcon size={15} /> {t('signOut')}
        </button>
      </div>
    </aside>
  );
}

function AppLayout() {
  const [installPrompt, setInstallPrompt] = useState(window.deferredInstallPrompt || null);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const { user, logout } = useAuth();
  const { lang, toggleLang, t } = useLanguage();
  const navigate = useNavigate();

  const isAdmin = user?.role === 'admin';

  const drawerNavItems = [
    { path: '/', label: t('dashboard'), icon: <DashboardIcon size={18} /> },
    { path: '/new-bill', label: t('newInvoice'), icon: <PlusIcon size={18} /> },
    { path: '/bills', label: t('invoiceHistory'), icon: <InvoiceIcon size={18} /> },
    { path: '/staff', label: t('navStaff'), icon: <StaffIcon size={18} /> },
    ...(isAdmin
      ? [
          { path: '/reports', label: t('salesReports'), icon: <TrendingUpIcon size={18} /> },
          { path: '/customers', label: t('customers'), icon: <UserIcon size={18} /> },
          { path: '/ledger', label: t('customerLedger'), icon: <LedgerIcon size={18} /> },
          { path: '/activity-log', label: t('activityLog'), icon: <ActivityIcon size={18} /> },
          { path: '/recycle-bin', label: t('recycleBin'), icon: <TrashIcon size={18} /> },
          { path: '/settings', label: t('settings'), icon: <SettingsIcon size={18} /> },
        ]
      : []),
  ];

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

  // Initialize background and foreground sync manager for Shed Mode & prefetch core screens
  useEffect(() => {
    prefetchCoreRoutes();
    const cleanup = initSyncManager();
    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  // Close mobile drawer on Escape
  useEffect(() => {
    if (!mobileDrawerOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setMobileDrawerOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileDrawerOpen]);

  return (
    <div className="app-layout ui-redesign-shell">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <div className="app-top-chrome">
        {/* True Offline-First Shed Mode & Cloud Sync Bar */}
        <ShedModeSyncBar />
        {/* Clean Mobile & Tablet Top Header */}
        <header className="mobile-header">
          <button
            type="button"
            onClick={() => navigate('/')}
            aria-label="Go to Vijaya Durga Dashboard"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'none',
              border: 'none',
              padding: '4px 6px',
              minHeight: '48px',
              cursor: 'pointer',
            }}
          >
            <img
              src={logoImg}
              alt=""
              width={28}
              height={28}
              style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
            />
            <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0b5394' }}>VIJAYA DURGA</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={toggleLang}
              style={{
                padding: '10px 14px',
                fontSize: '0.82rem',
                fontWeight: 800,
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                color: '#0b5394',
                minHeight: '48px',
                minWidth: '48px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {lang === 'en' ? 'తెలుగు' : 'EN'}
            </button>
            <button
              type="button"
              className="mobile-menu-trigger"
              onClick={() => setMobileDrawerOpen(true)}
              aria-label={t('more') || 'Open navigation menu'}
              title={t('more') || 'Menu'}
            >
              <MenuIcon size={20} />
            </button>
          </div>
        </header>
      </div>

      {/* Mobile & Tablet Slide-Out Sidebar Drawer */}
      {mobileDrawerOpen && (
        <div
          className="mobile-drawer-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          onClick={() => setMobileDrawerOpen(false)}
        >
          <div className="mobile-drawer" onClick={(e) => e.stopPropagation()}>
            {/* Drawer Header */}
            <div className="mobile-drawer-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <img
                  src={logoImg}
                  alt="Vijaya Durga Agencies Logo"
                  width={32}
                  height={32}
                  style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                />
                <div>
                  <div style={{ fontSize: '0.96rem', fontWeight: 700, color: '#0b5394', lineHeight: 1.2 }}>
                    VIJAYA DURGA
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#52606d', fontWeight: 600 }}>
                    Seafood &amp; Billing
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setMobileDrawerOpen(false)}
                style={{ padding: '6px', color: '#52606d', minWidth: '48px', minHeight: '48px' }}
                aria-label="Close navigation menu"
              >
                <CloseIcon size={20} />
              </button>
            </div>

            {/* User Profile Card */}
            <div className="mobile-drawer-user">
              <div
                className="user-avatar"
                style={{
                  width: '36px',
                  height: '36px',
                  background: '#0b5394',
                  color: '#ffffff',
                  fontWeight: 700,
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.95rem',
                }}
              >
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                  {user?.name || 'User'}
                </div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#0b5394', textTransform: 'uppercase' }}>
                  {user?.role || 'staff'}
                </div>
              </div>
            </div>

            {/* Menu Header Label */}
            {/* All Navigation Links */}
            <nav className="mobile-drawer-nav">
              {drawerNavItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) => `mobile-drawer-link ${isActive ? 'active' : ''}`}
                  onClick={() => setMobileDrawerOpen(false)}
                >
                  <span style={{ display: 'flex', alignItems: 'center', width: '22px' }}>{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>

            {/* Drawer Footer Actions */}
            <div className="mobile-drawer-footer">

              <button
                type="button"
                className="btn-install-sidebar"
                onClick={() => {
                  setMobileDrawerOpen(false);
                  handleInstallApp();
                }}
              >
                <DownloadIcon size={14} color="currentColor" /> {t('installApp')}
              </button>

              <button
                type="button"
                className="logout-btn"
                onClick={() => {
                  setMobileDrawerOpen(false);
                  setShowLogoutModal(true);
                }}
                style={{ width: '100%', justifyContent: 'center', borderRadius: '8px', fontWeight: 700 }}
              >
                <LogoutIcon size={15} /> {t('signOut')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="app-workspace">
        {/* Desktop Sidebar */}
        <Sidebar onInstall={handleInstallApp} onLogout={() => setShowLogoutModal(true)} />

        {/* Main Content Area */}
        <main id="main-content" tabIndex={-1} className="main-content">
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/new-bill" element={<NewBill />} />
                <Route path="/bills" element={<BillHistory />} />
                <Route path="/bills/:id" element={<BillDetail />} />
                <Route path="/staff" element={<Staff />} />
                {isAdmin && <Route path="/reports" element={<Reports />} />}
                {isAdmin && <Route path="/customers" element={<CustomerDirectory />} />}
                {isAdmin && <Route path="/ledger" element={<CustomerLedger />} />}
                {isAdmin && <Route path="/activity-log" element={<ActivityLog />} />}
                {isAdmin && <Route path="/recycle-bin" element={<RecycleBin />} />}
                {isAdmin && <Route path="/settings" element={<Settings />} />}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar — 5-Tab Layout */}
      <nav className="mobile-bottom-nav">
        <NavLink to="/" end className={({ isActive }) => `mobile-bottom-tab ${isActive ? 'active' : ''}`}>
          <DashboardIcon size={18} />
          <span>{t('navHome')}</span>
        </NavLink>
        <NavLink to="/bills" className={({ isActive }) => `mobile-bottom-tab ${isActive ? 'active' : ''}`}>
          <InvoiceIcon size={18} />
          <span>{t('bills')}</span>
        </NavLink>
        <NavLink to="/new-bill" className={({ isActive }) => `mobile-bottom-tab mobile-bottom-tab-center ${isActive ? 'active' : ''}`}>
          <div className="mobile-add-btn">
            <PlusIcon size={20} color="#ffffff" />
          </div>
          <span>{t('navNew')}</span>
        </NavLink>
        <NavLink to="/staff" className={({ isActive }) => `mobile-bottom-tab ${isActive ? 'active' : ''}`}>
          <StaffIcon size={18} />
          <span>{t('navStaff')}</span>
        </NavLink>
        <button
          type="button"
          className="mobile-bottom-tab"
          onClick={() => setMobileDrawerOpen(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          <MenuIcon size={18} />
          <span>{t('more')}</span>
        </button>
      </nav>

      {/* Install App Helper Modal */}
      <Modal
        isOpen={showInstallGuide}
        onClose={() => setShowInstallGuide(false)}
        maxWidth="420px"
        labelledBy="install-guide-modal-title"
      >
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img src={logoImg} alt="App Icon" width={32} height={32} style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
              <h3 id="install-guide-modal-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Install App on Phone</h3>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setShowInstallGuide(false)}
              aria-label="Close install instructions"
              style={{ minWidth: '48px', minHeight: '48px' }}
            >
              <CloseIcon size={18} />
            </button>
          </div>

          <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            {isIOS ? (
              <div>
                <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                  On iPhone / Safari:
                </p>
                <ol style={{ paddingLeft: '20px', margin: 0 }}>
                  <li style={{ marginBottom: '6px' }}>Tap the <strong>Share</strong> button (box with upward arrow) in your browser bar.</li>
                  <li style={{ marginBottom: '6px' }}>Scroll down and tap <strong>"Add to Home Screen"</strong>.</li>
                  <li>Tap <strong>"Add"</strong> in the top right.</li>
                </ol>
              </div>
            ) : (
              <div>
                <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                  On Android / Chrome:
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
            type="button"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '16px', padding: '10px' }}
            onClick={() => setShowInstallGuide(false)}
          >
            Got it
          </button>
        </div>
      </Modal>

      {/* Sign Out Confirmation Modal */}
      <Modal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        maxWidth="380px"
        labelledBy="logout-modal-title"
        contentStyle={{ textAlign: 'center', padding: '24px 20px' }}
      >
        <div>
          <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#fee2e2', color: '#b42318', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px auto' }}>
            <LogoutIcon size={26} color="#b42318" />
          </div>
          <h3 id="logout-modal-title" style={{ margin: '0 0 8px 0', fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
            {t('signOut')}?
          </h3>
          <p style={{ margin: '0 0 22px 0', fontSize: '0.88rem', color: '#52606d', lineHeight: 1.5 }}>
            Are you sure you want to sign out of your account?
            <br />
            <span style={{ fontSize: '0.82rem', color: '#0b5394', fontWeight: 600 }}>
              మీరు లాగ్ అవుట్ అవ్వాలనుకుంటున్నారా?
            </span>
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1, padding: '10px', fontWeight: 600 }}
              onClick={() => setShowLogoutModal(false)}
            >
              {t('cancel') || 'Cancel'}
            </button>
            <button
              type="button"
              className="btn btn-danger"
              style={{ flex: 1, padding: '10px', background: '#b42318', color: '#ffffff', fontWeight: 600, border: 'none', borderRadius: '8px' }}
              onClick={() => {
                setShowLogoutModal(false);
                logout(true);
              }}
            >
              {t('signOut')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LanguageProvider>
          <ErrorBoundary>
            <Routes>
              <Route path="/login" element={<LoginWrapper />} />
              {/* Public Invoice Routes (Zero Login for Customers) */}
              <Route path="/view/:id" element={<PublicInvoice />} />
              <Route path="/invoice/view/:id" element={<PublicInvoice />} />
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </ErrorBoundary>
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
