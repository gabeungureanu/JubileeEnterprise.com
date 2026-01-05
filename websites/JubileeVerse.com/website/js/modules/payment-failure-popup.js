/**
 * Payment Failure Notification Popup Module
 * Shows a notification banner when a user's payment has failed
 * Only shows once per day (can be dismissed)
 */

const PaymentFailurePopup = (function() {
  let popupElement = null;
  let isInitialized = false;

  /**
   * Create the popup HTML element
   */
  function createPopupElement() {
    const popup = document.createElement('div');
    popup.id = 'payment-failure-popup';
    popup.className = 'payment-failure-popup';
    popup.setAttribute('role', 'alert');
    popup.setAttribute('aria-live', 'polite');

    popup.innerHTML = `
      <div class="payment-failure-popup__content">
        <div class="payment-failure-popup__left">
          <div class="payment-failure-popup__icon">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
          </div>
          <div class="payment-failure-popup__text">
            <p class="payment-failure-popup__title" id="payment-failure-title">Payment failed</p>
            <p class="payment-failure-popup__message" id="payment-failure-message">Your latest payment has failed. Update your payment method to continue this subscription.</p>
          </div>
        </div>
        <div class="payment-failure-popup__actions">
          <a href="/payment-update" class="payment-failure-popup__btn payment-failure-popup__btn--primary">
            Update payment
          </a>
          <button type="button" class="payment-failure-popup__close" aria-label="Dismiss notification" onclick="PaymentFailurePopup.dismiss()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
    `;

    return popup;
  }

  /**
   * Show the popup with optional custom message
   * @param {Object} options - Display options
   * @param {string} options.planName - Name of the plan (e.g., "Business Edition")
   * @param {string} options.gracePeriodEnd - Date when access will be revoked (e.g., "Dec 29, 2025")
   * @param {number} options.daysRemaining - Number of days remaining in grace period
   */
  function show(options = {}) {
    if (!popupElement) {
      popupElement = createPopupElement();
      document.body.appendChild(popupElement);
    }

    // Update title based on plan name
    const titleEl = document.getElementById('payment-failure-title');
    const messageEl = document.getElementById('payment-failure-message');

    if (options.planName) {
      titleEl.textContent = `${options.planName} failed to renew`;
    } else {
      titleEl.textContent = 'Payment failed';
    }

    // Update message based on grace period
    if (options.gracePeriodEnd) {
      messageEl.textContent = `Update your payment details before ${options.gracePeriodEnd} to continue accessing your subscription.`;
    } else if (options.daysRemaining !== undefined) {
      if (options.daysRemaining === 0) {
        messageEl.textContent = 'Your subscription access will be suspended today. Update your payment method now.';
      } else if (options.daysRemaining === 1) {
        messageEl.textContent = 'Update your payment details within 1 day to continue accessing your subscription.';
      } else {
        messageEl.textContent = `Update your payment details within ${options.daysRemaining} days to continue accessing your subscription.`;
      }
    } else {
      messageEl.textContent = 'Your latest payment has failed. Update your payment method to continue this subscription.';
    }

    // Show with animation
    requestAnimationFrame(() => {
      popupElement.classList.add('is-visible');
    });

    // Record that the notification was shown
    recordNotificationShown();
  }

  /**
   * Hide the popup
   */
  function hide() {
    if (popupElement) {
      popupElement.classList.remove('is-visible');
    }
  }

  /**
   * Dismiss the popup and record dismissal
   */
  function dismiss() {
    hide();

    // Record dismissal to the server
    fetch('/api/billing/dismiss-payment-notification', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    }).catch(err => {
      console.error('Error dismissing payment notification:', err);
    });

    // Also store in localStorage as a backup
    localStorage.setItem('jv-payment-notification-dismissed', new Date().toDateString());
  }

  /**
   * Record that the notification was shown
   */
  function recordNotificationShown() {
    fetch('/api/billing/record-payment-notification-shown', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    }).catch(err => {
      console.error('Error recording payment notification shown:', err);
    });
  }

  /**
   * Check if we should show the notification today
   * Returns true if not dismissed today
   */
  function shouldShowToday() {
    const dismissed = localStorage.getItem('jv-payment-notification-dismissed');
    if (!dismissed) return true;

    const today = new Date().toDateString();
    return dismissed !== today;
  }

  /**
   * Check payment status and show notification if needed
   * This is the main entry point called on page load
   */
  async function checkAndShow() {
    // Skip if already dismissed today (quick local check)
    if (!shouldShowToday()) {
      return;
    }

    try {
      const response = await fetch('/api/billing/check-payment-status', {
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();

      if (data.success && data.hasFailure && data.showNotification) {
        show({
          planName: data.planName,
          gracePeriodEnd: data.gracePeriodEndsAt ? formatDate(data.gracePeriodEndsAt) : null,
          daysRemaining: data.daysRemaining
        });
      }
    } catch (error) {
      console.error('Error checking payment status:', error);
    }
  }

  /**
   * Format a date string to a readable format
   * @param {string} dateStr - ISO date string
   * @returns {string} Formatted date (e.g., "Dec 29, 2025")
   */
  function formatDate(dateStr) {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  }

  /**
   * Initialize the module
   * Automatically checks payment status on page load
   */
  function init() {
    if (isInitialized) return;
    isInitialized = true;

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', checkAndShow);
    } else {
      // Small delay to not block initial page render
      setTimeout(checkAndShow, 500);
    }
  }

  // Public API
  return {
    init,
    show,
    hide,
    dismiss,
    checkAndShow
  };
})();

// Auto-initialize
PaymentFailurePopup.init();

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PaymentFailurePopup;
}
