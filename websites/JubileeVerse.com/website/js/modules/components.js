/**
 * Component Loader Module
 * Handles dynamic loading and injection of HTML partials
 * Supports context-aware menu behavior based on page type
 */

const ComponentLoader = (function() {
  const cache = new Map();

  // Page-specific menu behavior registry
  // Pages can register custom menu toggle handlers
  let customMenuHandler = null;

  /**
   * Load HTML partial from server
   */
  async function loadPartial(name) {
    if (cache.has(name)) {
      return cache.get(name);
    }

    try {
      const response = await fetch(`/partials/${name}.html`);
      if (!response.ok) {
        throw new Error(`Failed to load partial: ${name}`);
      }
      const html = await response.text();
      cache.set(name, html);
      return html;
    } catch (error) {
      console.error(`Error loading partial ${name}:`, error);
      return '';
    }
  }

  /**
   * Inject partial into container
   */
  async function inject(containerSelector, partialName) {
    const container = document.querySelector(containerSelector);
    if (!container) {
      console.warn(`Container not found: ${containerSelector}`);
      return;
    }

    const html = await loadPartial(partialName);
    container.innerHTML = html;

    // Trigger custom event for post-injection setup
    container.dispatchEvent(new CustomEvent('partial-loaded', {
      detail: { name: partialName }
    }));
  }

  /**
   * Register a custom menu toggle handler for the current page
   * This allows pages like chat to override the default slide panel behavior
   * @param {Function} handler - Function to call when menu is toggled
   */
  function registerMenuHandler(handler) {
    customMenuHandler = handler;
  }

  /**
   * Clear any custom menu handler (useful for SPA navigation)
   */
  function clearMenuHandler() {
    customMenuHandler = null;
  }

  /**
   * Check if a custom menu handler is registered
   */
  function hasCustomMenuHandler() {
    return customMenuHandler !== null;
  }

  /**
   * Check if the current page should use the slide panel behavior
   * Returns true for search/home pages, false for other app pages
   */
  function shouldUseSlidePanel() {
    const path = window.location.pathname;
    // Search and home pages use the slide panel
    // All other pages (chat, etc.) use custom behavior
    return path === '/' || path === '/search' || path === '/home';
  }

  /**
   * Initialize standard page components
   */
  async function initPage() {
    // Load header
    const headerContainer = document.getElementById('header-container');
    if (headerContainer) {
      await inject('#header-container', 'header');
      initHeader();
    }

    // Load sidebar
    const sidebarContainer = document.getElementById('sidebar-container');
    if (sidebarContainer) {
      await inject('#sidebar-container', 'sidebar');
      initSidebar();
    }

    // Load footer
    const footerContainer = document.getElementById('footer-container');
    if (footerContainer) {
      await inject('#footer-container', 'footer');
    }

    // Set active nav link
    setActiveNavLink();
  }

  /**
   * Check if the current page is the home page
   */
  function isHomePage() {
    const path = window.location.pathname;
    return path === '/home';
  }

  /**
   * Initialize sidebar functionality with context-aware menu behavior
   */
  function initSidebar() {
    var menuToggle = document.getElementById('menuToggle');
    var slidePanel = document.getElementById('slidePanel');
    var sidebar = document.querySelector('.sidebar');

    // Set menu icon highlight based on page
    // Yellow on home page, gray on all other pages
    if (menuToggle) {
      if (isHomePage()) {
        menuToggle.classList.add('is-highlight');
      } else {
        menuToggle.classList.remove('is-highlight');
      }
    }

    if (menuToggle) {
      menuToggle.addEventListener('click', function(e) {
        e.stopPropagation();

        // Check if there's a custom handler registered (e.g., for chat page)
        if (customMenuHandler) {
          customMenuHandler(e);
          return;
        }

        // Default behavior: toggle slide panel (for home/search pages)
        if (slidePanel && shouldUseSlidePanel()) {
          slidePanel.classList.toggle('open');
        }
      });

      // Keyboard accessibility
      menuToggle.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          menuToggle.click();
        }
      });
    }

    // Close slide panel when clicking outside (only if using slide panel behavior)
    if (slidePanel) {
      document.addEventListener('click', function(e) {
        if (slidePanel.classList.contains('open') && shouldUseSlidePanel() && !customMenuHandler) {
          if (!slidePanel.contains(e.target) && sidebar && !sidebar.contains(e.target)) {
            slidePanel.classList.remove('open');
          }
        }
      });
    }

    // Hover sync between sidebar icons and slide panel items
    var sidebarIcons = document.querySelectorAll('.sidebar-icon[data-nav]');
    var slidePanelItems = document.querySelectorAll('.slide-panel-item[data-nav]');

    sidebarIcons.forEach(function(icon) {
      icon.addEventListener('mouseenter', function() {
        var navId = this.getAttribute('data-nav');
        var panelItem = document.querySelector('.slide-panel-item[data-nav="' + navId + '"]');
        if (panelItem) {
          panelItem.classList.add('hover-highlight');
        }
      });
      icon.addEventListener('mouseleave', function() {
        var navId = this.getAttribute('data-nav');
        var panelItem = document.querySelector('.slide-panel-item[data-nav="' + navId + '"]');
        if (panelItem) {
          panelItem.classList.remove('hover-highlight');
        }
      });
      icon.addEventListener('click', function() {
        var navId = this.getAttribute('data-nav');
        var panelItem = document.querySelector('.slide-panel-item[data-nav="' + navId + '"]');
        if (panelItem && panelItem.href) {
          window.location.href = panelItem.href;
        }
      });
    });

    slidePanelItems.forEach(function(item) {
      item.addEventListener('mouseenter', function() {
        var navId = this.getAttribute('data-nav');
        var sidebarIcon = document.querySelector('.sidebar-icon[data-nav="' + navId + '"]');
        if (sidebarIcon) {
          sidebarIcon.classList.add('hover-highlight');
        }
      });
      item.addEventListener('mouseleave', function() {
        var navId = this.getAttribute('data-nav');
        var sidebarIcon = document.querySelector('.sidebar-icon[data-nav="' + navId + '"]');
        if (sidebarIcon) {
          sidebarIcon.classList.remove('hover-highlight');
        }
      });
    });
  }

  /**
   * Initialize header functionality
   */
  function initHeader() {
    // Theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        if (typeof JubileeVerse !== 'undefined' && JubileeVerse.toggleTheme) {
          JubileeVerse.toggleTheme();
        } else {
          // Fallback if main app not loaded
          const current = document.documentElement.getAttribute('data-theme') || 'light';
          const newTheme = current === 'light' ? 'dark' : 'light';
          document.documentElement.setAttribute('data-theme', newTheme);
          localStorage.setItem('jv-theme', newTheme);
        }
      });
    }

    // Mobile menu toggle
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileNav = document.getElementById('mobile-nav');

    if (mobileMenuBtn && mobileNav) {
      mobileMenuBtn.addEventListener('click', () => {
        mobileNav.classList.toggle('is-open');
      });

      // Close mobile nav when clicking a link
      mobileNav.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
          mobileNav.classList.remove('is-open');
        });
      });
    }

    // User dropdown toggle
    const userDropdown = document.getElementById('user-dropdown');
    if (userDropdown) {
      const trigger = userDropdown.querySelector('.header__user');
      trigger?.addEventListener('click', (e) => {
        e.stopPropagation();
        userDropdown.classList.toggle('is-open');
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', () => {
        userDropdown.classList.remove('is-open');
      });
    }

    // Check auth status and update auth button
    checkAuthStatus();
  }

  /**
   * Check authentication status and update UI
   */
  function checkAuthStatus() {
    var authBtn = document.getElementById('authBtn');
    var authBtnText = document.getElementById('authBtnText');
    var upgradeLink = document.getElementById('upgradeLink');
    var upgradeSep = document.getElementById('upgradeSep');
    var userNameLink = document.getElementById('userNameLink');
    var userNameSep = document.getElementById('userNameSep');
    var adminLink = document.getElementById('adminLink');
    var adminSep = document.getElementById('adminSep');

    if (!authBtn || !authBtnText) return;

    fetch('/auth/me', {
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    })
    .then(function(response) {
      return response.json();
    })
    .then(function(data) {
      if (data.success && data.user) {
        // User is authenticated - show Sign Out
        authBtnText.textContent = 'Sign Out';
        authBtn.href = '#';
        authBtn.onclick = function(e) {
          e.preventDefault();
          fetch('/auth/logout', {
            method: 'POST',
            headers: { 'Accept': 'application/json' }
          })
          .then(function() {
            window.location.reload();
          });
        };

        // Show user's name
        if (userNameLink && userNameSep) {
          var displayName = data.user.displayName || data.user.name || data.user.email.split('@')[0];
          userNameLink.textContent = displayName;
          userNameLink.style.display = 'inline';
          userNameSep.style.display = 'inline';
        }

        // Show Upgrade link only for free plan users
        if (upgradeLink && upgradeSep) {
          var planSlug = data.user.subscriptionPlan || data.user.planSlug || 'free';
          if (planSlug === 'free') {
            upgradeLink.style.display = 'inline';
            upgradeSep.style.display = 'inline';
          } else {
            upgradeLink.style.display = 'none';
            upgradeSep.style.display = 'none';
          }
        }

        // Show Admin link only for admin users
        if (adminLink && adminSep) {
          if (data.user.role === 'admin') {
            adminLink.style.display = 'inline';
            adminSep.style.display = 'inline';
          } else {
            adminLink.style.display = 'none';
            adminSep.style.display = 'none';
          }
        }

        // Update sidebar avatar if user has avatar
        if (data.user.avatar) {
          var sidebarAvatar = document.querySelector('.sidebar-avatar img');
          if (sidebarAvatar) {
            sidebarAvatar.src = data.user.avatar;
          }
        }
      } else {
        // User not authenticated - hide user-specific elements
        if (upgradeLink) upgradeLink.style.display = 'none';
        if (upgradeSep) upgradeSep.style.display = 'none';
        if (userNameLink) userNameLink.style.display = 'none';
        if (userNameSep) userNameSep.style.display = 'none';
        if (adminLink) adminLink.style.display = 'none';
        if (adminSep) adminSep.style.display = 'none';
      }
    })
    .catch(function() {
      // Keep default "Sign In" state
      if (upgradeLink) upgradeLink.style.display = 'none';
      if (upgradeSep) upgradeSep.style.display = 'none';
      if (userNameLink) userNameLink.style.display = 'none';
      if (userNameSep) userNameSep.style.display = 'none';
      if (adminLink) adminLink.style.display = 'none';
      if (adminSep) adminSep.style.display = 'none';
    });
  }

  /**
   * Set active navigation link based on current path
   */
  function setActiveNavLink() {
    const currentPath = window.location.pathname;

    // Set active for header links
    const headerLinks = document.querySelectorAll('.header-link[data-nav]');
    headerLinks.forEach(link => {
      const navPath = link.getAttribute('data-nav');
      const isActive = currentPath === navPath ||
        (navPath !== '/' && currentPath.startsWith(navPath));
      link.classList.toggle('active', isActive);
    });

    // Set active for sidebar icons based on current page
    const sidebarIcons = document.querySelectorAll('.sidebar-icon[data-nav]');
    sidebarIcons.forEach(icon => {
      const navId = icon.getAttribute('data-nav');
      let isActive = false;

      // Map paths to nav IDs
      if (navId === 'home' && currentPath === '/home') {
        isActive = true;
      } else if (navId === 'chatinbox' && currentPath.startsWith('/chat')) {
        isActive = true;
      } else if (navId === 'search' && (currentPath === '/search' || currentPath === '/')) {
        isActive = true;
      } else if (navId === 'communities' && currentPath.startsWith('/communities')) {
        isActive = true;
      } else if (navId === 'ministries' && currentPath.startsWith('/ministries')) {
        isActive = true;
      } else if (navId === 'projects' && currentPath.startsWith('/projects')) {
        isActive = true;
      } else if (navId === 'music' && currentPath.startsWith('/music')) {
        isActive = true;
      } else if (navId === 'bible' && currentPath.startsWith('/bible')) {
        isActive = true;
      } else if (navId === 'books' && currentPath.startsWith('/books')) {
        isActive = true;
      } else if (navId === 'articles' && currentPath.startsWith('/articles')) {
        isActive = true;
      }

      icon.classList.toggle('is-active', isActive);
    });

    // Set active for slide panel items
    const slidePanelItems = document.querySelectorAll('.slide-panel-item[data-nav]');
    slidePanelItems.forEach(item => {
      const navId = item.getAttribute('data-nav');
      const icon = document.querySelector('.sidebar-icon[data-nav="' + navId + '"]');
      if (icon && icon.classList.contains('is-active')) {
        item.classList.add('is-active');
      }
    });
  }

  // Public API
  return {
    load: loadPartial,
    inject,
    initPage,
    setActiveNavLink,
    registerMenuHandler,
    clearMenuHandler,
    hasCustomMenuHandler,
    shouldUseSlidePanel
  };
})();

// Auto-initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  ComponentLoader.initPage();

  // Load payment failure popup module if user is authenticated
  // This checks payment status once per day and shows notification if needed
  loadPaymentFailurePopup();
});

/**
 * Dynamically load the payment failure popup module
 * Only loads if user might be authenticated (has session)
 */
function loadPaymentFailurePopup() {
  // Skip loading on auth pages
  const authPages = ['/login', '/register', '/forgot-password', '/reset-password'];
  if (authPages.includes(window.location.pathname)) {
    return;
  }

  // Dynamically load the payment failure popup script
  const script = document.createElement('script');
  script.src = '/js/modules/payment-failure-popup.js';
  script.async = true;
  document.body.appendChild(script);
}

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ComponentLoader;
}
