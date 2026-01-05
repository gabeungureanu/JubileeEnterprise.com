/**
 * Hospitality Tracker Module
 * Tracks user engagement events and sends them to the hospitality API.
 * Auto-tracks page views, scroll depth, time on page, and session starts.
 * Exposes methods for tracking specific interactions.
 */

const HospitalityTracker = (function() {
  let isInitialized = false;
  let sessionStartTime = Date.now();
  let pageStartTime = Date.now();
  let maxScrollDepth = 0;
  let lastScrollTrackTime = 0;
  let timeOnPageInterval = null;
  let totalTimeOnPage = 0;

  // Debounce timer for scroll tracking
  const SCROLL_DEBOUNCE_MS = 500;
  const TIME_TRACK_INTERVAL_MS = 30000; // Track time every 30 seconds

  // ============================================
  // Core Tracking Function
  // ============================================

  /**
   * Send an event to the hospitality API
   * @param {string} eventType - Type of event (page_view, scroll_depth, etc.)
   * @param {Object} options - Additional event options
   */
  async function track(eventType, options = {}) {
    try {
      const payload = {
        eventType,
        eventSource: options.source || 'page',
        eventContext: options.context || {},
        pageUrl: window.location.href,
        pageTitle: document.title,
        personaId: options.personaId || getPersonaFromPage(),
        metricValue: options.value || null
      };

      await fetch('/api/hospitality/events', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      // Fail silently - tracking should not break the user experience
      console.debug('Hospitality tracking error:', error);
    }
  }

  // ============================================
  // Helper Functions
  // ============================================

  /**
   * Extract persona ID from page context
   * Looks for data attributes or URL parameters
   */
  function getPersonaFromPage() {
    // Check for persona ID in data attribute
    const personaEl = document.querySelector('[data-persona-id]');
    if (personaEl) {
      return personaEl.dataset.personaId;
    }

    // Check URL for persona parameter
    const urlParams = new URLSearchParams(window.location.search);
    const personaParam = urlParams.get('persona');
    if (personaParam) {
      // Return slug, API will resolve to ID if needed
      return personaParam;
    }

    // Check for persona in path (e.g., /chat/jubilee)
    const pathMatch = window.location.pathname.match(/\/chat\/([a-z-]+)/i);
    if (pathMatch) {
      return pathMatch[1];
    }

    return null;
  }

  /**
   * Check if element is visible in viewport
   */
  function isInViewport(element) {
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }

  // ============================================
  // Auto-Tracking Functions
  // ============================================

  /**
   * Track page view
   */
  function trackPageView() {
    pageStartTime = Date.now();
    maxScrollDepth = 0;
    totalTimeOnPage = 0;
    track('page_view');
  }

  /**
   * Track session start
   */
  function trackSessionStart() {
    sessionStartTime = Date.now();
    track('session_start');
  }

  /**
   * Track scroll depth
   * Only tracks significant increases (>10% change)
   */
  function trackScrollDepth() {
    const now = Date.now();

    // Debounce
    if (now - lastScrollTrackTime < SCROLL_DEBOUNCE_MS) {
      return;
    }

    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.offsetHeight
    ) - window.innerHeight;

    if (docHeight <= 0) return;

    const scrollPercent = Math.min(Math.round((scrollTop / docHeight) * 100), 100);

    // Only track if scroll depth increased by at least 10%
    if (scrollPercent > maxScrollDepth + 10) {
      maxScrollDepth = scrollPercent;
      lastScrollTrackTime = now;

      track('scroll_depth', {
        value: scrollPercent,
        context: { milestone: Math.floor(scrollPercent / 25) * 25 }
      });
    }
  }

  /**
   * Track time on page (periodic)
   */
  function trackTimeOnPage() {
    const timeOnPage = Math.round((Date.now() - pageStartTime) / 1000);

    // Only track meaningful time (>10 seconds)
    if (timeOnPage > 10 && timeOnPage !== totalTimeOnPage) {
      totalTimeOnPage = timeOnPage;
      track('time_on_page', {
        value: timeOnPage,
        context: { milestone: Math.floor(timeOnPage / 60) }
      });
    }
  }

  /**
   * Track time before page unload
   */
  function trackTimeBeforeUnload() {
    const timeOnPage = Math.round((Date.now() - pageStartTime) / 1000);
    if (timeOnPage > 10) {
      // Use sendBeacon for reliability on page unload
      const payload = JSON.stringify({
        eventType: 'time_on_page',
        eventSource: 'page',
        eventContext: { final: true },
        pageUrl: window.location.href,
        pageTitle: document.title,
        metricValue: timeOnPage
      });

      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/hospitality/events', new Blob([payload], { type: 'application/json' }));
      }
    }
  }

  // ============================================
  // Public Tracking Methods
  // ============================================

  /**
   * Track chat start
   * @param {string} personaId - ID or slug of persona
   */
  function trackChatStart(personaId) {
    track('chat_start', {
      personaId,
      source: 'chat',
      context: { method: 'user_initiated' }
    });
  }

  /**
   * Track chat message sent
   * @param {string} personaId - ID or slug of persona
   * @param {number} messageLength - Length of message (optional)
   */
  function trackChatMessage(personaId, messageLength = 0) {
    track('chat_message', {
      personaId,
      source: 'chat',
      value: messageLength,
      context: { hasContent: messageLength > 0 }
    });
  }

  /**
   * Track prayer request
   * @param {string} personaId - ID or slug of persona
   */
  function trackPrayerRequest(personaId) {
    track('prayer_request', {
      personaId,
      source: 'prayer',
      context: { type: 'prayer' }
    });
  }

  /**
   * Track Bible study interaction
   * @param {string} passage - Bible passage reference
   */
  function trackStudyInteraction(passage) {
    track('study_interaction', {
      source: 'study',
      context: { passage }
    });
  }

  /**
   * Track general feature interaction
   * @param {string} feature - Feature name
   * @param {string} action - Action taken
   * @param {Object} data - Additional data
   */
  function trackInteraction(feature, action, data = {}) {
    track('interaction', {
      source: 'feature',
      context: {
        feature,
        action,
        ...data
      }
    });
  }

  /**
   * Track music playback
   * @param {string} trackId - Music track ID
   * @param {string} action - play, pause, complete
   */
  function trackMusicPlayback(trackId, action) {
    track('music_playback', {
      source: 'music',
      context: {
        trackId,
        action
      }
    });
  }

  /**
   * Track community engagement
   * @param {string} communityId - Community ID
   * @param {string} action - join, post, comment, etc.
   */
  function trackCommunityEngagement(communityId, action) {
    track('community_engagement', {
      source: 'community',
      context: {
        communityId,
        action
      }
    });
  }

  /**
   * Track persona interaction (viewing, clicking)
   * @param {string} personaId - Persona ID or slug
   * @param {string} action - view, click, select
   */
  function trackPersonaInteraction(personaId, action) {
    track('persona_interaction', {
      personaId,
      source: 'persona',
      context: { action }
    });
  }

  // ============================================
  // Initialization
  // ============================================

  /**
   * Set up event listeners for auto-tracking
   */
  function setupAutoTracking() {
    // Track initial page view
    trackPageView();

    // Track scroll depth (throttled)
    let scrollTimeout;
    window.addEventListener('scroll', function() {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(trackScrollDepth, SCROLL_DEBOUNCE_MS);
    }, { passive: true });

    // Track time on page periodically
    timeOnPageInterval = setInterval(trackTimeOnPage, TIME_TRACK_INTERVAL_MS);

    // Track time before page unload
    window.addEventListener('beforeunload', trackTimeBeforeUnload);
    window.addEventListener('pagehide', trackTimeBeforeUnload);

    // Handle SPA navigation (if using pushState)
    if (window.history && window.history.pushState) {
      const originalPushState = window.history.pushState;
      window.history.pushState = function() {
        // Track time on previous page
        trackTimeBeforeUnload();

        // Apply original pushState
        originalPushState.apply(this, arguments);

        // Track new page view after a short delay
        setTimeout(trackPageView, 100);
      };

      // Handle back/forward navigation
      window.addEventListener('popstate', function() {
        setTimeout(trackPageView, 100);
      });
    }

    // Track visibility changes (tab focus)
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'visible') {
        // User came back to tab - could track this
      } else {
        // User left tab - track current time
        trackTimeOnPage();
      }
    });
  }

  /**
   * Check if this is a new session
   */
  function checkNewSession() {
    const lastActivity = sessionStorage.getItem('jv-hospitality-last-activity');
    const now = Date.now();

    if (!lastActivity) {
      // New session
      trackSessionStart();
    } else {
      const timeSinceLastActivity = now - parseInt(lastActivity, 10);
      // If more than 30 minutes since last activity, treat as new session
      if (timeSinceLastActivity > 30 * 60 * 1000) {
        trackSessionStart();
      }
    }

    // Update last activity
    sessionStorage.setItem('jv-hospitality-last-activity', now.toString());
  }

  /**
   * Initialize the tracker
   */
  function init() {
    if (isInitialized) return;
    isInitialized = true;

    // Check for new session
    checkNewSession();

    // Set up auto-tracking
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupAutoTracking);
    } else {
      setupAutoTracking();
    }
  }

  /**
   * Cleanup function
   */
  function destroy() {
    if (timeOnPageInterval) {
      clearInterval(timeOnPageInterval);
    }
    isInitialized = false;
  }

  // ============================================
  // Public API
  // ============================================

  return {
    init,
    destroy,

    // Core tracking
    track,
    trackPageView,

    // Specific interactions
    trackChatStart,
    trackChatMessage,
    trackPrayerRequest,
    trackStudyInteraction,
    trackInteraction,
    trackMusicPlayback,
    trackCommunityEngagement,
    trackPersonaInteraction
  };
})();

// Auto-initialize
HospitalityTracker.init();

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HospitalityTracker;
}
