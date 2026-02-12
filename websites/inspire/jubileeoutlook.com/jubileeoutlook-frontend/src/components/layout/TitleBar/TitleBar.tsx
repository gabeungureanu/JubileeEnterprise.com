import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useAppContext } from '../../../context/AppContext';
import './TitleBar.css';

const TitleBar: React.FC = () => {
  const { user, isAuthenticated, login, logout } = useAuth();
  const { syncStatus } = useAppContext();
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popupRef.current &&
        !popupRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsPopupOpen(false);
        setShowLoginForm(false);
        setLoginError('');
      }
    };
    if (isPopupOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isPopupOpen]);

  const handleTogglePopup = () => {
    setIsPopupOpen((prev) => !prev);
    if (isPopupOpen) {
      setShowLoginForm(false);
      setLoginError('');
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) return;
    setLoginLoading(true);
    setLoginError('');
    const result = await login(loginEmail, loginPassword);
    setLoginLoading(false);
    if (result.success) {
      setShowLoginForm(false);
      setLoginEmail('');
      setLoginPassword('');
    } else {
      setLoginError(result.error || 'Sign in failed');
    }
  };

  const handleSignOut = async () => {
    setIsPopupOpen(false);
    await logout();
  };

  const getInitials = (): string => {
    if (!user?.displayName) return '?';
    const parts = user.displayName.split(' ');
    return (parts[0]?.charAt(0) + (parts[1]?.charAt(0) || '')).toUpperCase();
  };

  return (
    <header className="title-bar">
      <div className="title-bar__left">
        <span className="title-bar__title">Jubilee Outlook</span>
      </div>
      <div className="title-bar__right">
        <button
          ref={buttonRef}
          className="title-bar__profile"
          title="Profile"
          onClick={handleTogglePopup}
        >
          {isAuthenticated && user ? (
            <div className="title-bar__avatar-sm">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.displayName} className="title-bar__avatar-img" />
              ) : (
                <span className="title-bar__avatar-initials">{getInitials()}</span>
              )}
              <span className="title-bar__sync-dot" />
            </div>
          ) : (
            <span className="material-symbols-outlined">account_circle</span>
          )}
        </button>

        {isPopupOpen && (
          <div ref={popupRef} className="profile-popup">
            {isAuthenticated && user ? (
              /* ===== Signed-In State ===== */
              <div className="profile-popup__signed-in">
                <div className="profile-popup__user-section">
                  <div className="profile-popup__avatar">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.displayName} />
                    ) : (
                      <span className="profile-popup__avatar-initials">{getInitials()}</span>
                    )}
                  </div>
                  <div className="profile-popup__user-info">
                    <span className="profile-popup__name">{user.displayName}</span>
                    <span className="profile-popup__email">{user.email}</span>
                  </div>
                </div>

                <div className="profile-popup__status-label">
                  Signed in to your Jubilee account
                </div>

                <div className="profile-popup__sync-status">
                  <span className="material-symbols-outlined profile-popup__sync-icon">sync</span>
                  <div className="profile-popup__sync-info">
                    <span className="profile-popup__sync-title">
                      {syncStatus.isSyncing ? 'Syncing...' : 'Syncing is on'}
                    </span>
                    <span className="profile-popup__sync-detail">
                      {syncStatus.isSyncing
                        ? 'Updating your data'
                        : 'Your data is synced'}
                    </span>
                  </div>
                </div>

                <div className="profile-popup__divider" />

                <button className="profile-popup__action" onClick={handleSignOut}>
                  <span className="material-symbols-outlined">logout</span>
                  <span>Sign out</span>
                </button>
              </div>
            ) : (
              /* ===== Signed-Out State ===== */
              <div className="profile-popup__signed-out">
                {!showLoginForm ? (
                  <>
                    <div className="profile-popup__icon-container">
                      <span className="material-symbols-outlined profile-popup__big-icon">
                        person
                      </span>
                    </div>
                    <p className="profile-popup__prompt">
                      Sign in to sync your data across devices
                    </p>
                    <button
                      className="profile-popup__sign-in-btn"
                      onClick={() => setShowLoginForm(true)}
                    >
                      <span className="material-symbols-outlined">login</span>
                      <span>Sign in</span>
                    </button>
                  </>
                ) : (
                  <form className="profile-popup__login-form" onSubmit={handleSignIn}>
                    <h4 className="profile-popup__form-title">Sign in</h4>
                    {loginError && (
                      <div className="profile-popup__error">{loginError}</div>
                    )}
                    <div className="profile-popup__form-field">
                      <input
                        type="email"
                        placeholder="Email"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        autoFocus
                        required
                      />
                    </div>
                    <div className="profile-popup__form-field">
                      <input
                        type="password"
                        placeholder="Password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                      />
                    </div>
                    <div className="profile-popup__form-actions">
                      <button
                        type="button"
                        className="profile-popup__cancel-btn"
                        onClick={() => {
                          setShowLoginForm(false);
                          setLoginError('');
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="profile-popup__submit-btn"
                        disabled={loginLoading}
                      >
                        {loginLoading ? 'Signing in...' : 'Sign in'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

export default TitleBar;
