/**
 * Authentication Module
 * Handles user session state and auth UI updates
 */

const AuthModule = (function() {
  let currentUser = null;
  let isInitialized = false;

  /**
   * Check authentication status
   */
  async function checkAuth() {
    try {
      const response = await fetch('/auth/me', {
        headers: { 'Accept': 'application/json' }
      });
      const data = await response.json();
      currentUser = data.user;
      updateAuthUI();
      return currentUser;
    } catch (error) {
      console.error('Auth check failed:', error);
      currentUser = null;
      updateAuthUI();
      return null;
    }
  }

  /**
   * Update UI based on auth state
   */
  function updateAuthUI() {
    const guestElements = document.querySelectorAll('#header-guest, #mobile-nav-guest');
    const authElements = document.querySelectorAll('#header-auth, #mobile-nav-auth');

    if (currentUser) {
      // User is logged in
      guestElements.forEach(el => el.style.display = 'none');
      authElements.forEach(el => el.style.display = 'flex');

      // Update user info
      const userName = document.getElementById('user-name');
      const userInitials = document.getElementById('user-initials');
      const userAvatar = document.getElementById('user-avatar');

      if (userName) userName.textContent = currentUser.name;
      if (userInitials) userInitials.textContent = getInitials(currentUser.name);
      if (userAvatar) userAvatar.textContent = getInitials(currentUser.name);
    } else {
      // User is logged out
      guestElements.forEach(el => el.style.display = 'flex');
      authElements.forEach(el => el.style.display = 'none');
    }

    isInitialized = true;
  }

  /**
   * Handle logout
   */
  async function logout() {
    try {
      const response = await fetch('/auth/logout', {
        method: 'POST',
        headers: { 'Accept': 'application/json' }
      });
      const data = await response.json();

      if (data.success) {
        currentUser = null;
        updateAuthUI();
        window.location.href = data.redirect || '/';
      }
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }

  /**
   * Get user initials from name
   */
  function getInitials(name) {
    if (!name) return 'U';
    return name.split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  /**
   * Get current user
   */
  function getUser() {
    return currentUser;
  }

  /**
   * Check if user is authenticated
   */
  function isAuthenticated() {
    return !!currentUser;
  }

  /**
   * Initialize auth module
   */
  function init() {
    // Set up logout handlers
    const logoutBtn = document.getElementById('logout-btn');
    const mobileLogoutBtn = document.getElementById('mobile-logout-btn');

    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        logout();
      });
    }

    if (mobileLogoutBtn) {
      mobileLogoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        logout();
      });
    }

    // Check auth status
    checkAuth();
  }

  // Public API
  return {
    init,
    checkAuth,
    logout,
    getUser,
    isAuthenticated,
    getInitials
  };
})();

// Initialize after header is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Wait for header to be loaded
  const headerContainer = document.getElementById('header-container');
  if (headerContainer) {
    headerContainer.addEventListener('partial-loaded', () => {
      AuthModule.init();
    });
  } else {
    // No header container, init immediately
    AuthModule.init();
  }
});

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AuthModule;
}
