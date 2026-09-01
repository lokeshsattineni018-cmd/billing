import { useState, useEffect } from 'react';
import { settingsAPI, usersAPI } from '../services/api';
import { useToast, Toast, formatDate } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';
import {
  LogoutIcon,
  PlusIcon,
  KeyIcon,
  TrashIcon,
  UserIcon,
  EyeIcon,
  EyeOffIcon,
} from '../components/Icons';

export default function Settings() {
  const { user: currentUser, logout } = useAuth();
  const { toast, showToast } = useToast();

  const [activeTab, setActiveTab] = useState('business'); // 'business' | 'users'

  // Business Settings State
  const [form, setForm] = useState({
    businessName: '',
    legalName: '',
    address: '',
    phone: '',
    gstin: '',
    bankName: '',
    accountNo: '',
    ifsc: '',
    branch: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Users State
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Modals State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    username: '',
    email: '',
    role: 'staff',
    password: '',
  });
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedUserForPassword, setSelectedUserForPassword] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUserForDelete, setSelectedUserForDelete] = useState(null);
  const [deletingUser, setDeletingUser] = useState(false);

  useEffect(() => {
    loadSettings();
    loadUsers();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await settingsAPI.get();
      setForm({
        businessName: response.data.businessName || '',
        legalName: response.data.legalName || '',
        address: response.data.address || '',
        phone: response.data.phone || '',
        gstin: response.data.gstin || '',
        bankName: response.data.bankName || '',
        accountNo: response.data.accountNo || '',
        ifsc: response.data.ifsc || '',
        branch: response.data.branch || '',
      });
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const response = await usersAPI.list();
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await settingsAPI.update(form);
      showToast('Settings saved successfully');
    } catch (error) {
      showToast('Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // Create User Handler
  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!createForm.name || !createForm.username || !createForm.password) {
      showToast('Please fill in Name, Username, and Password', 'error');
      return;
    }
    if (createForm.password.length < 6) {
      showToast('Password must be at least 6 characters', 'error');
      return;
    }

    setCreatingUser(true);
    try {
      await usersAPI.create(createForm);
      showToast(`User account "${createForm.username}" created successfully!`, 'success');
      setShowCreateModal(false);
      setCreateForm({ name: '', username: '', email: '', role: 'staff', password: '' });
      setShowCreatePassword(false);
      loadUsers();
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to create user account', 'error');
    } finally {
      setCreatingUser(false);
    }
  };

  // Reset Password Handler
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      showToast('New password must be at least 6 characters', 'error');
      return;
    }

    setResettingPassword(true);
    try {
      await usersAPI.resetPassword(selectedUserForPassword._id, newPassword);
      showToast(`Password for ${selectedUserForPassword.email} updated successfully!`, 'success');
      setShowPasswordModal(false);
      setSelectedUserForPassword(null);
      setNewPassword('');
      setShowResetPassword(false);
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to update password', 'error');
    } finally {
      setResettingPassword(false);
    }
  };

  // Delete User Handler
  const handleDeleteUser = async () => {
    if (!selectedUserForDelete) return;
    setDeletingUser(true);
    try {
      await usersAPI.delete(selectedUserForDelete._id);
      showToast(`User account "${selectedUserForDelete.email}" deleted successfully`, 'success');
      setShowDeleteModal(false);
      setSelectedUserForDelete(null);
      loadUsers();
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to delete user account', 'error');
    } finally {
      setDeletingUser(false);
    }
  };

  const getRoleBadge = (role) => {
    if (role === 'admin') {
      return (
        <span style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '3px 10px', borderRadius: '20px', fontSize: '0.74rem', fontWeight: 800 }}>
          Admin
        </span>
      );
    }
    if (role === 'owner') {
      return (
        <span style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '3px 10px', borderRadius: '20px', fontSize: '0.74rem', fontWeight: 800 }}>
          Owner / Proprietor
        </span>
      );
    }
    return (
      <span style={{ background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1', padding: '3px 10px', borderRadius: '20px', fontSize: '0.74rem', fontWeight: 700 }}>
        Staff
      </span>
    );
  };

  if (loading) return <div className="spinner"></div>;

  return (
    <div className="page-container fade-in">
      <Toast toast={toast} />

      {/* Header & Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
            System Settings & User Control
          </h2>
          <p style={{ fontSize: '0.84rem', color: '#64748b', margin: '4px 0 0 0' }}>
            Configure trade invoice details and manage staff login accounts & passwords
          </p>
        </div>

        {/* Top Tab Bar */}
        <div style={{ display: 'flex', gap: '8px', background: '#f1f5f9', padding: '4px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'business' ? 'btn-primary' : 'btn-ghost'}`}
            style={activeTab === 'business' ? { background: '#0b5394', color: '#ffffff', fontWeight: 800, borderRadius: '8px' } : { color: '#64748b', fontWeight: 700 }}
            onClick={() => setActiveTab('business')}
          >
            🏢 Business & Bank Profile
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'users' ? 'btn-primary' : 'btn-ghost'}`}
            style={activeTab === 'users' ? { background: '#0b5394', color: '#ffffff', fontWeight: 800, borderRadius: '8px' } : { color: '#64748b', fontWeight: 700 }}
            onClick={() => setActiveTab('users')}
          >
            👥 Staff Accounts ({users.length})
          </button>
        </div>
      </div>

      {/* TAB 1: BUSINESS SETTINGS */}
      {activeTab === 'business' && (
        <div className="settings-grid">
          {/* Settings Form */}
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: '18px' }}>Business Details</h3>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Trade / Business Name</label>
                <input
                  type="text"
                  className="form-input form-input-lg"
                  value={form.businessName}
                  onChange={(e) => handleChange('businessName', e.target.value)}
                  placeholder="e.g. VIJAYA DURGA AGENCIES"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Legal Name / Proprietor</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.legalName}
                  onChange={(e) => handleChange('legalName', e.target.value)}
                  placeholder="e.g. SATTINENI VENKATA DHANA LAXMI"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Address of Principal Place of Business</label>
                <textarea
                  className="form-input"
                  rows="3"
                  value={form.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  placeholder="Business address"
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Phone / Cell Number</label>
                <input
                  type="tel"
                  className="form-input"
                  value={form.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder="e.g. 9441429745"
                />
              </div>

              <div className="form-group">
                <label className="form-label">GSTIN (Registration Number)</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.gstin}
                  onChange={(e) => handleChange('gstin', e.target.value)}
                  placeholder="e.g. 37KATPS1500Q1ZR"
                />
              </div>

              <h3 className="card-title" style={{ margin: '22px 0 14px 0', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                Bank Account Details
              </h3>

              <div className="form-group">
                <label className="form-label">Bank Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.bankName}
                  onChange={(e) => handleChange('bankName', e.target.value)}
                  placeholder="e.g. KARUR VYSYA BANK"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Account Number</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.accountNo}
                  onChange={(e) => handleChange('accountNo', e.target.value)}
                  placeholder="e.g. 4805135000002964"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">IFSC Code</label>
                  <input
                    type="text"
                    className="form-input"
                    value={form.ifsc}
                    onChange={(e) => handleChange('ifsc', e.target.value)}
                    placeholder="e.g. KVBL0004815"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Branch</label>
                  <input
                    type="text"
                    className="form-input"
                    value={form.branch}
                    onChange={(e) => handleChange('branch', e.target.value)}
                    placeholder="e.g. Narasapur"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-large"
                disabled={saving}
                style={{ marginTop: '10px' }}
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </form>
          </div>

          {/* Invoice Header & Bank Preview */}
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: '18px' }}>Invoice Preview</h3>
            <div className="bill-preview">
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#0b5394', fontWeight: 700, marginBottom: '6px' }}>
                <span>TAX INVOICE / CASH / CREDIT</span>
                <span>Cell: {form.phone || '9441429745'}</span>
              </div>
              <h3 style={{ color: '#0b5394', margin: '8px 0 4px 0', fontSize: '1.3rem' }}>{form.businessName || 'VIJAYA DURGA AGENCIES'}</h3>
              {form.legalName && <p style={{ fontWeight: 600, margin: '2px 0' }}>Prop: {form.legalName} | GSTIN: {form.gstin || '37KATPS1500Q1ZR'}</p>}
              {form.address && <p style={{ fontSize: '0.82rem', color: '#555', margin: '4px 0' }}>{form.address}</p>}

              <hr style={{ margin: '14px 0', borderColor: '#e4e4e7' }} />

              <div style={{ fontSize: '0.82rem', color: '#333', textAlign: 'left', lineHeight: '1.6' }}>
                <strong>Bank Details:</strong>
                <div>Bank: {form.bankName || 'KARUR VYSYA BANK'}</div>
                <div>A/c No: {form.accountNo || '4805135000002964'}</div>
                <div>IFSC: {form.ifsc || 'KVBL0004815'} | Branch: {form.branch || 'Narasapur'}</div>
              </div>
            </div>

            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: '100%', padding: '12px', color: '#ef4444', border: '1px solid #fecaca', background: '#fff5f5', fontWeight: 700 }}
                onClick={logout}
              >
                <LogoutIcon size={16} color="#ef4444" /> Sign Out of Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: STAFF & USER MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
            <div>
              <h3 className="card-title" style={{ margin: 0 }}>Active User Accounts</h3>
              <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '4px 0 0 0' }}>
                Create login accounts for staff, reset forgotten passwords, or remove departed employees
              </p>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setCreateForm({ name: '', email: '', role: 'staff', password: '' });
                setShowCreatePassword(false);
                setShowCreateModal(true);
              }}
              style={{
                background: '#0b5394',
                color: '#ffffff',
                fontWeight: 700,
                padding: '9px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(11, 83, 148, 0.25)',
              }}
            >
              <PlusIcon size={16} color="#ffffff" /> Create New User Account
            </button>
          </div>

          {loadingUsers ? (
            <div className="spinner"></div>
          ) : users.length === 0 ? (
            <div className="empty-state">
              <p>No user accounts found.</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>User / Employee</th>
                    <th>Username</th>
                    <th>Email Address</th>
                    <th>Role</th>
                    <th>Created</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const isSelf = currentUser?.email?.toLowerCase() === u.email?.toLowerCase() ||
                      (currentUser?.username && currentUser?.username?.toLowerCase() === u.username?.toLowerCase());
                    const displayUsername = u.username || u.email?.split('@')[0] || 'user';
                    return (
                      <tr key={u._id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div
                              style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                background: u.role === 'admin' ? '#eff6ff' : u.role === 'owner' ? '#ecfdf5' : '#f8fafc',
                                border: `1.5px solid ${u.role === 'admin' ? '#93c5fd' : u.role === 'owner' ? '#6ee7b7' : '#cbd5e1'}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 800,
                                fontSize: '0.9rem',
                                color: u.role === 'admin' ? '#1d4ed8' : u.role === 'owner' ? '#047857' : '#475569',
                              }}
                            >
                              {(u.name || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {u.name}
                                {isSelf && (
                                  <span style={{ fontSize: '0.68rem', background: '#dbeafe', color: '#1e40af', padding: '1px 6px', borderRadius: '10px', fontWeight: 800 }}>
                                    YOU
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <code style={{ fontSize: '0.86rem', color: '#0b5394', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '3px 8px', borderRadius: '6px', fontWeight: 700 }}>
                            @{displayUsername}
                          </code>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.84rem', color: '#475569' }}>
                            {u.email && !u.email.endsWith('.local') ? u.email : <em style={{ color: '#94a3b8' }}>None</em>}
                          </span>
                        </td>
                        <td>{getRoleBadge(u.role)}</td>
                        <td style={{ fontSize: '0.82rem', color: '#64748b' }}>
                          {formatDate(u.createdAt)}
                        </td>
                        <td className="text-right">
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            {/* Change / Reset Password Button */}
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{
                                padding: '6px 10px',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                border: '1px solid #cbd5e1',
                                color: '#0b5394',
                              }}
                              onClick={() => {
                                setSelectedUserForPassword(u);
                                setNewPassword('');
                                setShowResetPassword(false);
                                setShowPasswordModal(true);
                              }}
                              title="Change / Set New Password"
                            >
                              <KeyIcon size={14} color="#0b5394" /> Change Password
                            </button>

                            {/* Delete User Button */}
                            {!isSelf && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{
                                  padding: '6px 10px',
                                  fontSize: '0.78rem',
                                  fontWeight: 700,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  border: '1px solid #fca5a5',
                                  background: '#fff5f5',
                                  color: '#dc2626',
                                }}
                                onClick={() => {
                                  setSelectedUserForDelete(u);
                                  setShowDeleteModal(true);
                                }}
                                title="Delete user account"
                              >
                                <TrashIcon size={14} color="#dc2626" /> Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: CREATE NEW USER ACCOUNT */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content fade-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', paddingBottom: '12px', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ background: '#eff6ff', padding: '8px', borderRadius: '8px', color: '#0b5394' }}>
                  <UserIcon size={18} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                  Create User Account
                </h3>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCreateModal(false)}>✕</button>
            </div>

            <form onSubmit={handleCreateUser}>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Employee / Full Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Lokesh"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Username * (for login)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. lokesh18"
                  value={createForm.username}
                  onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                  required
                />
                <small style={{ color: '#64748b', fontSize: '0.72rem', display: 'block', marginTop: '3px' }}>
                  Can be any text (letters, numbers). No '@' required.
                </small>
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Email Address (Optional)</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="e.g. lokesh@gmail.com (optional)"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Account Role *</label>
                <select
                  className="form-select"
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                >
                  <option value="staff">Staff (Daily Billing, History, WhatsApp Sharing)</option>
                  <option value="owner">Owner (Full Billing + Reports & Customers)</option>
                  <option value="admin">Admin (Full System Control & Settings)</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Password *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showCreatePassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Min 6 characters"
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    required
                    style={{ paddingRight: '40px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreatePassword(!showCreatePassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    title={showCreatePassword ? 'Hide password' : 'View password'}
                  >
                    {showCreatePassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                  </button>
                </div>
                <small style={{ color: '#64748b', fontSize: '0.72rem', display: 'block', marginTop: '4px' }}>
                  Click the 👁️ eye icon to view and verify the password as you type.
                </small>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={creatingUser}
                  style={{ background: '#0b5394', fontWeight: 700 }}
                >
                  {creatingUser ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CHANGE / RESET USER PASSWORD */}
      {showPasswordModal && selectedUserForPassword && (
        <div className="modal-backdrop" onClick={() => setShowPasswordModal(false)}>
          <div className="modal-content fade-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', paddingBottom: '12px', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ background: '#eff6ff', padding: '8px', borderRadius: '8px', color: '#0b5394' }}>
                  <KeyIcon size={18} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                  Change User Password
                </h3>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowPasswordModal(false)}>✕</button>
            </div>

            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>
                {selectedUserForPassword.name}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                {selectedUserForPassword.email} • {selectedUserForPassword.role?.toUpperCase()}
              </div>
            </div>

            <form onSubmit={handleResetPassword}>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label" style={{ fontWeight: 700 }}>New Password *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Enter new password (min 6 chars)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    style={{ paddingRight: '40px' }}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    title={showResetPassword ? 'Hide password' : 'View password'}
                  >
                    {showResetPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                  </button>
                </div>
                <small style={{ color: '#64748b', fontSize: '0.72rem', display: 'block', marginTop: '4px' }}>
                  Click the 👁️ eye icon to view and verify the new password.
                </small>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowPasswordModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={resettingPassword}
                  style={{ background: '#0b5394', fontWeight: 700 }}
                >
                  {resettingPassword ? 'Updating...' : 'Set New Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: DELETE USER CONFIRMATION */}
      {showDeleteModal && selectedUserForDelete && (
        <div className="modal-backdrop" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-content fade-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{ background: '#fee2e2', padding: '10px', borderRadius: '50%', color: '#dc2626' }}>
                <TrashIcon size={20} color="#dc2626" />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#991b1b' }}>
                Delete User Account?
              </h3>
            </div>

            <p style={{ fontSize: '0.88rem', color: '#475569', lineHeight: '1.5', margin: '0 0 16px 0' }}>
              Are you sure you want to permanently delete the account for <strong>{selectedUserForDelete.name}</strong> (<code>{selectedUserForDelete.email}</code>)?
            </p>
            <p style={{ fontSize: '0.78rem', color: '#dc2626', background: '#fff5f5', border: '1px solid #fecaca', padding: '8px 12px', borderRadius: '6px', margin: '0 0 20px 0' }}>
              ⚠️ This user will immediately lose login access to the billing system.
            </p>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                style={{ background: '#dc2626', color: '#ffffff', fontWeight: 700, border: 'none' }}
                disabled={deletingUser}
                onClick={handleDeleteUser}
              >
                {deletingUser ? 'Deleting...' : 'Yes, Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
