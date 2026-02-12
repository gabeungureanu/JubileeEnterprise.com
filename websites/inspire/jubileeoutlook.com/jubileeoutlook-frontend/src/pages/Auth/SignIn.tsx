import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import './SignIn.css';

const PROVIDERS = [
  { icon: 'mail', label: 'Outlook' },
  { text: 'M', label: 'Microsoft 365' },
  { text: 'Y!', label: 'Yahoo' },
  { icon: 'cloud', label: 'iCloud' },
  { icon: 'mail', label: 'IMAP / POP' },
];

const SignIn: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'email' | 'password'>('email');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleContinue = () => {
    if (!email) return;
    setError('');
    setStep('password');
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError('');
    const result = await login(email, password);
    setLoading(false);
    if (!result.success) {
      setError(result.error || 'Sign in failed. Please try again.');
    }
  };

  const handleBack = () => {
    setStep('email');
    setPassword('');
    setError('');
  };

  return (
    <div className="signin">
      {/* Title bar */}
      <header className="signin__titlebar">
        <span className="signin__brand">
          <span className="signin__brand-jubilee">Jubilee</span>
          <span className="signin__brand-outlook">Outlook</span>
        </span>
      </header>

      {/* Main content */}
      <div className="signin__content">
        <div className="signin__card">
          {/* Avatar */}
          <div className="signin__avatar">
            <span className="material-symbols-outlined signin__avatar-icon">person</span>
          </div>

          {/* Heading */}
          <h1 className="signin__heading">Add all your email accounts</h1>
          <p className="signin__subtext">Sync your existing email accounts with JubileeOutlook</p>

          {/* Provider icons */}
          <div className="signin__providers">
            {PROVIDERS.map((p, i) => (
              <div key={i} className="signin__provider" title={p.label}>
                {p.icon ? (
                  <span className="material-symbols-outlined">{p.icon}</span>
                ) : (
                  <span className="signin__provider-text">{p.text}</span>
                )}
              </div>
            ))}
          </div>

          <p className="signin__support-text">
            JubileeOutlook supports Microsoft 365, Gmail,
            <br />
            Yahoo, iCloud, IMAP, and POP.
          </p>
          <a href="#learn" className="signin__learn-more" onClick={(e) => e.preventDefault()}>
            Learn More
          </a>

          {/* Form */}
          <form
            className="signin__form"
            onSubmit={step === 'email' ? (e) => { e.preventDefault(); handleContinue(); } : handleSignIn}
          >
            {step === 'email' ? (
              <>
                {/* Suggested accounts section */}
                <div className="signin__suggested">
                  <span className="signin__suggested-label">Suggested accounts</span>
                  <span className="material-symbols-outlined signin__info-icon" title="Accounts detected from your browser">info</span>
                </div>

                <div className="signin__input-wrapper">
                  <input
                    type="email"
                    className="signin__input"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoFocus
                    required
                  />
                  <span className="material-symbols-outlined signin__input-arrow">arrow_drop_down</span>
                </div>

                <div className="signin__create-account">
                  <span>No account? </span>
                  <a href="#create" className="signin__create-link" onClick={(e) => e.preventDefault()}>
                    Create a JubileeOutlook account
                  </a>
                </div>

                <button type="submit" className="signin__continue-btn" disabled={!email}>
                  Continue
                </button>
              </>
            ) : (
              <>
                {/* Password step */}
                <div className="signin__email-display">
                  <span className="material-symbols-outlined">mail</span>
                  <span>{email}</span>
                  <button type="button" className="signin__change-email" onClick={handleBack}>
                    <span className="material-symbols-outlined">edit</span>
                  </button>
                </div>

                {error && <div className="signin__error">{error}</div>}

                <div className="signin__input-wrapper">
                  <input
                    type="password"
                    className="signin__input"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                    required
                  />
                </div>

                <a href="#forgot" className="signin__forgot-link" onClick={(e) => e.preventDefault()}>
                  Forgot password?
                </a>

                <button type="submit" className="signin__continue-btn" disabled={loading || !password}>
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </>
            )}
          </form>

          {/* Footer */}
          <p className="signin__footer">&copy; 2026 Jubilee Software, Inc.</p>
        </div>
      </div>
    </div>
  );
};

export default SignIn;
