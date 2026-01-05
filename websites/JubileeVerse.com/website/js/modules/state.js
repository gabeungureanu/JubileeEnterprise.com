/**
 * State Management Module
 * Simple, reactive state management for JubileeVerse
 */

const StateManager = (function() {
  const stores = new Map();

  /**
   * Create a new store
   */
  function createStore(name, initialState = {}) {
    if (stores.has(name)) {
      console.warn(`Store "${name}" already exists`);
      return stores.get(name);
    }

    const store = {
      state: { ...initialState },
      listeners: new Set(),

      /**
       * Get current state
       */
      getState() {
        return { ...this.state };
      },

      /**
       * Update state
       */
      setState(updates) {
        const prevState = this.state;
        this.state = { ...this.state, ...updates };
        this.notify(prevState);
      },

      /**
       * Subscribe to state changes
       */
      subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
      },

      /**
       * Notify listeners of state change
       */
      notify(prevState) {
        this.listeners.forEach(listener => {
          try {
            listener(this.state, prevState);
          } catch (error) {
            console.error('State listener error:', error);
          }
        });
      },

      /**
       * Reset to initial state
       */
      reset() {
        const prevState = this.state;
        this.state = { ...initialState };
        this.notify(prevState);
      }
    };

    stores.set(name, store);
    return store;
  }

  /**
   * Get existing store
   */
  function getStore(name) {
    return stores.get(name);
  }

  /**
   * Remove store
   */
  function removeStore(name) {
    stores.delete(name);
  }

  // Pre-defined stores for common state

  // User store
  const userStore = createStore('user', {
    isAuthenticated: false,
    user: null,
    preferences: {}
  });

  // Chat store
  const chatStore = createStore('chat', {
    currentConversation: null,
    conversations: [],
    messages: [],
    isLoading: false,
    error: null
  });

  // Persona store
  const personaStore = createStore('personas', {
    personas: [],
    currentPersona: null,
    isLoading: false,
    filter: {
      category: 'all',
      search: ''
    }
  });

  // Translation store
  const translationStore = createStore('translation', {
    progress: null,
    currentVerse: null,
    recentActivity: [],
    isLoading: false
  });

  // UI store
  const uiStore = createStore('ui', {
    theme: 'light',
    sidebarOpen: false,
    modalOpen: null,
    notifications: []
  });

  // Public API
  return {
    createStore,
    getStore,
    removeStore,

    // Pre-defined stores
    user: userStore,
    chat: chatStore,
    personas: personaStore,
    translation: translationStore,
    ui: uiStore
  };
})();

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StateManager;
}
