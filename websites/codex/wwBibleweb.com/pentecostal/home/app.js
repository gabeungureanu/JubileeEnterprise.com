/**
 * JUBILEE WEBSITE - Client-Side Application
 *
 * This JavaScript file handles ALL dynamic functionality for the website.
 * Data is loaded from local .json files in the .webstore folder.
 *
 * Features:
 * - Dynamic navigation building from web_categories.json
 * - Hero carousel with auto-fade
 * - Ticker animation with smooth scrolling
 * - Portal pages (category views)
 * - Article detail pages
 * - Footer category links
 * - View tracking
 */

// ============================================================================
// GLOBAL STATE - SINGLE SOURCE OF TRUTH
// All state is stored on window for global access
// ============================================================================

// Initialize global state on window object to avoid scope conflicts
window.siteData = window.siteData || null;
window.categoriesData = window.categoriesData || null;
window.currentMode = 'home';
window.currentCategory = null;
window.currentArticle = null;
window.heroSlideIndex = 0;
window.heroInterval = null;
window.dataLoaded = false;

// Local references for convenience
let siteData = null;
let categoriesData = null;
let currentMode = 'home';
let currentCategory = null;
let currentArticle = null;
let heroSlideIndex = 0;
let heroInterval = null;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Convert title to URL-safe slug
 */
function titleToSlug(title) {
  if (!title) return '';
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 80);
}

/**
 * Get the base path for the current site (e.g., /pentecostal/home)
 * This is defined early so other functions can use it
 */
function getBasePath() {
  const path = window.location.pathname;
  // Match /pentecostal/home or similar two-level paths
  const match = path.match(/^(\/[^\/]+\/[^\/]+)/);
  return match ? match[1] : '/pentecostal/home';
}

/**
 * Build href for an article link
 * Returns SEO-friendly URL: /pentecostal/home/category-slug/article-slug.html
 */
function buildArticleHref(categorySlug, articleTitle) {
  const basePath = getBasePath();
  const articleSlug = (articleTitle || 'article')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 80);
  return basePath + '/' + categorySlug + '/' + articleSlug + '.html';
}

/**
 * Build href for a category link
 * Returns SEO-friendly URL: /pentecostal/home/category-slug.html
 */
function buildCategoryHref(categorySlug) {
  const basePath = getBasePath();
  return basePath + '/' + categorySlug + '.html';
}

/**
 * Build href for home link
 * Returns SEO-friendly URL: /pentecostal/home/index.html
 */
function buildHomeHref() {
  const basePath = getBasePath();
  return basePath + '/index.html';
}

/**
 * Get image path - uses absolute path from base to work in subdirectories
 */
function getImagePath(articleId) {
  const basePath = getBasePath();
  return basePath + '/images/' + articleId + '.jpg';
}

/**
 * Get the path for .webstore files
 */
function getWebstorePath() {
  // Get base path for webstore - handles both home page and category pages
  const basePath = getBasePath();
  return basePath + '/.webstore/';
}

/**
 * Get the path for .lumiatos files
 */
function getLumiatosPath() {
  // Get base path for lumiatos - handles both home page and category pages
  const basePath = getBasePath();
  return basePath + '/.lumiatos/';
}

/**
 * Strip markdown formatting (* and #) from content
 */
function stripMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/#{1,6}\s*/g, '')  // Remove headers
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')  // Remove bold/italic
    .replace(/`([^`]+)`/g, '$1')  // Remove inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // Remove links, keep text
    .trim();
}

/**
 * Truncate text to specified length with ellipsis
 */
function truncateText(text, maxLength) {
  if (!text) return '';
  const stripped = stripMarkdown(text);
  if (stripped.length <= maxLength) return stripped;
  return stripped.substring(0, maxLength).trim() + '...';
}

/**
 * Get today's date formatted as YY-MMDD for history file
 */
function getTodayHistoryFileName() {
  const today = new Date();
  const yy = today.getFullYear().toString().slice(-2);
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return yy + '-' + mm + dd + '.json';
}

/**
 * Get articles from OTHER categories (for cross-category sections)
 */
function getArticlesFromOtherCategories(excludeCategorySlug, count = 10) {
  if (!siteData || !siteData.allArticles) {
    console.warn('getArticlesFromOtherCategories: siteData.allArticles not available');
    return [];
  }

  // Filter articles that are NOT from the excluded category
  const otherArticles = siteData.allArticles.filter(article => {
    return article.categorySlug && article.categorySlug !== excludeCategorySlug;
  });

  // Shuffle to get variety
  const shuffled = [...otherArticles].sort(() => Math.random() - 0.5);

  // Deduplicate by articleId
  const seen = new Set();
  const unique = shuffled.filter(a => {
    const id = a.articleId || a.id;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  return unique.slice(0, count);
}

/**
 * Ensure minimum articles for a section
 */
function ensureMinimumArticles(primaryArticles, currentCategorySlug, minCount, excludeIds = new Set()) {
  const result = [...primaryArticles];

  // Track IDs already in result
  primaryArticles.forEach(a => excludeIds.add(a.articleId || a.id));

  // If we don't have enough, supplement from other categories
  if (result.length < minCount) {
    const needed = minCount - result.length;
    const supplements = getArticlesFromOtherCategories(currentCategorySlug, needed + 10)
      .filter(a => !excludeIds.has(a.articleId || a.id))
      .slice(0, needed);
    result.push(...supplements);
  }

  return result;
}

// ============================================================================
// DATA LOADING
// ============================================================================

/**
 * Load all site data from JSON files
 * This is the SINGLE source of truth for data loading
 */
async function loadSiteData() {
  console.log('=== loadSiteData: Starting data load ===');

  try {
    const webstorePath = getWebstorePath();
    console.log('loadSiteData: webstorePath =', webstorePath);

    // Load categories first
    const categoriesResponse = await fetch(webstorePath + 'web_categories.json');
    if (categoriesResponse.ok) {
      categoriesData = await categoriesResponse.json();
      window.categoriesData = categoriesData; // Global access
      console.log('loadSiteData: Loaded categories:', categoriesData.categories.length);
    }

    // Load today's history file
    const historyFile = getTodayHistoryFileName();
    console.log('loadSiteData: Loading history file:', historyFile);
    const historyResponse = await fetch(webstorePath + 'history/' + historyFile);
    if (historyResponse.ok) {
      siteData = await historyResponse.json();
      window.siteData = siteData; // Global access - CRITICAL for portal pages
      console.log('loadSiteData: Loaded site data from history:', historyFile);
      console.log('loadSiteData: portalPages available:', Object.keys(siteData.portalPages || {}));
    } else {
      console.warn('loadSiteData: History file not found:', historyFile);
    }

    // Mark data as loaded BEFORE initializing components
    window.dataLoaded = true;
    console.log('loadSiteData: Data loading complete, window.dataLoaded = true');

    // Initialize components
    buildNavigation();
    buildTicker();
    updateFooterCategories();
    startHeroCarousel();

    // Populate dynamic sections
    setTimeout(populateFeaturedSections, 500);

    // Handle initial path navigation NOW that data is loaded
    console.log('loadSiteData: Checking for path navigation...');
    handlePathNavigation();

  } catch (error) {
    console.error('loadSiteData: Error loading site data:', error);
    window.dataLoaded = true; // Mark as loaded even on error to prevent infinite waits
    // Fallback: just start the carousel with server-rendered content
    startHeroCarousel();
    // Still try path navigation
    handlePathNavigation();
  }
}

/**
 * Load articles for a specific category
 */
async function loadCategoryArticles(categorySlug) {
  try {
    const articlesPath = categorySlug + '/web_articles.json';
    const response = await fetch(articlesPath);
    if (response.ok) {
      const data = await response.json();
      return data.articles || [];
    }
  } catch (error) {
    console.warn('Could not load articles for', categorySlug);
  }
  return [];
}

// ============================================================================
// NAVIGATION
// ============================================================================

/**
 * Build navigation with ALL categories
 * Returns true if nav was rebuilt, false otherwise
 */
function buildNavigation() {
  const navList = document.getElementById('nav-list');
  if (!navList) return false;

  // Use loaded categories or fallback to siteData
  const categories = categoriesData?.categories || siteData?.categories || [];
  if (categories.length === 0) {
    console.log('No categories available, keeping server-rendered nav');
    // Still add data-category attributes to existing server-rendered links
    const existingLinks = navList.querySelectorAll('li:not(.home-link) a');
    existingLinks.forEach(link => {
      const onclickAttr = link.getAttribute('onclick');
      if (onclickAttr) {
        const match = onclickAttr.match(/openPortal\(['"]([^'"]+)['"]\)/);
        if (match) {
          link.setAttribute('data-category', match[1]);
        }
      }
    });
    console.log('Added data-category to', existingLinks.length, 'existing nav links');
    return true;
  }

  // SVG Home Icon
  const homeSvg = '<svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>';

  // Build navigation: Home + ALL categories with SEO-friendly URLs
  const homeHref = buildHomeHref();
  let navHtml = '<li class="home-link"><a href="' + homeHref + '" onclick="goHome(); return false;">' + homeSvg + '</a></li>';

  categories.forEach(cat => {
    const categoryHref = buildCategoryHref(cat.slug);
    navHtml += '<li><a href="' + categoryHref + '" data-category="' + cat.slug + '" onclick="openPortal(\'' + cat.slug + '\'); return false;">' + cat.name + '</a></li>';
  });

  navList.innerHTML = navHtml;
  console.log('Navigation built with', categories.length, 'categories');
  return true;
}

/**
 * Update active state on navigation links
 * @param {string|null} categorySlug - The category slug to mark as active, or null for home
 */
function updateActiveNavLink(categorySlug) {
  console.log('=== updateActiveNavLink called with:', categorySlug, '===');

  const navList = document.getElementById('nav-list');
  if (!navList) {
    console.log('updateActiveNavLink: nav-list not found');
    return;
  }

  // Remove active class from all links
  const allLinks = navList.querySelectorAll('a');
  allLinks.forEach(link => link.classList.remove('active'));
  console.log('updateActiveNavLink: Removed active class from', allLinks.length, 'links');

  if (!categorySlug) {
    // Home is active - no yellow line for home (just remove all active states)
    console.log('updateActiveNavLink: No category, home is active');
    return;
  }

  // First try data-category attribute
  let activeLink = navList.querySelector('a[data-category="' + categorySlug + '"]');

  // Fallback: search by onclick attribute if data-category not found
  if (!activeLink) {
    console.log('updateActiveNavLink: data-category not found, trying onclick fallback');
    const links = navList.querySelectorAll('li:not(.home-link) a');
    for (let i = 0; i < links.length; i++) {
      const onclick = links[i].getAttribute('onclick') || '';
      if (onclick.includes("openPortal('" + categorySlug + "')") ||
          onclick.includes('openPortal("' + categorySlug + '")')) {
        activeLink = links[i];
        // Also add the data-category for future use
        activeLink.setAttribute('data-category', categorySlug);
        break;
      }
    }
  }

  if (activeLink) {
    activeLink.classList.add('active');
    console.log('updateActiveNavLink: Added active class to:', activeLink.textContent);
  } else {
    console.log('updateActiveNavLink: Could not find link for category:', categorySlug);
    // Debug: log all links
    allLinks.forEach((link, i) => {
      console.log('  Link', i, ':', link.getAttribute('data-category'), link.textContent.trim());
    });
  }
}

/**
 * Build ticker with articles from ALL categories
 */
function buildTicker() {
  const tickerContent = document.querySelector('#ticker-bar .ticker-content');
  if (!tickerContent) return;

  const categories = categoriesData?.categories || siteData?.categories || [];
  const allArticles = siteData?.allArticles || [];

  if (allArticles.length === 0) {
    console.log('No articles available for ticker');
    return;
  }

  // Get 12 random articles distributed across categories
  const categoriesWithArticles = categories.filter(cat =>
    allArticles.some(a => a.categorySlug === cat.slug)
  );

  const tickerArticles = [];
  if (categoriesWithArticles.length > 0) {
    const articlesPerCategory = Math.ceil(12 / categoriesWithArticles.length);

    categoriesWithArticles.forEach(cat => {
      const catArticles = allArticles.filter(a => a.categorySlug === cat.slug);
      const shuffled = [...catArticles].sort(() => Math.random() - 0.5);
      tickerArticles.push(...shuffled.slice(0, articlesPerCategory));
    });

    // Shuffle and limit to 12
    tickerArticles.sort(() => Math.random() - 0.5);
    tickerArticles.splice(12);
  }

  const finalTickerArticles = tickerArticles.length >= 12 ? tickerArticles : allArticles.slice(0, 12);

  // Build ticker HTML - duplicate for seamless loop
  let tickerHtml = '';
  [...finalTickerArticles, ...finalTickerArticles].forEach(article => {
    const catName = categories.find(c => c.slug === article.categorySlug)?.name || article.categorySlug;
    const articleHref = buildArticleHref(article.categorySlug, article.title);
    tickerHtml += '<span class="ticker-item"><span class="cat-label">' + catName + ':</span> ';
    tickerHtml += '<a href="' + articleHref + '" onclick="openArticle(\'' + article.categorySlug + '\', \'' + article.articleId + '\'); return false;">' + article.title + '</a></span>';
  });

  tickerContent.innerHTML = tickerHtml;
  console.log('Ticker built with', finalTickerArticles.length, 'articles');
}

// ============================================================================
// FOOTER
// ============================================================================

/**
 * Update footer category links
 */
function updateFooterCategories() {
  const categories = categoriesData?.categories || siteData?.categories || [];
  if (categories.length === 0) return;

  // Update footer categories column
  const footerCategoriesList = document.getElementById('footer-categories-list');
  if (footerCategoriesList) {
    footerCategoriesList.innerHTML = categories.map(cat => {
      const categoryHref = buildCategoryHref(cat.slug);
      return '<li><a href="' + categoryHref + '" onclick="openPortal(\'' + cat.slug + '\'); return false;">' + cat.name + '</a></li>';
    }).join('');
  }

  // Update footer bottom category links
  const footerCategoryLinks = document.getElementById('footer-category-links');
  if (footerCategoryLinks) {
    footerCategoryLinks.innerHTML = categories.map(cat => {
      const categoryHref = buildCategoryHref(cat.slug);
      return '<a href="' + categoryHref + '" onclick="openPortal(\'' + cat.slug + '\'); return false;">' + cat.name + '</a>';
    }).join(' | ');
  }
}

// ============================================================================
// HERO CAROUSEL
// ============================================================================

function startHeroCarousel() {
  const slides = document.querySelectorAll('.hero-slide');
  if (slides.length <= 1) return;

  // 9 second interval: 5s display + 2s fade out + 2s fade in
  heroInterval = setInterval(() => {
    heroSlideIndex = (heroSlideIndex + 1) % slides.length;
    updateHeroSlide();
  }, 9000);
}

function stopHeroCarousel() {
  if (heroInterval) {
    clearInterval(heroInterval);
    heroInterval = null;
  }
}

function updateHeroSlide() {
  const slides = document.querySelectorAll('.hero-slide');
  const dots = document.querySelectorAll('.hero-dot');

  slides.forEach((slide, index) => {
    slide.classList.toggle('active', index === heroSlideIndex);
  });

  dots.forEach((dot, index) => {
    dot.classList.toggle('active', index === heroSlideIndex);
  });
}

function changeHeroSlide(direction) {
  const slides = document.querySelectorAll('.hero-slide');
  if (slides.length === 0) return;
  heroSlideIndex = (heroSlideIndex + direction + slides.length) % slides.length;
  updateHeroSlide();
  stopHeroCarousel();
  startHeroCarousel();
}

function goToHeroSlide(index) {
  heroSlideIndex = index;
  updateHeroSlide();
  stopHeroCarousel();
  startHeroCarousel();
}

function goToSlide(index) {
  goToHeroSlide(index);
}

// ============================================================================
// SMOOTH TICKER ANIMATION
// ============================================================================

let tickerPosition = 0;
let tickerPaused = false;
let tickerAnimationId = null;

function initSmoothTicker() {
  const tickerWrap = document.querySelector('#ticker-bar .ticker-wrap');
  const tickerBar = document.getElementById('ticker-bar');
  if (!tickerWrap) return;

  const tickerContent = tickerWrap.querySelector('.ticker-content');
  if (!tickerContent) return;

  const contentWidth = tickerContent.offsetWidth;
  if (contentWidth === 0) return;

  // Pause on hover
  tickerBar.addEventListener('mouseenter', () => { tickerPaused = true; });
  tickerBar.addEventListener('mouseleave', () => { tickerPaused = false; });

  // Animation speed: pixels per frame at 60fps (0.3 = slow, readable)
  const speed = 0.3;

  function animateTicker() {
    if (!tickerPaused) {
      tickerPosition -= speed;

      // Reset when we've scrolled one full content block
      if (Math.abs(tickerPosition) >= contentWidth) {
        tickerPosition = 0;
      }

      tickerWrap.style.transform = 'translateX(' + tickerPosition + 'px)';
    }

    tickerAnimationId = requestAnimationFrame(animateTicker);
  }

  animateTicker();
}

// ============================================================================
// HOME PAGE
// ============================================================================

function goHome(skipUrlUpdate) {
  currentMode = 'home';
  currentCategory = null;
  currentArticle = null;

  // Clear active nav state when going home
  updateActiveNavLink(null);

  document.getElementById('homePage').style.display = 'block';
  document.getElementById('portalPage').style.display = 'none';

  // Hide both article page containers
  const articleDetailPage = document.getElementById('articleDetailPage');
  if (articleDetailPage) articleDetailPage.style.display = 'none';
  const articlePage = document.getElementById('articlePage');
  if (articlePage) {
    articlePage.style.display = 'none';
    articlePage.classList.add('hidden');
  }

  // Update URL to home page (unless we're just doing internal state change)
  if (!skipUrlUpdate && window.history && window.history.pushState) {
    const homeUrl = buildHomeHref();
    window.history.pushState({ type: 'home' }, '', homeUrl);
  }

  window.scrollTo(0, 0);
}

function renderHomePage() {
  document.getElementById('homePage').style.display = 'block';
  document.getElementById('portalPage').style.display = 'none';

  // Hide both article page containers
  const articleDetailPage = document.getElementById('articleDetailPage');
  if (articleDetailPage) articleDetailPage.style.display = 'none';
  const articlePage = document.getElementById('articlePage');
  if (articlePage) {
    articlePage.style.display = 'none';
    articlePage.classList.add('hidden');
  }
}

// ============================================================================
// PORTAL MODE (Category Page)
// ============================================================================

async function openPortal(categorySlug, skipUrlUpdate) {
  console.log('=== openPortal: Opening category:', categorySlug, '===');

  // Stop any running carousel to prevent interference with portal's single-slide hero
  stopHeroCarousel();

  // Update nav to show active category
  updateActiveNavLink(categorySlug);

  currentMode = 'portal';
  currentCategory = categorySlug;
  window.currentMode = 'portal';
  window.currentCategory = categorySlug;

  document.getElementById('homePage').style.display = 'none';

  // Hide both article page containers
  const articleDetailPage = document.getElementById('articleDetailPage');
  if (articleDetailPage) articleDetailPage.style.display = 'none';
  const articlePageEl = document.getElementById('articlePage');
  if (articlePageEl) {
    articlePageEl.style.display = 'none';
    articlePageEl.classList.add('hidden');
  }

  // Update URL to category page
  if (!skipUrlUpdate && window.history && window.history.pushState) {
    const categoryUrl = buildCategoryHref(categorySlug);
    window.history.pushState({ type: 'category', categorySlug }, '', categoryUrl);
  }

  const portalPage = document.getElementById('portalPage');
  portalPage.style.display = 'block';
  portalPage.innerHTML = '<div style="padding: 40px; text-align: center;">Loading...</div>';

  try {
    // Use window.siteData as the single source of truth
    const sd = window.siteData || siteData;
    console.log('openPortal: siteData available:', !!sd);
    console.log('openPortal: portalPages:', sd ? Object.keys(sd.portalPages || {}) : 'none');

    const portalData = sd?.portalPages?.[categorySlug];
    if (!portalData) {
      console.error('openPortal: Portal not found for category:', categorySlug);
      throw new Error('Portal not found for: ' + categorySlug);
    }
    console.log('openPortal: Found portal data with', portalData.articles?.length, 'articles');

    // Deduplicate articles
    const seenIds = new Set();
    const uniqueArticles = portalData.articles.filter(article => {
      if (seenIds.has(article.articleId)) return false;
      seenIds.add(article.articleId);
      return true;
    });

    // Get cross-category articles
    const otherCategoryArticles = getArticlesFromOtherCategories(categorySlug, 30);
    const usedArticleIds = new Set();

    // Build portal HTML
    const categories = siteData?.categories || categoriesData?.categories || [];
    const categoryName = categories.find(c => c.slug === categorySlug)?.name || categorySlug;
    let html = buildPortalHTML(categorySlug, categoryName, uniqueArticles, otherCategoryArticles, usedArticleIds);

    portalPage.innerHTML = html;
    window.scrollTo(0, 0);

  } catch (error) {
    console.error('Error loading portal:', error);
    portalPage.innerHTML = '<div style="padding: 40px; text-align: center; color: red;">Error loading category. Please try again.</div>';
  }
}

function buildPortalHTML(categorySlug, categoryName, articles, otherArticles, usedIds) {
  const categories = siteData?.categories || categoriesData?.categories || [];

  // Helper to build article link with proper href
  function articleLink(cat, id, title, className, content) {
    const href = buildArticleHref(cat, title);
    return '<a href="' + href + '" onclick="openArticle(\'' + cat + '\', \'' + id + '\'); return false;"' + (className ? ' class="' + className + '"' : '') + '>' + content + '</a>';
  }

  // Build HTML that matches home page layout EXACTLY
  let html = '<main class="main-content">';
  html += '<div class="content-grid">';
  html += '<div class="main-column">';

  // Hero Section - single image (matches home page hero structure)
  const heroArticle = articles[0];
  if (heroArticle) {
    usedIds.add(heroArticle.articleId);
    html += '<section class="hero-section">';
    html += '<div class="hero-carousel">';
    html += '<div class="hero-slide active" data-index="0">';
    html += '<div class="hero-image" onclick="openArticle(\'' + categorySlug + '\', \'' + heroArticle.articleId + '\');" style="cursor: pointer;">';
    html += '<img src="' + getImagePath(heroArticle.articleId) + '" alt="' + heroArticle.title + '" onerror="this.parentElement.style.background=\'linear-gradient(135deg, #667eea 0%, #764ba2 100%)\'">';
    html += '<div class="hero-overlay">';
    html += '<span class="hero-category">' + categoryName + '</span>';
    html += '<h2 class="hero-title">' + articleLink(categorySlug, heroArticle.articleId, heroArticle.title, '', heroArticle.title) + '</h2>';
    html += '</div>';
    html += '</div>';
    html += '</div>';
    html += '</div>';
    html += '</section>';
  }

  // Featured & Spotlight - Two Column Layout (matches home page exactly)
  html += '<div class="section-row">';

  // FEATURED Column (Left) - Stacked Cards
  html += '<div class="section-block">';
  html += '<div class="section-header">Featured</div>';
  html += '<div class="section-content">';

  // Use articles 1-8 for featured (article 0 is hero)
  const featuredArticles = articles.slice(1, 9);
  featuredArticles.forEach(article => {
    const articleCat = article.categorySlug || categorySlug;
    usedIds.add(article.articleId);
    html += '<div class="featured-card">';
    html += articleLink(articleCat, article.articleId, article.title, 'featured-card-image', '<img src="' + getImagePath(article.articleId) + '" alt="' + article.title + '" onerror="this.parentElement.style.background=\'#ddd\'">');
    html += '<h3 class="featured-card-title">' + articleLink(articleCat, article.articleId, article.title, '', article.title) + '</h3>';
    html += '<p class="featured-card-excerpt">' + truncateText(article.excerpt || '', 120) + '</p>';
    html += '</div>';
  });

  html += '</div>'; // End section-content
  html += '</div>'; // End section-block (featured)

  // IN THE SPOTLIGHT Column (Right) - matches home page exactly
  html += '<div class="section-block">';
  html += '<div class="section-header">In The Spotlight</div>';
  html += '<div class="section-content">';

  // Main Spotlight Article - from OTHER categories
  const spotlightMain = otherArticles.find(a => !usedIds.has(a.articleId));
  if (spotlightMain) {
    usedIds.add(spotlightMain.articleId);
    html += '<div class="spotlight-main">';
    html += articleLink(spotlightMain.categorySlug, spotlightMain.articleId, spotlightMain.title, 'spotlight-main-image', '<img src="' + getImagePath(spotlightMain.articleId) + '" alt="' + spotlightMain.title + '" onerror="this.parentElement.style.background=\'#ddd\'">');
    html += '<h3 class="spotlight-main-title">' + articleLink(spotlightMain.categorySlug, spotlightMain.articleId, spotlightMain.title, '', spotlightMain.title) + '</h3>';
    html += '<p class="spotlight-main-excerpt">' + truncateText(spotlightMain.excerpt || '', 150) + '</p>';
    html += '</div>';
  }

  // Spotlight List Items - 2 items from OTHER categories
  const spotlightList = otherArticles.filter(a => !usedIds.has(a.articleId)).slice(0, 2);
  spotlightList.forEach(article => {
    usedIds.add(article.articleId);
    html += '<div class="spotlight-list-item">';
    html += articleLink(article.categorySlug, article.articleId, article.title, 'spotlight-list-image', '<img src="' + getImagePath(article.articleId) + '" alt="' + article.title + '" onerror="this.parentElement.style.background=\'#ddd\'">');
    html += '<div class="spotlight-list-content">';
    html += '<h4 class="spotlight-list-title">' + articleLink(article.categorySlug, article.articleId, article.title, '', article.title) + '</h4>';
    html += '<p class="spotlight-list-excerpt">' + truncateText(article.excerpt || '', 80) + '</p>';
    html += '</div>';
    html += '</div>';
  });

  // Related Information Section - 4 cards from OTHER categories
  html += '<div class="related-info-header">Related Information</div>';
  html += '<div class="related-info-grid">';
  const relatedArticles = otherArticles.filter(a => !usedIds.has(a.articleId)).slice(0, 4);
  relatedArticles.forEach(article => {
    usedIds.add(article.articleId);
    html += '<div class="related-info-card">';
    html += articleLink(article.categorySlug, article.articleId, article.title, 'related-info-image', '<img src="' + getImagePath(article.articleId) + '" alt="' + article.title + '" onerror="this.parentElement.style.background=\'#ddd\'">');
    html += '<h4 class="related-info-title">' + articleLink(article.categorySlug, article.articleId, article.title, '', article.title) + '</h4>';
    html += '</div>';
  });
  html += '</div>';

  // Recommended Section - matches home page
  html += '<div class="section-header" style="margin-top: 20px;">Recommended</div>';
  html += '<div class="recommended-list">';
  const recommendedArticles = otherArticles.filter(a => !usedIds.has(a.articleId)).slice(0, 10);
  recommendedArticles.forEach(article => {
    usedIds.add(article.articleId);
    html += '<div class="recommended-item">';
    html += articleLink(article.categorySlug, article.articleId, article.title, 'recommended-image', '<img src="' + getImagePath(article.articleId) + '" alt="' + article.title + '" onerror="this.parentElement.style.background=\'#ddd\'">');
    html += '<div class="recommended-content">';
    html += '<h4 class="recommended-title">' + articleLink(article.categorySlug, article.articleId, article.title, '', article.title) + '</h4>';
    html += '<p class="recommended-excerpt">' + truncateText(article.excerpt || '', 100) + '</p>';
    html += '</div>';
    html += '</div>';
  });
  html += '</div>';

  html += '</div>'; // End section-content
  html += '</div>'; // End section-block (spotlight)
  html += '</div>'; // End section-row

  html += '</div>'; // End main-column

  // Sidebar - matches home page layout EXACTLY
  html += '<aside class="sidebar">';

  // 1. Promo Box - matches home page
  html += '<div class="promo-box">';
  html += '<div class="promo-title">' + categoryName + '</div>';
  html += '<div class="promo-subtitle">Explore Faith-Building Content</div>';
  html += '<a href="' + buildHomeHref() + '" class="promo-btn" onclick="goHome(); return false;">Browse All</a>';
  html += '</div>';

  // 2. Most Popular section - matches home page with 7 items from current category
  html += '<div class="sidebar-section">';
  html += '<div class="sidebar-header">MOST POPULAR</div>';
  html += '<div class="sidebar-content">';

  // Use articles from current category for Most Popular
  const popularArticles = articles.slice(0, 7);
  popularArticles.forEach(article => {
    const articleCat = article.categorySlug || categorySlug;
    html += '<div class="popular-item">';
    html += '<div class="popular-image">';
    html += articleLink(articleCat, article.articleId, article.title, '', '<img src="' + getImagePath(article.articleId) + '" alt="' + article.title + '" onerror="this.parentElement.style.background=\'#ddd\'">');
    html += '</div>';
    html += '<div class="popular-content">';
    html += articleLink(articleCat, article.articleId, article.title, 'popular-title', article.title);
    html += '</div>';
    html += '</div>';
  });

  html += '</div>'; // End sidebar-content
  html += '</div>'; // End sidebar-section

  // 3. 300x600 Skyscraper Ad - matches home page
  const lumiatosPath = getLumiatosPath();
  html += '<div class="skyscraper-ad-unit">';
  html += '<a href="https://jubileeverse.com?utm_source=lumiatos&utm_campaign=CAMP-003&utm_ad=AD-003-B" target="_blank" rel="noopener" onclick="handleAdClick(\'AD-003-B\', \'CAMP-003\', this.href);">';
  html += '<img src="' + lumiatosPath + 'images/jubileeverse-300x600.jpg" alt="JubileeVerse.com - Beyond Artificial Intelligence">';
  html += '</a>';
  html += '<div class="skyscraper-ad-label">Advertisement</div>';
  html += '</div>';

  // 4. Must Read section - from OTHER categories (cross-category discovery)
  html += '<div class="sidebar-section">';
  html += '<div class="sidebar-header">Must Read</div>';
  html += '<div class="sidebar-content">';

  const mustReadArticles = otherArticles.filter(a => !usedIds.has(a.articleId)).slice(0, 7);
  mustReadArticles.forEach(article => {
    usedIds.add(article.articleId);
    html += '<div class="popular-item">';
    html += '<a href="#" onclick="openArticle(\'' + article.categorySlug + '\', \'' + article.articleId + '\'); return false;" class="popular-image">';
    html += '<img src="' + getImagePath(article.articleId) + '" alt="' + article.title + '" onerror="this.parentElement.style.background=\'#ddd\'">';
    html += '</a>';
    html += '<div class="popular-content">';
    html += '<a href="#" onclick="openArticle(\'' + article.categorySlug + '\', \'' + article.articleId + '\'); return false;" class="popular-title">' + article.title + '</a>';
    html += '</div>';
    html += '</div>';
  });

  html += '</div>'; // End sidebar-content
  html += '</div>'; // End sidebar-section

  // 5. 300x250 Ad Unit - matches home page
  html += '<div class="home-ad-unit">';
  html += '<a href="https://jubileeverse.com?utm_source=lumiatos&utm_campaign=CAMP-003&utm_ad=AD-003-A" target="_blank" rel="noopener" onclick="handleAdClick(\'AD-003-A\', \'CAMP-003\', this.href);">';
  html += '<img src="' + lumiatosPath + 'images/jubileeverse-300x250.jpg" alt="JubileeVerse.com - Beyond Artificial Intelligence: Smarter Today, Stronger Tomorrow">';
  html += '</a>';
  html += '<div class="home-ad-label">Advertisement</div>';
  html += '</div>';

  // 6. You Might Like section - matches home page
  if (articles.length > 0) {
    const randomArticle = articles[Math.floor(Math.random() * articles.length)];
    html += '<div class="random-article">';
    html += '<div class="random-article-header">You Might Like</div>';
    html += articleLink(categorySlug, randomArticle.articleId, randomArticle.title, 'random-article-image', '<img src="' + getImagePath(randomArticle.articleId) + '" alt="' + randomArticle.title + '" onerror="this.parentElement.style.background=\'#ddd\'">');
    html += '<div class="random-article-content">';
    html += '<h4 class="random-article-title">' + articleLink(categorySlug, randomArticle.articleId, randomArticle.title, '', randomArticle.title) + '</h4>';
    html += '<p class="random-article-excerpt">' + truncateText(randomArticle.excerpt || '', 100) + '</p>';
    html += '</div>';
    html += '</div>';
  }

  html += '</aside>';

  html += '</div>'; // End content-grid
  html += '</main>'; // End main-content

  return html;
}

function closePortal() {
  goHome();
}

// ============================================================================
// ARTICLE DETAIL PAGE
// ============================================================================

async function openArticle(categorySlug, articleId, skipUrlUpdate) {
  currentMode = 'article';
  currentCategory = categorySlug;
  currentArticle = articleId;

  // Hide other pages
  document.getElementById('homePage').style.display = 'none';
  document.getElementById('portalPage').style.display = 'none';
  const articleDetailPage = document.getElementById('articleDetailPage');
  if (articleDetailPage) articleDetailPage.style.display = 'none';

  // Show the original article page section
  const articlePage = document.getElementById('articlePage');
  articlePage.classList.remove('hidden');
  articlePage.style.display = 'block';

  try {
    // Load article content from category JSON
    const articles = await loadCategoryArticles(categorySlug);
    const article = articles.find(a => a.id === articleId);

    if (!article) {
      throw new Error('Article not found');
    }

    // Update URL to article page
    if (!skipUrlUpdate && window.history && window.history.pushState) {
      const articleUrl = buildArticleHref(categorySlug, article.title);
      window.history.pushState({ type: 'article', categorySlug, articleId }, '', articleUrl);
    }

    // Use siteData.categories (populated by inline script) or categoriesData (if app.js loaded it)
    const categories = siteData?.categories || categoriesData?.categories || [];
    const categoryName = categories.find(c => c.slug === categorySlug)?.name || categorySlug;

    // Populate the existing article page elements
    document.getElementById('articleTitle').textContent = article.title;
    document.getElementById('articleCategory').textContent = categoryName;
    document.getElementById('articleAuthor').textContent = article.author ? 'By ' + article.author : 'By Editorial';
    document.getElementById('articleDate').textContent = 'Updated today';

    // Update breadcrumbs with proper hrefs
    const homeHref = buildHomeHref();
    const categoryHref = buildCategoryHref(categorySlug);
    document.getElementById('articleBreadcrumbs').innerHTML = '<a href="' + homeHref + '" onclick="goHome(); return false;">Home</a> | <a href="' + categoryHref + '" onclick="openPortal(\'' + categorySlug + '\'); return false;">' + categoryName + '</a>';

    // Set hero image
    const heroImg = document.getElementById('articleHero');
    if (heroImg) {
      heroImg.src = getImagePath(articleId);
      heroImg.alt = article.title;
      heroImg.onerror = function() { this.src = getImagePath('placeholder').replace('.jpg', '.jpg'); };
    }

    // Set caption if available
    const captionEl = document.getElementById('articleCaption');
    if (captionEl) {
      captionEl.textContent = article.caption || '';
      captionEl.style.display = article.caption ? 'block' : 'none';
    }

    // Format and set article body content
    const content = stripMarkdown(article.content || '');
    const paragraphs = content.split('\n\n').filter(p => p.trim());
    let bodyHtml = '';
    paragraphs.forEach(p => {
      bodyHtml += '<p>' + p.trim() + '</p>';
    });
    document.getElementById('articleBody').innerHTML = bodyHtml;

    // Populate Read Next section with related articles
    const readNextSection = document.getElementById('readNextSection');
    const readNextList = document.getElementById('readNextList');
    if (readNextSection && readNextList) {
      const relatedArticles = getArticlesFromOtherCategories(categorySlug, 4);
      if (relatedArticles.length > 0) {
        let readNextHtml = '';
        relatedArticles.forEach(related => {
          const relCatName = categories.find(c => c.slug === related.categorySlug)?.name || related.categorySlug;
          const readNextHref = buildArticleHref(related.categorySlug, related.title);
          readNextHtml += '<div class="read-next-item">';
          readNextHtml += '<a href="' + readNextHref + '" onclick="openArticle(\'' + related.categorySlug + '\', \'' + related.articleId + '\'); return false;">';
          readNextHtml += '<img src="' + getImagePath(related.articleId) + '" alt="' + related.title + '" onerror="this.style.display=\'none\'">';
          readNextHtml += '<span>' + related.title + '</span>';
          readNextHtml += '</a></div>';
        });
        readNextList.innerHTML = readNextHtml;
        readNextSection.style.display = 'block';
      } else {
        readNextSection.style.display = 'none';
      }
    }

    window.scrollTo(0, 0);

    // Track view
    if (window.ViewTracker) {
      window.ViewTracker.trackArticleView(articleId, categorySlug);
    }

  } catch (error) {
    console.error('Error loading article:', error);
    document.getElementById('articleBody').innerHTML = '<p style="color: red;">Error loading article. Please try again.</p>';
  }
}

function buildArticleHTML(article, categorySlug, categoryName) {
  const content = stripMarkdown(article.content || '');
  const paragraphs = content.split('\n\n').filter(p => p.trim());

  let html = '<article class="article-detail">';
  html += '<header class="article-header">';
  html += '<a href="#" class="article-category" onclick="openPortal(\'' + categorySlug + '\'); return false;">' + categoryName + '</a>';
  html += '<h1 class="article-title">' + article.title + '</h1>';
  html += '<div class="article-meta">';
  if (article.author) {
    html += '<span class="article-author">By ' + article.author + '</span>';
  }
  html += '</div></header>';

  html += '<div class="article-image">';
  html += '<img src="' + getImagePath(article.id) + '" alt="' + article.title + '">';
  html += '</div>';

  html += '<div class="article-content">';
  paragraphs.forEach(p => {
    html += '<p>' + p + '</p>';
  });
  html += '</div>';

  // Related articles
  const artCategories = siteData?.categories || categoriesData?.categories || [];
  const relatedArticles = getArticlesFromOtherCategories(categorySlug, 4);
  if (relatedArticles.length > 0) {
    html += '<section class="related-articles"><h3>Related Articles</h3>';
    html += '<div class="related-grid">';
    relatedArticles.forEach(related => {
      const relCatName = artCategories.find(c => c.slug === related.categorySlug)?.name || related.categorySlug;
      const relatedHref = buildArticleHref(related.categorySlug, related.title);
      html += '<div class="related-item">';
      html += '<img src="' + getImagePath(related.articleId) + '" alt="' + related.title + '">';
      html += '<span class="related-category">' + relCatName + '</span>';
      html += '<a href="' + relatedHref + '" onclick="openArticle(\'' + related.categorySlug + '\', \'' + related.articleId + '\'); return false;">' + related.title + '</a>';
      html += '</div>';
    });
    html += '</div></section>';
  }

  html += '</article>';

  return html;
}

// Alias for compatibility
function showContentPage(articleId, categorySlug) {
  openArticle(categorySlug, articleId);
}

function showArticleDetail(slug) {
  // Try to find article in allArticles
  const article = siteData?.allArticles?.find(a => a.articleId === slug || a.slug === slug);
  if (article) {
    openArticle(article.categorySlug, article.articleId);
  }
}

function closeArticleDetail() {
  if (currentCategory) {
    openPortal(currentCategory);
  } else {
    goHome();
  }
}

// ============================================================================
// FEATURED SECTIONS (Home Page)
// ============================================================================

async function populateFeaturedSections() {
  if (!siteData || !siteData.allArticles || siteData.allArticles.length === 0) {
    console.log('No articles available for featured sections');
    return;
  }

  const categories = categoriesData?.categories || siteData?.categories || [];

  // Group articles by category
  const articlesByCategory = {};
  siteData.allArticles.forEach(article => {
    if (!articlesByCategory[article.categorySlug]) {
      articlesByCategory[article.categorySlug] = [];
    }
    articlesByCategory[article.categorySlug].push(article);
  });

  // Featured Categories Grid
  const categoryKeys = Object.keys(articlesByCategory).slice(0, 4);
  const featuredGrid = document.getElementById('featured-categories-grid');

  if (featuredGrid && categoryKeys.length > 0) {
    const categoryCards = await Promise.all(categoryKeys.map(async (categorySlug) => {
      const articles = articlesByCategory[categorySlug];
      const article = articles[0];
      const categoryName = categories.find(c => c.slug === categorySlug)?.name || categorySlug;
      const excerpt = article.content ? stripMarkdown(article.content).substring(0, 150) + '...' : '';

      // Get 4 random articles from this category
      const otherArticles = articles.slice(1);
      const shuffled = [...otherArticles].sort(() => Math.random() - 0.5);
      const randomArticles = shuffled.slice(0, 4);

      // Load full content for excerpts
      let articlesWithContent = [];
      try {
        const fullArticles = await loadCategoryArticles(categorySlug);
        const contentMap = {};
        fullArticles.forEach(a => { contentMap[a.id] = a.content; });
        articlesWithContent = randomArticles.map(a => ({
          ...a,
          fullContent: contentMap[a.articleId] || a.content || ''
        }));
      } catch (e) {
        articlesWithContent = randomArticles;
      }

      const moreLinksHTML = articlesWithContent.map(a => {
        const cleanContent = stripMarkdown(a.fullContent || '');
        const words = cleanContent.split(/\s+/).slice(0, 15).join(' ');
        const moreHref = buildArticleHref(categorySlug, a.title || '');
        return `<a href="${moreHref}" class="more-link" onclick="showContentPage('${a.articleId}', '${categorySlug}'); return false;">${words}...</a>`;
      }).join('');

      const featCardHref = buildArticleHref(categorySlug, article.title);
      return `
        <div class="featured-category-card">
          <div class="featured-category-header">${categoryName}</div>
          <img src="${getImagePath(article.articleId)}" alt="${article.title}" class="featured-category-image">
          <div class="featured-category-title">
            <a href="${featCardHref}" onclick="showContentPage('${article.articleId}', '${categorySlug}'); return false;">${article.title}</a>
          </div>
          <div class="featured-category-excerpt">${excerpt}</div>
          ${moreLinksHTML ? `<div class="featured-category-more-links">${moreLinksHTML}</div>` : ''}
        </div>
      `;
    }));

    featuredGrid.innerHTML = categoryCards.join('');
  }

  // More From Our Brands
  const shuffled = [...siteData.allArticles].sort(() => Math.random() - 0.5);
  const brandArticles = shuffled.slice(0, 5);
  const brandsGrid = document.getElementById('more-from-brands-grid');

  if (brandsGrid && brandArticles.length > 0) {
    brandsGrid.innerHTML = brandArticles.map(article => {
      const categoryName = categories.find(c => c.slug === article.categorySlug)?.name || article.categorySlug;
      const brandHref = buildArticleHref(article.categorySlug, article.title);
      return `
        <div class="brand-card">
          <img src="${getImagePath(article.articleId)}" alt="${article.title}" class="brand-card-image">
          <div class="brand-card-label">${categoryName}</div>
          <div class="brand-card-title">
            <a href="${brandHref}" onclick="showContentPage('${article.articleId}', '${article.categorySlug}'); return false;">${article.title}</a>
          </div>
        </div>
      `;
    }).join('');
  }
}

// ============================================================================
// SUBSCRIBE MODAL
// ============================================================================

function openSubscribeModal() {
  const modal = document.getElementById('subscribeModal');
  if (modal) {
    modal.style.display = 'flex';
    document.getElementById('form-view').style.display = 'block';
    document.getElementById('thank-you-view').style.display = 'none';
  }
}

function closeSubscribeModal() {
  const modal = document.getElementById('subscribeModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// ============================================================================
// VIEW TRACKING
// ============================================================================

const ViewTracker = {
  trackerData: null,

  getTrackerPath() {
    return getWebstorePath() + 'web_tracker.json';
  },

  async init() {
    try {
      const response = await fetch(this.getTrackerPath());
      if (response.ok) {
        this.trackerData = await response.json();
      }
    } catch (error) {
      console.log('ViewTracker: Creating new tracker');
    }
  },

  trackPageView(page) {
    console.log('Page view:', page);
  },

  trackArticleView(articleId, categorySlug) {
    console.log('Article view:', articleId, categorySlug);
  },

  trackAdView(adId, campaignId, placement, page, category) {
    console.log('Ad view:', adId, placement);
  }
};

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize all navigation links to use dynamic base path
 * This allows the same code to work in any folder structure
 */
function initializeNavigationLinks() {
  const basePath = getBasePath();
  const homeUrl = basePath + '/index.html';

  // Update <base> tag
  const baseTag = document.querySelector('base');
  if (baseTag) {
    baseTag.href = basePath + '/';
  }

  // Update header home link
  const siteHomeLink = document.getElementById('siteHomeLink');
  if (siteHomeLink) {
    siteHomeLink.href = homeUrl;
  }

  // Update home icon link in navigation
  const homeIconLink = document.querySelector('#category-nav .home-link a');
  if (homeIconLink) {
    homeIconLink.href = homeUrl;
  }

  // Update Back to Home link
  const backToHome = document.getElementById('backToHome');
  if (backToHome) {
    backToHome.href = homeUrl;
  }

  // Update category navigation links
  const categoryLinks = document.querySelectorAll('#category-nav ul li:not(.home-link) a');
  categoryLinks.forEach(function(link) {
    const onclickAttr = link.getAttribute('onclick');
    if (onclickAttr) {
      // Extract category slug from onclick: openPortal('category-slug')
      const match = onclickAttr.match(/openPortal\(['"]([^'"]+)['"]\)/);
      if (match) {
        const categorySlug = match[1];
        link.href = basePath + '/' + categorySlug + '.html';
      }
    }
  });

  console.log('Navigation links initialized with base path:', basePath);
}

document.addEventListener('DOMContentLoaded', function() {
  // Initialize navigation links first (before any navigation happens)
  initializeNavigationLinks();

  // Load all site data
  loadSiteData();

  // Initialize smooth ticker after a short delay
  setTimeout(initSmoothTicker, 100);

  // Subscribe button
  const subscribeBtn = document.getElementById('subscribe-btn');
  if (subscribeBtn) {
    subscribeBtn.addEventListener('click', openSubscribeModal);
  }

  // Modal handlers
  const modal = document.getElementById('subscribeModal');
  if (modal) {
    modal.addEventListener('click', function(e) {
      if (e.target === modal) closeSubscribeModal();
    });

    const cancelBtn = document.getElementById('btn-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', closeSubscribeModal);

    const okBtn = document.getElementById('btn-ok');
    if (okBtn) okBtn.addEventListener('click', closeSubscribeModal);
  }

  // Subscribe form
  const form = document.getElementById('subscribe-form');
  if (form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      const name = document.getElementById('subscribe-name').value;
      const email = document.getElementById('subscribe-email').value;

      if (!name || !email) {
        document.getElementById('subscribe-error').textContent = 'Please fill in all fields';
        return;
      }

      document.getElementById('form-view').style.display = 'none';
      document.getElementById('thank-you-view').style.display = 'block';
    });
  }

  // Initialize view tracker
  ViewTracker.init();
});

// ============================================================================
// LEGACY NAVIGATION FUNCTIONS (kept for backward compatibility)
// ============================================================================

// These functions are now integrated into openArticle, openPortal, and goHome
// but kept here for any external code that might call them

function navigateToArticle(categorySlug, articleId, articleTitle) {
  openArticle(categorySlug, articleId);
}

function navigateToCategory(categorySlug) {
  openPortal(categorySlug);
}

function navigateToHome() {
  goHome();
}

/**
 * Handle browser back/forward navigation
 */
window.addEventListener('popstate', function(event) {
  if (event.state) {
    // Use skipUrlUpdate=true since we're navigating from history
    if (event.state.type === 'article') {
      openArticle(event.state.categorySlug, event.state.articleId, true);
    } else if (event.state.type === 'category') {
      openPortal(event.state.categorySlug, true);
    } else if (event.state.type === 'home') {
      goHome(true);
    }
  } else {
    // Check URL path to determine what to show
    handlePathNavigation();
  }
});

/**
 * Parse URL path to determine current page
 * Supports: /pentecostal/home/index.html (home)
 *           /pentecostal/home/category-slug.html (category)
 *           /pentecostal/home/category-slug/index.html (category folder)
 *           /pentecostal/home/category-slug/article-slug.html (article)
 *
 * CRITICAL: This function is called AFTER data is loaded from loadSiteData()
 */
function handlePathNavigation() {
  const path = window.location.pathname;
  const parts = path.split('/').filter(p => p);

  console.log('=== handlePathNavigation ===');
  console.log('Path:', path);
  console.log('Parts:', parts);
  console.log('window.dataLoaded:', window.dataLoaded);
  console.log('window.siteData available:', !!window.siteData);

  // Check for hash fallback (legacy URLs)
  if (window.location.hash) {
    handleHashNavigation();
    return;
  }

  // Get the last few parts of the path
  // e.g., ['pentecostal', 'home', 'spiritual-growth.html']
  // or    ['pentecostal', 'home', 'spiritual-growth', 'index.html'] (category folder)
  // or    ['pentecostal', 'home', 'spiritual-growth', 'article-title.html']

  if (parts.length < 3) {
    console.log('handlePathNavigation: Not enough parts, staying on home');
    return; // Not enough parts for our URL structure
  }

  const lastPart = parts[parts.length - 1];

  // If path is exactly /group/subsite/index.html (3 parts ending in index.html), it's home
  if (parts.length === 3 && lastPart === 'index.html') {
    console.log('handlePathNavigation: Home page detected');
    return; // Already on home page
  }

  // Use window.siteData as single source of truth
  const sd = window.siteData || siteData;

  // If path is /group/subsite/category/index.html (4 parts ending in index.html), it's a category
  // e.g., /pentecostal/home/faith-in-action/index.html
  if (parts.length === 4 && lastPart === 'index.html') {
    const categorySlug = parts[2]; // e.g., 'faith-in-action'
    console.log('handlePathNavigation: Category folder URL detected:', categorySlug);

    if (sd && sd.portalPages && sd.portalPages[categorySlug]) {
      console.log('handlePathNavigation: Opening portal for', categorySlug);
      openPortal(categorySlug, true);
    } else {
      // Known categories fallback
      const knownCategories = ['spiritual-growth', 'faith-in-action', 'worship-and-praise', 'prayer-and-devotion', 'holy-spirit'];
      if (knownCategories.includes(categorySlug)) {
        console.log('handlePathNavigation: Opening known category portal', categorySlug);
        openPortal(categorySlug, true);
      } else {
        console.warn('handlePathNavigation: Category not found:', categorySlug);
      }
    }
    return;
  }

  // If path has 4 parts and ends with .html (not index.html), it's an article
  // e.g., /pentecostal/home/spiritual-growth/article-title.html
  if (parts.length >= 4 && lastPart.endsWith('.html') && lastPart !== 'index.html') {
    const categorySlug = parts[parts.length - 2];
    const articleSlug = lastPart.replace('.html', '');
    console.log('handlePathNavigation: Article URL detected - category:', categorySlug, 'slug:', articleSlug);

    // Find article by matching slug
    if (sd && sd.allArticles) {
      const article = sd.allArticles.find(a => {
        const aSlug = (a.title || '')
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .substring(0, 80);
        return aSlug === articleSlug && (a.categorySlug === categorySlug);
      });

      if (article) {
        console.log('handlePathNavigation: Found article, opening:', article.articleId);
        openArticle(categorySlug, article.articleId || article.id, true);
        return;
      }
    }
  }

  // If path has 3 parts and ends with .html, it's a category
  // e.g., /pentecostal/home/spiritual-growth.html
  if (parts.length >= 3 && lastPart.endsWith('.html') && lastPart !== 'index.html') {
    const categorySlug = lastPart.replace('.html', '');
    console.log('handlePathNavigation: Category .html URL detected:', categorySlug);

    // CRITICAL: Only proceed if portalPages are loaded
    if (!sd?.portalPages) {
      console.log('handlePathNavigation: Waiting for portalPages to load...');
      return;
    }

    const categories = sd?.categories || window.categoriesData?.categories || [];
    const category = categories.find(c => c.slug === categorySlug);
    if (category) {
      console.log('handlePathNavigation: Opening category portal', categorySlug);
      openPortal(categorySlug, true);
      return;
    }
  }

  console.log('handlePathNavigation: No special navigation needed');
}

// Legacy hash navigation support for backwards compatibility
function handleHashNavigation() {
  const hash = window.location.hash.slice(1);
  if (!hash) return;

  // Check for article URL format: article/{categorySlug}/{articleId}
  if (hash.startsWith('article/')) {
    const parts = hash.split('/');
    if (parts.length >= 3) {
      const categorySlug = parts[1];
      const articleId = parts[2];
      console.log('Hash navigation: Opening article', articleId, 'in category', categorySlug);
      openArticle(categorySlug, articleId, true);
      return;
    }
  }

  // Check for category URL format: {categorySlug}
  const categories = siteData?.categories || categoriesData?.categories || [];
  if (categories.length > 0) {
    const category = categories.find(c => c.slug === hash);
    if (category) {
      console.log('Hash navigation: Opening category portal', hash);
      openPortal(hash, true);
    }
  }
}

window.addEventListener('hashchange', handleHashNavigation);

// NOTE: handlePathNavigation is now called directly from loadSiteData() AFTER data is loaded
// This eliminates the race condition where navigation happened before data was available

// Export functions for global access
window.goHome = goHome;
window.openPortal = openPortal;
window.closePortal = closePortal;
window.openArticle = openArticle;
window.showContentPage = showContentPage;
window.showArticleDetail = showArticleDetail;
window.closeArticleDetail = closeArticleDetail;
window.changeHeroSlide = changeHeroSlide;
window.goToHeroSlide = goToHeroSlide;
window.goToSlide = goToSlide;
window.openSubscribeModal = openSubscribeModal;
window.closeSubscribeModal = closeSubscribeModal;
window.ViewTracker = ViewTracker;
// SEO-friendly URL functions
window.navigateToArticle = navigateToArticle;
window.navigateToCategory = navigateToCategory;
window.navigateToHome = navigateToHome;
window.buildArticleHref = buildArticleHref;
window.buildCategoryHref = buildCategoryHref;
window.buildHomeHref = buildHomeHref;
window.getBasePath = getBasePath;
window.initializeNavigationLinks = initializeNavigationLinks;
// Helper functions
window.truncateText = truncateText;
window.stripMarkdown = stripMarkdown;
window.getImagePath = getImagePath;
window.getWebstorePath = getWebstorePath;
window.getLumiatosPath = getLumiatosPath;
window.updateActiveNavLink = updateActiveNavLink;
