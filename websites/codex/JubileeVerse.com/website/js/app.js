/**
 * JubileeVerse Main Application
 * Entry point for frontend JavaScript
 */

(function() {
  'use strict';

  /**
   * Initialize application
   */
  async function init() {
    // Initialize analytics (disabled by default, enable in production)
    if (typeof AnalyticsModule !== 'undefined') {
      AnalyticsModule.init({
        enabled: false, // Set to true in production
        providers: [AnalyticsModule.providers.console]
      });
    }

    // Apply saved theme
    applyTheme();

    // Set up global error handler
    setupErrorHandler();

    console.log('JubileeVerse initialized');
  }

  /**
   * Apply saved theme preference
   * Respects: 1) localStorage preference, 2) system preference, 3) defaults to light
   */
  function applyTheme() {
    const savedTheme = localStorage.getItem('jv-theme');

    if (savedTheme) {
      // User has explicitly chosen a theme
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      // Use system preference (CSS will handle this via media query, but we set it for consistency)
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      // Default to light theme
      document.documentElement.setAttribute('data-theme', 'light');
    }

    // Listen for system theme changes
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        // Only respond to system changes if user hasn't set a preference
        if (!localStorage.getItem('jv-theme')) {
          document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
        }
      });
    }
  }

  /**
   * Set theme
   */
  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('jv-theme', theme);
  }

  /**
   * Toggle theme between light and dark
   */
  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = current === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    return newTheme;
  }

  /**
   * Set up global error handler
   */
  function setupErrorHandler() {
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);

      // Track error if analytics enabled
      if (typeof AnalyticsModule !== 'undefined') {
        AnalyticsModule.track('unhandled_rejection', {
          reason: event.reason?.message || String(event.reason)
        });
      }
    });
  }

  /**
   * Show toast notification
   */
  function showToast(message, type = 'info', duration = 3000) {
    // Create toast container if doesn't exist
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 10px;
      `;
      document.body.appendChild(container);
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.style.cssText = `
      padding: 12px 20px;
      border-radius: 8px;
      background: var(--color-neutral-800);
      color: var(--color-neutral-0);
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      animation: slideIn 0.3s ease;
    `;

    if (type === 'success') {
      toast.style.background = 'var(--color-success)';
    } else if (type === 'error') {
      toast.style.background = 'var(--color-error)';
    } else if (type === 'warning') {
      toast.style.background = 'var(--color-warning)';
      toast.style.color = 'var(--color-neutral-900)';
    }

    toast.textContent = message;
    container.appendChild(toast);

    // Remove after duration
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => {
        toast.remove();
        if (container.children.length === 0) {
          container.remove();
        }
      }, 300);
    }, duration);
  }

  /**
   * Format date for display
   */
  function formatDate(dateString, options = {}) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (options.relative) {
      if (diffMs < 60000) return 'Just now';
      if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;
      if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;
    }

    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...options
    });
  }

  /**
   * Debounce function
   */
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Throttle function
   */
  function throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * Escape HTML to prevent XSS
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Get initials from name
   */
  function getInitials(name) {
    if (!name) return 'U';
    return name.split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  // Expose public API
  window.JubileeVerse = {
    init,
    setTheme,
    toggleTheme,
    showToast,
    formatDate,
    debounce,
    throttle,
    escapeHtml,
    getInitials
  };

  // Add animation keyframes
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }
  `;
  document.head.appendChild(style);

  // Initialize on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
