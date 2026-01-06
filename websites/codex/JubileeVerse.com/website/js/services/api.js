/**
 * API Service Module
 * Centralized API communication layer for JubileeVerse
 */

const ApiService = (function() {
  const BASE_URL = '';
  let authToken = null;

  /**
   * Set authorization token
   */
  function setAuthToken(token) {
    authToken = token;
  }

  /**
   * Make API request
   */
  async function request(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const config = {
      ...options,
      headers
    };

    try {
      const response = await fetch(url, config);

      // Handle non-JSON responses
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return { success: true };
      }

      const data = await response.json();

      if (!response.ok) {
        throw new ApiError(data.error || 'Request failed', response.status, data);
      }

      return data;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(error.message || 'Network error', 0);
    }
  }

  /**
   * GET request
   */
  function get(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    return request(url, { method: 'GET' });
  }

  /**
   * POST request
   */
  function post(endpoint, data = {}) {
    return request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  /**
   * PUT request
   */
  function put(endpoint, data = {}) {
    return request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  /**
   * DELETE request
   */
  function del(endpoint) {
    return request(endpoint, { method: 'DELETE' });
  }

  // Custom API Error class
  class ApiError extends Error {
    constructor(message, status, data = null) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.data = data;
    }
  }

  // Public API
  return {
    setAuthToken,
    get,
    post,
    put,
    delete: del,
    ApiError,

    // Auth endpoints
    auth: {
      login: (credentials) => post('/auth/login', credentials),
      register: (userData) => post('/auth/register', userData),
      logout: () => post('/auth/logout'),
      me: () => get('/auth/me')
    },

    // User endpoints
    user: {
      getPreferences: () => get('/api/user/preferences'),
      updatePreferences: (prefs) => put('/api/user/preferences', prefs),
      getStats: () => get('/api/stats')
    },

    // Persona endpoints
    personas: {
      list: (params) => get('/personas/list', params),
      get: (id) => get(`/personas/${id}`)
    },

    // Chat endpoints
    chat: {
      createConversation: (data) => post('/chat/conversations', data),
      listConversations: (params) => get('/chat/conversations/list', params),
      getMessages: (conversationId, params) => get(`/chat/conversations/${conversationId}/messages`, params),
      sendMessage: (conversationId, data) => post(`/chat/conversations/${conversationId}/messages`, data),
      deleteConversation: (conversationId) => del(`/chat/conversations/${conversationId}`)
    },

    // Translation endpoints
    translation: {
      getLanguages: () => get('/translation/languages'),
      translate: (data) => post('/translation/translate', data),
      getBibleProgress: (params) => get('/translation/bible', params),
      submitVerse: (data) => post('/translation/bible/verse', data),
      getHistory: (params) => get('/translation/history', params)
    },

    // Search
    search: (query, params) => get('/api/search', { q: query, ...params })
  };
})();

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ApiService;
}
