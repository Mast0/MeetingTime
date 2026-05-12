import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { updateProfile, changePassword } from '../api/auth';
import '../styles/SettingsPage.css';

// ─── Feedback state helper ───

type FeedbackState = { kind: 'success' | 'error'; message: string } | null;

const SettingsPage: React.FC = () => {
    const navigate = useNavigate();
    const { userName, email, setUserName, setEmail } = useContext(AuthContext);

    // ─── Active section ───
    const [activeSection, setActiveSection] = useState<'profile' | 'security'>('profile');

    // ─── Profile form ───
    const [newUsername, setNewUsername] = useState(userName ?? '');
    const [newEmail, setNewEmail]       = useState(email ?? '');
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileFeedback, setProfileFeedback] = useState<FeedbackState>(null);

    // ─── Security form ───
    const [currentPwd, setCurrentPwd]     = useState('');
    const [newPwd, setNewPwd]             = useState('');
    const [confirmPwd, setConfirmPwd]     = useState('');
    const [securityLoading, setSecurityLoading] = useState(false);
    const [securityFeedback, setSecurityFeedback] = useState<FeedbackState>(null);

    // ─── Handlers ───

    const handleProfileSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setProfileLoading(true);
        setProfileFeedback(null);
        try {
            await updateProfile({
                username: newUsername.trim() || undefined,
                email:    newEmail.trim()    || undefined,
            });
            setUserName(newUsername.trim());
            setEmail(newEmail.trim());
            setProfileFeedback({ kind: 'success', message: '✅ Profile updated successfully' });
        } catch (err: any) {
            const msg = err?.response?.data || 'Failed to update profile';
            setProfileFeedback({ kind: 'error', message: `❌ ${msg}` });
        } finally {
            setProfileLoading(false);
        }
    };

    const handlePasswordSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPwd !== confirmPwd) {
            setSecurityFeedback({ kind: 'error', message: '❌ New passwords do not match' });
            return;
        }
        if (newPwd.length < 6) {
            setSecurityFeedback({ kind: 'error', message: '❌ Password must be at least 6 characters' });
            return;
        }
        setSecurityLoading(true);
        setSecurityFeedback(null);
        try {
            await changePassword({ currentPassword: currentPwd, newPassword: newPwd });
            setCurrentPwd('');
            setNewPwd('');
            setConfirmPwd('');
            setSecurityFeedback({ kind: 'success', message: '✅ Password changed successfully' });
        } catch (err: any) {
            const msg = err?.response?.data || 'Failed to change password';
            setSecurityFeedback({ kind: 'error', message: `❌ ${msg}` });
        } finally {
            setSecurityLoading(false);
        }
    };

    // ─── Render ───

    return (
        <div className="settings-page">
            {/* Top bar */}
            <div className="settings-topbar">
                <button id="settings-back-btn" className="settings-back-btn" onClick={() => navigate('/')}>
                    ← Back
                </button>
                <h1 className="settings-topbar-title">⚙️ Settings</h1>
            </div>

            <div className="settings-body">
                {/* Navigation */}
                <nav className="settings-nav" aria-label="Settings sections">
                    <button
                        id="settings-nav-profile"
                        className={`settings-nav-btn ${activeSection === 'profile' ? 'active' : ''}`}
                        onClick={() => setActiveSection('profile')}
                    >
                        <span className="settings-nav-icon">👤</span> Profile
                    </button>
                    <button
                        id="settings-nav-security"
                        className={`settings-nav-btn ${activeSection === 'security' ? 'active' : ''}`}
                        onClick={() => setActiveSection('security')}
                    >
                        <span className="settings-nav-icon">🔒</span> Security
                    </button>
                </nav>

                {/* Content */}
                <div className="settings-content">

                    {/* ── Profile ── */}
                    {activeSection === 'profile' && (
                        <div className="settings-card">
                            <h2 className="settings-card-title">👤 Profile Information</h2>
                            <form onSubmit={handleProfileSave}>
                                <div className="settings-field">
                                    <label className="settings-label" htmlFor="settings-username">Username</label>
                                    <input
                                        id="settings-username"
                                        className="settings-input"
                                        type="text"
                                        value={newUsername}
                                        onChange={e => setNewUsername(e.target.value)}
                                        placeholder="Your username"
                                        autoComplete="username"
                                    />
                                </div>
                                <div className="settings-field">
                                    <label className="settings-label" htmlFor="settings-email">Email address</label>
                                    <input
                                        id="settings-email"
                                        className="settings-input"
                                        type="email"
                                        value={newEmail}
                                        onChange={e => setNewEmail(e.target.value)}
                                        placeholder="your@email.com"
                                        autoComplete="email"
                                    />
                                </div>

                                <div className="settings-action-row">
                                    {profileFeedback && (
                                        <span className={`settings-feedback ${profileFeedback.kind}`}>
                                            {profileFeedback.message}
                                        </span>
                                    )}
                                    <button
                                        id="settings-profile-save"
                                        type="submit"
                                        className="settings-save-btn"
                                        disabled={profileLoading}
                                    >
                                        {profileLoading ? '⏳ Saving…' : '💾 Save Profile'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* ── Security ── */}
                    {activeSection === 'security' && (
                        <div className="settings-card">
                            <h2 className="settings-card-title">🔒 Change Password</h2>
                            <form onSubmit={handlePasswordSave}>
                                <div className="settings-field">
                                    <label className="settings-label" htmlFor="settings-current-pwd">Current Password</label>
                                    <input
                                        id="settings-current-pwd"
                                        className="settings-input"
                                        type="password"
                                        value={currentPwd}
                                        onChange={e => setCurrentPwd(e.target.value)}
                                        placeholder="Enter current password"
                                        autoComplete="current-password"
                                        required
                                    />
                                </div>
                                <div className="settings-field">
                                    <label className="settings-label" htmlFor="settings-new-pwd">New Password</label>
                                    <input
                                        id="settings-new-pwd"
                                        className="settings-input"
                                        type="password"
                                        value={newPwd}
                                        onChange={e => setNewPwd(e.target.value)}
                                        placeholder="At least 6 characters"
                                        autoComplete="new-password"
                                        required
                                    />
                                </div>
                                <div className="settings-field">
                                    <label className="settings-label" htmlFor="settings-confirm-pwd">Confirm New Password</label>
                                    <input
                                        id="settings-confirm-pwd"
                                        className="settings-input"
                                        type="password"
                                        value={confirmPwd}
                                        onChange={e => setConfirmPwd(e.target.value)}
                                        placeholder="Repeat new password"
                                        autoComplete="new-password"
                                        required
                                    />
                                </div>

                                <div className="settings-action-row">
                                    {securityFeedback && (
                                        <span className={`settings-feedback ${securityFeedback.kind}`}>
                                            {securityFeedback.message}
                                        </span>
                                    )}
                                    <button
                                        id="settings-password-save"
                                        type="submit"
                                        className="settings-save-btn"
                                        disabled={securityLoading || !currentPwd || !newPwd || !confirmPwd}
                                    >
                                        {securityLoading ? '⏳ Saving…' : '🔑 Change Password'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default SettingsPage;
