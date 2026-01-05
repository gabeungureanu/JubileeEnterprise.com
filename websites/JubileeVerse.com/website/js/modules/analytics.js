/**
 * Analytics Module
 * Modular analytics and tracking hooks for JubileeVerse
 * Designed to be non-intrusive and easily expandable
 */

const AnalyticsModule = (function() {
  let isEnabled = false;
  let providers = [];
  const eventQueue = [];

  /**
   * Initialize analytics with configuration
   */
  function init(config = {}) {
    isEnabled = config.enabled !== false;

    if (!isEnabled) {
      console.log('Analytics disabled');
      return;
    }

    // Initialize configured providers
    if (config.providers) {
      config.providers.forEach(provider => {
        registerProvider(provider);
      });
    }

    // Process queued events
    processQueue();

    // Set up automatic tracking
    setupAutoTracking();

    console.log('Analytics initialized');
  }

  /**
   * Register an analytics provider
   */
  function registerProvider(provider) {
    if (provider && typeof provider.track === 'function') {
      providers.push(provider);
    }
  }

  /**
   * Track an event
   */
  function track(eventName, properties = {}) {
    const event = {
      name: eventName,
      properties: {
        ...properties,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        referrer: document.referrer
      }
    };

    if (!isEnabled) {
      eventQueue.push(event);
      return;
    }

    sendToProviders(event);
  }

  /**
   * Track page view
   */
  function pageView(pageName, properties = {}) {
    track('page_view', {
      page_name: pageName || document.title,
      page_path: window.location.pathname,
      ...properties
    });
  }

  /**
   * Track user action
   */
  function action(actionName, properties = {}) {
    track('user_action', {
      action: actionName,
      ...properties
    });
  }

  /**
   * Track conversation events
   */
  function conversation(eventType, properties = {}) {
    track('conversation', {
      event_type: eventType,
      ...properties
    });
  }

  /**
   * Track translation events
   */
  function translation(eventType, properties = {}) {
    track('translation', {
      event_type: eventType,
      ...properties
    });
  }

  /**
   * Track persona interactions
   */
  function persona(eventType, personaId, properties = {}) {
    track('persona', {
      event_type: eventType,
      persona_id: personaId,
      ...properties
    });
  }

  /**
   * Send event to all providers
   */
  function sendToProviders(event) {
    providers.forEach(provider => {
      try {
        provider.track(event.name, event.properties);
      } catch (error) {
        console.error('Analytics provider error:', error);
      }
    });
  }

  /**
   * Process queued events
   */
  function processQueue() {
    while (eventQueue.length > 0) {
      const event = eventQueue.shift();
      sendToProviders(event);
    }
  }

  /**
   * Set up automatic tracking
   */
  function setupAutoTracking() {
    // Track page views on navigation
    window.addEventListener('popstate', () => {
      pageView();
    });

    // Track outbound links
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a');
      if (link && link.hostname !== window.location.hostname) {
        track('outbound_link', {
          url: link.href,
          text: link.textContent.trim().substring(0, 100)
        });
      }
    });

    // Track form submissions
    document.addEventListener('submit', (e) => {
      const form = e.target;
      if (form.tagName === 'FORM') {
        track('form_submit', {
          form_id: form.id || form.name || 'unknown',
          form_action: form.action
        });
      }
    });

    // Track errors
    window.addEventListener('error', (e) => {
      track('error', {
        message: e.message,
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno
      });
    });

    // Initial page view
    pageView();
  }

  /**
   * Set user identity for tracking
   */
  function identify(userId, traits = {}) {
    if (!isEnabled) return;

    providers.forEach(provider => {
      if (typeof provider.identify === 'function') {
        try {
          provider.identify(userId, traits);
        } catch (error) {
          console.error('Analytics identify error:', error);
        }
      }
    });
  }

  /**
   * Enable/disable tracking
   */
  function setEnabled(enabled) {
    isEnabled = enabled;
    if (enabled) {
      processQueue();
    }
  }

  // Console provider for development
  const consoleProvider = {
    track: (eventName, properties) => {
      console.log(`[Analytics] ${eventName}`, properties);
    },
    identify: (userId, traits) => {
      console.log(`[Analytics] Identify: ${userId}`, traits);
    }
  };

  // Google Analytics provider template
  const gaProvider = {
    track: (eventName, properties) => {
      if (typeof gtag === 'function') {
        gtag('event', eventName, properties);
      }
    },
    identify: (userId, traits) => {
      if (typeof gtag === 'function') {
        gtag('config', 'GA_MEASUREMENT_ID', {
          user_id: userId,
          ...traits
        });
      }
    }
  };

  // Public API
  return {
    init,
    track,
    pageView,
    action,
    conversation,
    translation,
    persona,
    identify,
    setEnabled,
    registerProvider,
    providers: {
      console: consoleProvider,
      ga: gaProvider
    }
  };
})();

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AnalyticsModule;
}
