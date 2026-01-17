// JubileeSearch.com - Main Application JavaScript

class JubileeSearch {
  constructor() {
    this.searchInput = document.getElementById('search-input');
    this.searchForm = document.getElementById('search-form');
    this.clearButton = document.getElementById('clear-button');
    this.suggestionsContainer = document.getElementById('suggestions');
    this.resultsContainer = document.getElementById('results');
    this.statsContainer = document.getElementById('stats');
    this.loadingContainer = document.getElementById('loading');

    this.debounceTimer = null;
    this.selectedSuggestionIndex = -1;
    this.suggestions = [];

    this.init();
  }

  init() {
    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => this.handleInput(e));
      this.searchInput.addEventListener('keydown', (e) => this.handleKeydown(e));
      this.searchInput.addEventListener('focus', () => this.handleFocus());
    }

    if (this.searchForm) {
      this.searchForm.addEventListener('submit', (e) => this.handleSubmit(e));
    }

    if (this.clearButton) {
      this.clearButton.addEventListener('click', () => this.clearSearch());
    }

    // Close suggestions when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-container') && !e.target.closest('.results-search-box')) {
        this.hideSuggestions();
      }
    });

    // Check if we're on a results page with a query
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q');
    if (query && this.resultsContainer) {
      this.searchInput.value = query;
      this.performSearch(query);
    }

    // Update clear button visibility
    this.updateClearButton();
  }

  handleInput(e) {
    const query = e.target.value;
    this.updateClearButton();

    // Debounce suggestions
    clearTimeout(this.debounceTimer);
    if (query.length >= 1) {
      this.debounceTimer = setTimeout(() => {
        this.fetchSuggestions(query);
      }, 150);
    } else {
      this.hideSuggestions();
    }
  }

  handleKeydown(e) {
    if (!this.suggestionsContainer) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.navigateSuggestions(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.navigateSuggestions(-1);
        break;
      case 'Enter':
        if (this.selectedSuggestionIndex >= 0 && this.suggestions[this.selectedSuggestionIndex]) {
          e.preventDefault();
          this.searchInput.value = this.suggestions[this.selectedSuggestionIndex];
          this.hideSuggestions();
          this.handleSubmit(e);
        }
        break;
      case 'Escape':
        this.hideSuggestions();
        break;
    }
  }

  handleFocus() {
    if (this.searchInput.value.length >= 1) {
      this.fetchSuggestions(this.searchInput.value);
    }
  }

  handleSubmit(e) {
    e.preventDefault();
    const query = this.searchInput.value.trim();
    if (query.length >= 2) {
      this.hideSuggestions();

      // Check if we're on the home page or results page
      if (this.resultsContainer) {
        // Update URL without reload
        const newUrl = `${window.location.pathname}?q=${encodeURIComponent(query)}`;
        window.history.pushState({ query }, '', newUrl);
        this.performSearch(query);
      } else {
        // Navigate to results page
        window.location.href = `/search?q=${encodeURIComponent(query)}`;
      }
    }
  }

  async fetchSuggestions(query) {
    try {
      const response = await fetch(`/api/search/suggest?q=${encodeURIComponent(query)}`);
      const data = await response.json();

      this.suggestions = data.suggestions || [];
      this.renderSuggestions();
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      this.suggestions = [];
      this.hideSuggestions();
    }
  }

  renderSuggestions() {
    if (!this.suggestionsContainer || this.suggestions.length === 0) {
      this.hideSuggestions();
      return;
    }

    this.suggestionsContainer.innerHTML = this.suggestions.map((suggestion, index) => `
      <div class="suggestion-item ${index === this.selectedSuggestionIndex ? 'selected' : ''}"
           data-index="${index}">
        <span class="suggestion-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
        </span>
        <span class="suggestion-text">${this.escapeHtml(suggestion)}</span>
      </div>
    `).join('');

    // Add click handlers
    this.suggestionsContainer.querySelectorAll('.suggestion-item').forEach((item) => {
      item.addEventListener('click', () => {
        const index = parseInt(item.dataset.index);
        this.searchInput.value = this.suggestions[index];
        this.hideSuggestions();
        this.handleSubmit(new Event('submit'));
      });
    });

    this.suggestionsContainer.classList.add('visible');
  }

  navigateSuggestions(direction) {
    if (!this.suggestionsContainer || this.suggestions.length === 0) return;

    this.selectedSuggestionIndex += direction;

    if (this.selectedSuggestionIndex < -1) {
      this.selectedSuggestionIndex = this.suggestions.length - 1;
    } else if (this.selectedSuggestionIndex >= this.suggestions.length) {
      this.selectedSuggestionIndex = -1;
    }

    this.renderSuggestions();

    // Update input with selected suggestion
    if (this.selectedSuggestionIndex >= 0) {
      this.searchInput.value = this.suggestions[this.selectedSuggestionIndex];
    }
  }

  hideSuggestions() {
    if (this.suggestionsContainer) {
      this.suggestionsContainer.classList.remove('visible');
      this.suggestionsContainer.innerHTML = '';
    }
    this.selectedSuggestionIndex = -1;
  }

  async performSearch(query) {
    if (!this.resultsContainer) return;

    this.showLoading();

    try {
      // Use the web search endpoint for aggregated Google/Yahoo/Bing results
      const response = await fetch(`/api/search/web?q=${encodeURIComponent(query)}`);
      const data = await response.json();

      this.hideLoading();

      if (data.success && data.results && data.results.length > 0) {
        this.renderWebResults(data);
      } else {
        this.renderNoResults(query);
      }
    } catch (error) {
      console.error('Search error:', error);
      this.hideLoading();
      this.renderError();
    }
  }

  renderWebResults(data) {
    const { results, query, searchTime, cached, totalFetched, duplicatesRemoved, source } = data;

    // Update stats
    if (this.statsContainer) {
      const cacheIndicator = cached ? ' (cached)' : '';
      const sourceInfo = source === 'live' ? '' : ` • ${source}`;
      this.statsContainer.innerHTML = `${results.length} results (${(searchTime / 1000).toFixed(2)} seconds)${cacheIndicator}${sourceInfo}`;
    }

    // Render web results
    this.resultsContainer.innerHTML = results.map(result => this.renderWebResultItem(result)).join('');
  }

  renderWebResultItem(result) {
    const favicon = result.favicon
      ? `<img src="${result.favicon}" alt="" class="result-favicon-img" onerror="this.style.display='none'">`
      : `<div class="result-favicon-placeholder">${this.getHostInitial(result.url)}</div>`;

    const hostname = this.getHostname(result.url);
    const displayUrl = result.displayUrl || result.url;

    return `
      <div class="result-item">
        <div class="result-title-row">
          <div class="result-favicon">${favicon}</div>
          <a href="${this.escapeHtml(result.url)}" class="result-title" target="_blank" rel="noopener">${this.escapeHtml(result.title)}</a>
        </div>
        <a href="${this.escapeHtml(result.url)}" class="result-snippet-link" target="_blank" rel="noopener">
          ${this.escapeHtml(result.snippet)}
        </a>
        <div class="result-url-line">
          <a href="${this.escapeHtml(result.url)}" class="result-site-name-link" target="_blank" rel="noopener">${this.escapeHtml(hostname)}</a>
          <span class="result-url-separator">›</span>
          <a href="${this.escapeHtml(result.url)}" class="result-url-link" target="_blank" rel="noopener">${this.escapeHtml(this.truncateUrl(displayUrl))}</a>
        </div>
      </div>
    `;
  }

  getHostname(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }

  getHostInitial(url) {
    const hostname = this.getHostname(url);
    return hostname.charAt(0).toUpperCase();
  }

  truncateUrl(url) {
    if (url.length > 60) {
      return url.substring(0, 57) + '...';
    }
    return url;
  }

  // Legacy methods for internal content search (kept for backwards compatibility)
  renderResults(data) {
    const { results, total, query, searchTime } = data;

    // Update stats
    if (this.statsContainer) {
      this.statsContainer.innerHTML = `About ${total.toLocaleString()} results (${searchTime.toFixed(2)} seconds)`;
    }

    // Render results
    this.resultsContainer.innerHTML = results.map(result => this.renderResultItem(result)).join('');
  }

  renderResultItem(result) {
    const typeClass = `result-type-${result.type}`;
    const favicon = this.getResultFavicon(result);
    const siteName = this.getSiteName(result);
    const url = this.getResultUrl(result);

    return `
      <div class="result-item">
        <div class="result-url-line">
          <div class="result-favicon">${favicon}</div>
          <div class="result-url-container">
            <span class="result-site-name">${siteName}</span>
            <span class="result-url">${url}</span>
          </div>
        </div>
        <a href="${url}" class="result-title">${this.escapeHtml(result.title)}</a>
        <div class="result-snippet">
          <span class="result-type-badge ${typeClass}">${result.type}</span>
          ${this.escapeHtml(result.snippet)}
        </div>
      </div>
    `;
  }

  getResultFavicon(result) {
    switch (result.type) {
      case 'bible':
        return '&#x2702;'; // Cross symbol
      case 'content':
        return '&#x1F4D6;'; // Book
      case 'ministry':
        return '&#x1F3B5;'; // Music note
      default:
        return 'J';
    }
  }

  getSiteName(result) {
    switch (result.type) {
      case 'bible':
        return 'Jubilee Bible';
      case 'content':
        return 'Jubilee Content';
      case 'ministry':
        return 'Jubilee Ministry';
      default:
        return 'JubileeSearch';
    }
  }

  getResultUrl(result) {
    if (result.type === 'bible') {
      return `jubileebible.com/${result.book?.toLowerCase()}/${result.chapter}/${result.verse}`;
    }
    return `jubileesearch.com/content/${result.id}`;
  }

  renderNoResults(query) {
    if (this.statsContainer) {
      this.statsContainer.innerHTML = '';
    }

    this.resultsContainer.innerHTML = `
      <div class="no-results">
        <h2>No results found for "${this.escapeHtml(query)}"</h2>
        <p>Try different keywords or check your spelling.</p>
        <p>You can also try searching for Bible verses, topics, or phrases.</p>
      </div>
    `;
  }

  renderError() {
    if (this.statsContainer) {
      this.statsContainer.innerHTML = '';
    }

    this.resultsContainer.innerHTML = `
      <div class="no-results">
        <h2>Something went wrong</h2>
        <p>We couldn't complete your search. Please try again.</p>
      </div>
    `;
  }

  showLoading() {
    if (this.loadingContainer) {
      this.loadingContainer.style.display = 'flex';
    }
    if (this.resultsContainer) {
      this.resultsContainer.style.display = 'none';
    }
  }

  hideLoading() {
    if (this.loadingContainer) {
      this.loadingContainer.style.display = 'none';
    }
    if (this.resultsContainer) {
      this.resultsContainer.style.display = 'block';
    }
  }

  clearSearch() {
    this.searchInput.value = '';
    this.searchInput.focus();
    this.updateClearButton();
    this.hideSuggestions();
  }

  updateClearButton() {
    if (this.clearButton) {
      if (this.searchInput.value.length > 0) {
        this.clearButton.classList.add('visible');
      } else {
        this.clearButton.classList.remove('visible');
      }
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.jubileeSearch = new JubileeSearch();

  // Initialize location detection for results page
  if (document.getElementById('user-location')) {
    initLocationDetection();
  }
});

// Location detection for footer
function initLocationDetection() {
  const locationElement = document.getElementById('user-location');
  const updateButton = document.getElementById('update-location');

  // Check if we have a cached location
  const cachedLocation = localStorage.getItem('userLocation');
  if (cachedLocation) {
    locationElement.textContent = cachedLocation;
  }

  // Try to get user's location
  detectLocation();

  // Update location button handler
  if (updateButton) {
    updateButton.addEventListener('click', (e) => {
      e.preventDefault();
      locationElement.textContent = 'Updating location...';
      detectLocation(true);
    });
  }
}

function detectLocation(forceRefresh = false) {
  const locationElement = document.getElementById('user-location');

  if (!navigator.geolocation) {
    locationElement.textContent = 'Location not available';
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;
      try {
        const locationName = await reverseGeocode(latitude, longitude);
        locationElement.textContent = locationName;
        localStorage.setItem('userLocation', locationName);
      } catch (error) {
        console.error('Geocoding error:', error);
        locationElement.textContent = 'Location unavailable';
      }
    },
    (error) => {
      console.error('Geolocation error:', error);
      switch (error.code) {
        case error.PERMISSION_DENIED:
          locationElement.textContent = 'Location access denied';
          break;
        case error.POSITION_UNAVAILABLE:
          locationElement.textContent = 'Location unavailable';
          break;
        case error.TIMEOUT:
          locationElement.textContent = 'Location request timed out';
          break;
        default:
          locationElement.textContent = 'Location unavailable';
      }
    },
    {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: forceRefresh ? 0 : 600000 // Cache for 10 minutes unless forcing refresh
    }
  );
}

async function reverseGeocode(latitude, longitude) {
  // Using OpenStreetMap's Nominatim API (free, no API key required)
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=14&addressdetails=1`,
    {
      headers: {
        'Accept-Language': 'en-US,en',
        'User-Agent': 'JubileeSearch/1.0'
      }
    }
  );

  if (!response.ok) {
    throw new Error('Geocoding request failed');
  }

  const data = await response.json();

  // Build a readable location string
  const address = data.address || {};
  const parts = [];

  // Try to get neighborhood or suburb first, then city
  if (address.neighbourhood) {
    parts.push(address.neighbourhood);
  } else if (address.suburb) {
    parts.push(address.suburb);
  } else if (address.village) {
    parts.push(address.village);
  } else if (address.town) {
    parts.push(address.town);
  }

  // Add city if different from above
  if (address.city && !parts.includes(address.city)) {
    parts.push(address.city);
  }

  // Add state abbreviation
  if (address.state) {
    parts.push(address.state);
  }

  if (parts.length === 0) {
    // Fallback to display name
    return data.display_name?.split(',').slice(0, 3).join(',') || 'Unknown location';
  }

  return parts.join(', ');
}
