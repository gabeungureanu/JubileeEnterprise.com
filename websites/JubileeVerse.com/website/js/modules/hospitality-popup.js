/**
 * Hospitality Popup Module
 * Displays contextual hospitality popups based on engagement rules.
 * Follows the IIFE pattern matching payment-failure-popup.js
 */

const HospitalityPopup = (function() {
  let popupElement = null;
  let isInitialized = false;
  let currentAction = null;
  let checkInterval = null;
  let wsConnection = null;

  // Configuration
  const CHECK_INTERVAL_MS = 60000; // Check every 60 seconds
  const INITIAL_DELAY_MS = 3000;   // Wait 3 seconds before first check
  const ANIMATION_DURATION_MS = 300;

  // ============================================
  // Popup Creation
  // ============================================

  /**
   * Create the popup HTML element
   */
  function createPopupElement() {
    const popup = document.createElement('div');
    popup.id = 'hospitality-popup';
    popup.className = 'hospitality-popup';
    popup.setAttribute('role', 'dialog');
    popup.setAttribute('aria-modal', 'true');
    popup.setAttribute('aria-live', 'polite');
    popup.setAttribute('aria-labelledby', 'hospitality-title');

    popup.innerHTML = `
      <div class="hospitality-popup__overlay" onclick="HospitalityPopup.dismiss()"></div>
      <div class="hospitality-popup__content">
        <button type="button" class="hospitality-popup__close" aria-label="Close" onclick="HospitalityPopup.dismiss()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        <div class="hospitality-popup__persona">
          <img src="" alt="" class="hospitality-popup__avatar" id="hospitality-avatar">
          <span class="hospitality-popup__persona-name" id="hospitality-persona-name"></span>
        </div>

        <div class="hospitality-popup__body">
          <h3 class="hospitality-popup__title" id="hospitality-title"></h3>
          <p class="hospitality-popup__message" id="hospitality-message"></p>
        </div>

        <div class="hospitality-popup__actions" id="hospitality-actions">
          <!-- Dynamic buttons inserted here -->
        </div>
      </div>
    `;

    return popup;
  }

  // ============================================
  // Popup Display
  // ============================================

  /**
   * Show the popup with action configuration
   * @param {Object} action - Action object from API
   */
  function show(action) {
    if (!action) return;

    currentAction = action;
    const config = action.config || {};

    // Create popup if it doesn't exist
    if (!popupElement) {
      popupElement = createPopupElement();
      document.body.appendChild(popupElement);
    }

    // Update persona avatar
    const avatarEl = document.getElementById('hospitality-avatar');
    const personaNameEl = document.getElementById('hospitality-persona-name');

    if (config.persona_avatar) {
      avatarEl.src = config.persona_avatar;
      avatarEl.alt = config.persona_name || 'Persona';
      avatarEl.style.display = 'block';
    } else {
      // Use default avatar
      avatarEl.src = '/website/images/personas/jubilee.png';
      avatarEl.alt = 'Jubilee';
      avatarEl.style.display = 'block';
    }

    if (config.persona_name) {
      personaNameEl.textContent = config.persona_name;
      personaNameEl.style.display = 'block';
    } else {
      personaNameEl.style.display = 'none';
    }

    // Update title and message
    document.getElementById('hospitality-title').textContent = config.title || 'Hello!';
    document.getElementById('hospitality-message').textContent = config.message || '';

    // Build action buttons
    const actionsEl = document.getElementById('hospitality-actions');
    actionsEl.innerHTML = '';

    // Primary action button
    if (config.primaryAction) {
      const primaryBtn = document.createElement('a');
      primaryBtn.href = config.primaryAction.url || '#';
      primaryBtn.className = 'hospitality-popup__btn hospitality-popup__btn--primary';
      primaryBtn.textContent = config.primaryAction.label || 'Continue';
      primaryBtn.onclick = function(e) {
        if (!config.primaryAction.url || config.primaryAction.url === '#') {
          e.preventDefault();
        }
        recordClicked();
        hide();
      };
      actionsEl.appendChild(primaryBtn);
    }

    // Secondary action button
    if (config.secondaryAction) {
      const secondaryBtn = document.createElement('button');
      secondaryBtn.type = 'button';
      secondaryBtn.className = 'hospitality-popup__btn hospitality-popup__btn--secondary';
      secondaryBtn.textContent = config.secondaryAction.label || 'Maybe later';
      secondaryBtn.onclick = function() {
        dismiss();
      };
      actionsEl.appendChild(secondaryBtn);
    }

    // Show with animation
    requestAnimationFrame(function() {
      popupElement.classList.add('is-visible');
      // Focus first button for accessibility
      const firstBtn = actionsEl.querySelector('a, button');
      if (firstBtn) {
        firstBtn.focus();
      }
    });

    // Record that popup was shown
    recordShown();

    // Handle escape key
    document.addEventListener('keydown', handleEscapeKey);
  }

  /**
   * Hide the popup
   */
  function hide() {
    if (popupElement) {
      popupElement.classList.remove('is-visible');
    }
    document.removeEventListener('keydown', handleEscapeKey);
    currentAction = null;
  }

  /**
   * Dismiss the popup (user explicitly closed it)
   */
  function dismiss() {
    hide();
    recordDismissed();
  }

  /**
   * Handle escape key to close popup
   */
  function handleEscapeKey(e) {
    if (e.key === 'Escape') {
      dismiss();
    }
  }

  // ============================================
  // API Communication
  // ============================================

  /**
   * Record that popup was shown
   */
  function recordShown() {
    if (!currentAction) return;

    fetch('/api/hospitality/shown', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actionId: currentAction.id,
        popupType: currentAction.actionType
      })
    }).catch(function(err) {
      console.debug('Error recording popup shown:', err);
    });
  }

  /**
   * Record popup dismissal
   */
  function recordDismissed() {
    if (!currentAction) return;

    fetch('/api/hospitality/dismiss', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actionId: currentAction.id
      })
    }).catch(function(err) {
      console.debug('Error recording popup dismissed:', err);
    });

    // Also store locally as backup
    try {
      const dismissedToday = localStorage.getItem('jv-hospitality-dismissed');
      const today = new Date().toDateString();
      if (dismissedToday !== today) {
        localStorage.setItem('jv-hospitality-dismissed-count', '1');
      } else {
        const count = parseInt(localStorage.getItem('jv-hospitality-dismissed-count') || '0', 10);
        localStorage.setItem('jv-hospitality-dismissed-count', (count + 1).toString());
      }
      localStorage.setItem('jv-hospitality-dismissed', today);
    } catch (e) {
      // localStorage not available
    }
  }

  /**
   * Record popup click
   */
  function recordClicked() {
    if (!currentAction) return;

    fetch('/api/hospitality/clicked', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actionId: currentAction.id
      })
    }).catch(function(err) {
      console.debug('Error recording popup clicked:', err);
    });
  }

  /**
   * Check for pending hospitality action
   */
  async function checkForAction() {
    // Don't check if popup is already visible
    if (popupElement && popupElement.classList.contains('is-visible')) {
      return;
    }

    // Check local dismissal count to avoid excessive popups
    try {
      const dismissedToday = localStorage.getItem('jv-hospitality-dismissed');
      const today = new Date().toDateString();
      if (dismissedToday === today) {
        const count = parseInt(localStorage.getItem('jv-hospitality-dismissed-count') || '0', 10);
        if (count >= 5) {
          // User has dismissed 5 times today, stop checking
          return;
        }
      }
    } catch (e) {
      // localStorage not available
    }

    try {
      const response = await fetch('/api/hospitality/check', {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) return;

      const data = await response.json();

      if (data.success && data.hasAction && data.action) {
        show(data.action);
      }
    } catch (error) {
      console.debug('Error checking hospitality action:', error);
    }
  }

  // ============================================
  // WebSocket Integration
  // ============================================

  /**
   * Set up WebSocket listener for real-time hospitality actions
   */
  function setupWebSocket() {
    // Check if global WebSocket connection exists
    if (window.wsConnection) {
      wsConnection = window.wsConnection;

      wsConnection.addEventListener('message', function(event) {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'hospitality_action' && data.action) {
            // Show the popup immediately
            show(data.action);
          }
        } catch (e) {
          // Not JSON or not our message type
        }
      });
    }
  }

  // ============================================
  // Initialization
  // ============================================

  /**
   * Initialize the module
   */
  function init() {
    if (isInitialized) return;
    isInitialized = true;

    // Initial check after page load (with delay)
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        setTimeout(checkForAction, INITIAL_DELAY_MS);
      });
    } else {
      setTimeout(checkForAction, INITIAL_DELAY_MS);
    }

    // Periodic check
    checkInterval = setInterval(checkForAction, CHECK_INTERVAL_MS);

    // WebSocket integration
    setupWebSocket();

    // If WebSocket not available immediately, try again after a delay
    setTimeout(function() {
      if (!wsConnection && window.wsConnection) {
        setupWebSocket();
      }
    }, 2000);
  }

  /**
   * Cleanup
   */
  function destroy() {
    if (checkInterval) {
      clearInterval(checkInterval);
      checkInterval = null;
    }

    if (popupElement) {
      popupElement.remove();
      popupElement = null;
    }

    document.removeEventListener('keydown', handleEscapeKey);
    isInitialized = false;
  }

  // ============================================
  // Public API
  // ============================================

  return {
    init: init,
    show: show,
    hide: hide,
    dismiss: dismiss,
    checkForAction: checkForAction,
    destroy: destroy
  };
})();

// Auto-initialize
HospitalityPopup.init();

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HospitalityPopup;
}
