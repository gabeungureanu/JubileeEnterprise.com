import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import './SignIn.css';

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type AuthPanel = 'sync' | 'signin' | 'signup' | 'forgot';

const PROVIDERS = [
  { icon: 'mail', label: 'Microsoft 365' },
  { text: 'M', label: 'Gmail' },
  { text: 'Y!', label: 'Yahoo' },
  { icon: 'cloud', label: 'iCloud' },
  { icon: 'forward_to_inbox', label: 'IMAP/POP' },
];

const SignIn: React.FC = () => {
  const { login, register } = useAuth();

  // Panel state
  const [panel, setPanel] = useState<AuthPanel>('sync');

  // Sync Email panel
  const [syncEmail, setSyncEmail] = useState('');

  // Sign In panel
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Sign Up panel
  const [signUpFullName, setSignUpFullName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState('');
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [newsletter, setNewsletter] = useState(false);

  // Forgot Password panel
  const [forgotEmail, setForgotEmail] = useState('');

  // Errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Loading
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');

  // Auto-login on mount
  useEffect(() => {
    const savedEmail = localStorage.getItem('jubilee_remember_email');
    const savedToken = localStorage.getItem('jubilee_remember_token');
    if (savedEmail && savedToken) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  const setError = useCallback((field: string, message: string) => {
    setErrors(prev => ({ ...prev, [field]: message }));
  }, []);

  const clearError = useCallback((field: string) => {
    setErrors(prev => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  // Panel navigation
  const navigateTo = useCallback((target: AuthPanel) => {
    clearErrors();
    setPanel(target);
    setLoading(false);
    setLoadingText('');
  }, [clearErrors]);

  // Real-time validation helpers
  const validateEmailField = useCallback((value: string, field: string) => {
    if (errors[field]) {
      if (value.trim() && EMAIL_REGEX.test(value.trim())) {
        clearError(field);
      }
    }
  }, [errors, clearError]);

  const validateRequiredField = useCallback((value: string, field: string, minLength?: number) => {
    if (errors[field]) {
      const trimmed = value.trim();
      if (trimmed && (!minLength || trimmed.length >= minLength)) {
        clearError(field);
      }
    }
  }, [errors, clearError]);

  // Sign In validation
  const validateSignIn = (): boolean => {
    let valid = true;
    const newErrors: Record<string, string> = {};

    if (!email.trim()) {
      newErrors.email = 'Email address is required';
      valid = false;
    } else if (!EMAIL_REGEX.test(email.trim())) {
      newErrors.email = 'Please enter a valid email address';
      valid = false;
    }

    if (!password) {
      newErrors.password = 'Password is required';
      valid = false;
    }

    setErrors(newErrors);
    return valid;
  };

  // Sign Up validation
  const validateSignUp = (): boolean => {
    let valid = true;
    const newErrors: Record<string, string> = {};

    if (!signUpFullName.trim()) {
      newErrors.fullName = 'Full name is required';
      valid = false;
    } else if (signUpFullName.trim().length < 2) {
      newErrors.fullName = 'Name must be at least 2 characters';
      valid = false;
    }

    if (!signUpEmail.trim()) {
      newErrors.signUpEmail = 'Email address is required';
      valid = false;
    } else if (!EMAIL_REGEX.test(signUpEmail.trim())) {
      newErrors.signUpEmail = 'Please enter a valid email address';
      valid = false;
    }

    if (!signUpPassword) {
      newErrors.signUpPassword = 'Password is required';
      valid = false;
    } else if (signUpPassword.length < 6) {
      newErrors.signUpPassword = 'Password must be at least 6 characters';
      valid = false;
    }

    if (!signUpConfirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
      valid = false;
    } else if (signUpPassword !== signUpConfirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
      valid = false;
    }

    setErrors(newErrors);
    return valid;
  };

  // Sign In handler
  const handleSignIn = async () => {
    if (!validateSignIn()) return;

    setLoading(true);
    setLoadingText('Signing in...');

    const result = await login(email.trim(), password, rememberMe);

    if (!result.success) {
      setLoading(false);
      setLoadingText('');
      setError('general', result.error || 'Sign in failed. Please try again.');
    }
  };

  // Sign Up handler
  const handleSignUp = async () => {
    if (!validateSignUp()) return;

    setLoading(true);
    setLoadingText('Creating account...');

    const result = await register(signUpFullName.trim(), signUpEmail.trim(), signUpPassword, newsletter);

    if (!result.success) {
      setLoading(false);
      setLoadingText('');
      setError('general', result.error || 'Registration failed. Please try again.');
    }
  };

  // Forgot Password handler
  const handleForgotPassword = async () => {
    const trimmedEmail = forgotEmail.trim();

    if (!trimmedEmail) {
      setError('forgotEmail', 'Please enter your email address');
      return;
    }

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setError('forgotEmail', 'Please enter a valid email address');
      return;
    }

    setLoading(true);
    setLoadingText('Sending reset link...');

    try {
      const { authService } = await import('../../services/auth/authService');
      await authService.forgotPassword(trimmedEmail);
      setLoading(false);
      setLoadingText('');
      setError('forgotSuccess', 'If an account exists with this email, you will receive password reset instructions shortly.');
      setTimeout(() => navigateTo('signin'), 3000);
    } catch {
      setLoading(false);
      setLoadingText('');
      setError('forgotEmail', 'An error occurred. Please try again.');
    }
  };

  // Sync Continue handler
  const handleSyncContinue = () => {
    const trimmedEmail = syncEmail.trim();

    if (!trimmedEmail) {
      setError('syncEmail', 'Please enter your email address');
      return;
    }

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setError('syncEmail', 'Please enter a valid email address');
      return;
    }

    // Navigate to sign in with the email pre-filled
    setEmail(trimmedEmail);
    navigateTo('signin');
  };

  // Enter key handler
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      switch (panel) {
        case 'sync': handleSyncContinue(); break;
        case 'signin': handleSignIn(); break;
        case 'signup': handleSignUp(); break;
        case 'forgot': handleForgotPassword(); break;
      }
    }
  };

  // Navigate to forgot password with pre-filled email
  const goToForgotPassword = () => {
    setForgotEmail(email);
    navigateTo('forgot');
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

          {/* ==================== SYNC EMAIL PANEL ==================== */}
          {panel === 'sync' && (
            <div className="signin__panel">
              {/* Avatar */}
              <div className="signin__avatar">
                <span className="material-symbols-outlined signin__avatar-icon">person</span>
              </div>

              {/* Title */}
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
              <div className="signin__form">
                {/* Suggested accounts */}
                <div className="signin__suggested">
                  <span className="signin__suggested-label">Suggested accounts</span>
                  <span className="material-symbols-outlined signin__info-icon" title="Email accounts detected on this device">info</span>
                </div>

                <div className="signin__input-wrapper">
                  <input
                    type="email"
                    className="signin__input"
                    placeholder="Enter your email"
                    value={syncEmail}
                    onChange={(e) => {
                      setSyncEmail(e.target.value);
                      validateEmailField(e.target.value, 'syncEmail');
                    }}
                    onKeyDown={handleKeyDown}
                    autoFocus
                  />
                  <span className="material-symbols-outlined signin__input-arrow">arrow_drop_down</span>
                </div>
                {errors.syncEmail && <div className="signin__field-error">{errors.syncEmail}</div>}

                <div className="signin__create-account">
                  <span>No account? </span>
                  <button type="button" className="signin__link-btn" onClick={() => navigateTo('signup')}>
                    Create a JubileeOutlook account
                  </button>
                </div>

                <button
                  type="button"
                  className="signin__gold-btn"
                  disabled={!syncEmail.trim()}
                  onClick={handleSyncContinue}
                >
                  Continue
                </button>
              </div>

              <p className="signin__footer">&copy; 2026 Jubilee Software, Inc.</p>
            </div>
          )}

          {/* ==================== SIGN IN / SIGN UP / FORGOT PANELS ==================== */}
          {panel !== 'sync' && (
            <div className="signin__panel">
              {/* Avatar */}
              <div className="signin__avatar">
                <span className="material-symbols-outlined signin__avatar-icon">person</span>
              </div>

              {/* Branding */}
              <h1 className="signin__brand-heading">
                <span className="signin__brand-heading-jubilee">Jubilee</span>
                <span className="signin__brand-heading-outlook">Outlook</span>
              </h1>

              {/* Dynamic subtitle */}
              <p className="signin__subtext">
                {panel === 'signin' && 'Sign in to sync your email across devices'}
                {panel === 'signup' && 'Create an account to get started'}
                {panel === 'forgot' && 'Reset your password'}
              </p>

              {/* Sign Up link (only on Sign In panel) */}
              {panel === 'signin' && (
                <div className="signin__nav-link">
                  <span>Don't have an account? </span>
                  <button type="button" className="signin__link-btn" onClick={() => navigateTo('signup')}>
                    Sign Up.
                  </button>
                </div>
              )}

              {/* General error */}
              {errors.general && <div className="signin__error">{errors.general}</div>}

              {/* ===== SIGN IN FORM ===== */}
              {panel === 'signin' && (
                <div className="signin__form">
                  {/* Email */}
                  <div className="signin__input-wrapper">
                    <input
                      type="email"
                      className={`signin__input ${errors.email ? 'signin__input--error' : ''}`}
                      placeholder="Email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        validateEmailField(e.target.value, 'email');
                      }}
                      onKeyDown={handleKeyDown}
                      autoFocus
                    />
                  </div>
                  {errors.email && <div className="signin__field-error">{errors.email}</div>}

                  {/* Password with toggle */}
                  <div className="signin__input-wrapper signin__input-wrapper--password">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className={`signin__input ${errors.password ? 'signin__input--error' : ''}`}
                      placeholder="Password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        validateRequiredField(e.target.value, 'password');
                      }}
                      onKeyDown={handleKeyDown}
                    />
                    <button
                      type="button"
                      className="signin__password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                    >
                      <span className="material-symbols-outlined">
                        {showPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                  {errors.password && <div className="signin__field-error">{errors.password}</div>}

                  {/* Remember Me & Forgot Password row */}
                  <div className="signin__options-row">
                    <label className="signin__checkbox">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                      />
                      <span className="signin__checkbox-box">
                        {rememberMe && <span className="material-symbols-outlined signin__checkbox-check">check</span>}
                      </span>
                      <span className="signin__checkbox-label">Keep me signed in</span>
                    </label>
                    <button type="button" className="signin__link-btn" onClick={goToForgotPassword}>
                      Forgot Password?
                    </button>
                  </div>

                  {/* Sign In Button */}
                  <button
                    type="button"
                    className="signin__gold-btn"
                    disabled={loading}
                    onClick={handleSignIn}
                  >
                    {loading ? loadingText : 'Sign In'}
                  </button>

                  {/* Loading indicator */}
                  {loading && <div className="signin__loading-text">{loadingText}</div>}
                </div>
              )}

              {/* ===== SIGN UP FORM ===== */}
              {panel === 'signup' && (
                <div className="signin__form">
                  {/* Full Name */}
                  <div className="signin__input-wrapper">
                    <input
                      type="text"
                      className={`signin__input ${errors.fullName ? 'signin__input--error' : ''}`}
                      placeholder="Full Name"
                      value={signUpFullName}
                      onChange={(e) => {
                        setSignUpFullName(e.target.value);
                        validateRequiredField(e.target.value, 'fullName', 2);
                      }}
                      onKeyDown={handleKeyDown}
                      autoFocus
                    />
                  </div>
                  {errors.fullName && <div className="signin__field-error">{errors.fullName}</div>}

                  {/* Email */}
                  <div className="signin__input-wrapper">
                    <input
                      type="email"
                      className={`signin__input ${errors.signUpEmail ? 'signin__input--error' : ''}`}
                      placeholder="Email"
                      value={signUpEmail}
                      onChange={(e) => {
                        setSignUpEmail(e.target.value);
                        validateEmailField(e.target.value, 'signUpEmail');
                      }}
                      onKeyDown={handleKeyDown}
                    />
                  </div>
                  {errors.signUpEmail && <div className="signin__field-error">{errors.signUpEmail}</div>}

                  {/* Password with toggle */}
                  <div className="signin__input-wrapper signin__input-wrapper--password">
                    <input
                      type={showSignUpPassword ? 'text' : 'password'}
                      className={`signin__input ${errors.signUpPassword ? 'signin__input--error' : ''}`}
                      placeholder="Password"
                      value={signUpPassword}
                      onChange={(e) => {
                        setSignUpPassword(e.target.value);
                        validateRequiredField(e.target.value, 'signUpPassword', 6);
                      }}
                      onKeyDown={handleKeyDown}
                    />
                    <button
                      type="button"
                      className="signin__password-toggle"
                      onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                      tabIndex={-1}
                    >
                      <span className="material-symbols-outlined">
                        {showSignUpPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                  {errors.signUpPassword && <div className="signin__field-error">{errors.signUpPassword}</div>}

                  {/* Confirm Password with toggle */}
                  <div className="signin__input-wrapper signin__input-wrapper--password">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      className={`signin__input ${errors.confirmPassword ? 'signin__input--error' : ''}`}
                      placeholder="Confirm Password"
                      value={signUpConfirmPassword}
                      onChange={(e) => {
                        setSignUpConfirmPassword(e.target.value);
                        if (errors.confirmPassword && e.target.value === signUpPassword) {
                          clearError('confirmPassword');
                        }
                      }}
                      onKeyDown={handleKeyDown}
                    />
                    <button
                      type="button"
                      className="signin__password-toggle"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      tabIndex={-1}
                    >
                      <span className="material-symbols-outlined">
                        {showConfirmPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                  {errors.confirmPassword && <div className="signin__field-error">{errors.confirmPassword}</div>}

                  {/* Newsletter checkbox */}
                  <label className="signin__checkbox signin__checkbox--newsletter">
                    <input
                      type="checkbox"
                      checked={newsletter}
                      onChange={(e) => setNewsletter(e.target.checked)}
                    />
                    <span className="signin__checkbox-box">
                      {newsletter && <span className="material-symbols-outlined signin__checkbox-check">check</span>}
                    </span>
                    <span className="signin__checkbox-label">Subscribe to newsletter</span>
                  </label>

                  {/* Sign Up Button */}
                  <button
                    type="button"
                    className="signin__gold-btn"
                    disabled={loading}
                    onClick={handleSignUp}
                  >
                    {loading ? loadingText : 'Sign Up'}
                  </button>

                  {loading && <div className="signin__loading-text">{loadingText}</div>}

                  {/* Back links */}
                  <div className="signin__back-links">
                    <span>Already have an account? </span>
                    <button type="button" className="signin__link-btn" onClick={() => navigateTo('signin')}>
                      Sign In
                    </button>
                    <span className="signin__link-separator"> | </span>
                    <button type="button" className="signin__link-btn" onClick={() => navigateTo('sync')}>
                      Sync Existing
                    </button>
                  </div>
                </div>
              )}

              {/* ===== FORGOT PASSWORD FORM ===== */}
              {panel === 'forgot' && (
                <div className="signin__form">
                  <p className="signin__forgot-desc">
                    Enter your email address and we'll send you a link to reset your password.
                  </p>

                  {errors.forgotSuccess && <div className="signin__success-msg">{errors.forgotSuccess}</div>}

                  <div className="signin__input-wrapper">
                    <input
                      type="email"
                      className={`signin__input ${errors.forgotEmail ? 'signin__input--error' : ''}`}
                      placeholder="Email"
                      value={forgotEmail}
                      onChange={(e) => {
                        setForgotEmail(e.target.value);
                        validateEmailField(e.target.value, 'forgotEmail');
                      }}
                      onKeyDown={handleKeyDown}
                      autoFocus
                    />
                  </div>
                  {errors.forgotEmail && <div className="signin__field-error">{errors.forgotEmail}</div>}

                  <button
                    type="button"
                    className="signin__gold-btn"
                    disabled={loading}
                    onClick={handleForgotPassword}
                  >
                    {loading ? loadingText : 'Send Reset Link'}
                  </button>

                  {loading && <div className="signin__loading-text">{loadingText}</div>}

                  <div className="signin__back-links">
                    <button type="button" className="signin__link-btn" onClick={() => navigateTo('signin')}>
                      Back to Sign In
                    </button>
                  </div>
                </div>
              )}

              <p className="signin__footer">&copy; 2026 Jubilee Software, Inc.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SignIn;
