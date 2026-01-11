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
// GLOBAL STATE
// ============================================================================

let siteData = null;
let categoriesData = null;
let currentMode = 'home';
let currentCategory = null;
let currentArticle = null;
let heroSlideIndex = 0;
let heroInterval = null;
let portalPageCache = {};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

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
 */
async function loadSiteData() {
  try {
    // Load categories first
    const categoriesResponse = await fetch('.webstore/web_categories.json');
    if (categoriesResponse.ok) {
      categoriesData = await categoriesResponse.json();
      console.log('Loaded categories:', categoriesData.categories.length);
    }

    // Load today's history file
    const historyFile = getTodayHistoryFileName();
    const historyResponse = await fetch('.webstore/history/' + historyFile);
    if (historyResponse.ok) {
      siteData = await historyResponse.json();
      console.log('Loaded site data from history:', historyFile);
    } else {
      console.warn('History file not found:', historyFile);
    }

    // Initialize components
    buildNavigation();
    buildTicker();
    updateFooterCategories();
    startHeroCarousel();

    // Populate dynamic sections
    setTimeout(populateFeaturedSections, 500);

  } catch (error) {
    console.error('Error loading site data:', error);
    // Fallback: just start the carousel with server-rendered content
    startHeroCarousel();
  }
}

/**
 * Load articles for a specific category
 */
async function loadCategoryArticles(categorySlug) {
  try {
    const response = await fetch(categorySlug + '/web_articles.json');
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
 */
async function buildNavigation() {
  const navList = document.getElementById('nav-list');
  if (!navList) return;

  // Use loaded categories or fallback to siteData
  const categories = categoriesData?.categories || siteData?.categories || [];
  if (categories.length === 0) {
    console.log('No categories available, keeping server-rendered nav');
    return;
  }

  // SVG Home Icon
  const homeSvg = '<svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>';

  // Build navigation: Home + ALL categories
  let navHtml = '<li class="home-link"><a href="#" onclick="goHome(); return false;">' + homeSvg + '</a></li>';

  categories.forEach(cat => {
    navHtml += '<li><a href="#' + cat.slug + '" onclick="openPortal(\'' + cat.slug + '\'); return false;">' + cat.name + '</a></li>';
  });

  navList.innerHTML = navHtml;
  console.log('Navigation built with', categories.length, 'categories');
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
    tickerHtml += '<span class="ticker-item"><span class="cat-label">' + catName + ':</span> ';
    tickerHtml += '<a href="#" onclick="openArticle(\'' + article.categorySlug + '\', \'' + article.articleId + '\'); return false;">' + article.title + '</a></span>';
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
    footerCategoriesList.innerHTML = categories.map(cat =>
      '<li><a href="#" onclick="openPortal(\'' + cat.slug + '\'); return false;">' + cat.name + '</a></li>'
    ).join('');
  }

  // Update footer bottom category links
  const footerCategoryLinks = document.getElementById('footer-category-links');
  if (footerCategoryLinks) {
    footerCategoryLinks.innerHTML = categories.map(cat =>
      '<a href="#" onclick="openPortal(\'' + cat.slug + '\'); return false;">' + cat.name + '</a>'
    ).join(' | ');
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

function goHome() {
  currentMode = 'home';
  currentCategory = null;
  currentArticle = null;

  document.getElementById('homePage').style.display = 'block';
  document.getElementById('portalPage').style.display = 'none';
  document.getElementById('articleDetailPage').style.display = 'none';

  window.scrollTo(0, 0);
}

function renderHomePage() {
  document.getElementById('homePage').style.display = 'block';
  document.getElementById('portalPage').style.display = 'none';
  document.getElementById('articleDetailPage').style.display = 'none';
}

// ============================================================================
// PORTAL MODE (Category Page)
// ============================================================================

async function openPortal(categorySlug) {
  currentMode = 'portal';
  currentCategory = categorySlug;

  document.getElementById('homePage').style.display = 'none';
  document.getElementById('articleDetailPage').style.display = 'none';

  const portalPage = document.getElementById('portalPage');
  portalPage.style.display = 'block';
  portalPage.innerHTML = '<div style="padding: 40px; text-align: center;">Loading...</div>';

  try {
    const portalData = siteData?.portalPages?.[categorySlug];
    if (!portalData) {
      throw new Error('Portal not found');
    }

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
    const categoryName = categoriesData?.categories?.find(c => c.slug === categorySlug)?.name || categorySlug;
    let html = buildPortalHTML(categorySlug, categoryName, uniqueArticles, otherCategoryArticles, usedArticleIds);

    portalPage.innerHTML = html;
    window.scrollTo(0, 0);

  } catch (error) {
    console.error('Error loading portal:', error);
    portalPage.innerHTML = '<div style="padding: 40px; text-align: center; color: red;">Error loading category. Please try again.</div>';
  }
}

function buildPortalHTML(categorySlug, categoryName, articles, otherArticles, usedIds) {
  let html = '<main class="main-content"><div class="content-grid"><div class="main-column">';

  // Hero
  const heroArticle = articles[0];
  if (heroArticle) {
    usedIds.add(heroArticle.articleId);
    html += '<section class="hero-section">';
    html += '<div class="hero-image">';
    html += '<img src="' + (heroArticle.image || 'images/' + heroArticle.articleId + '.jpg') + '" alt="' + heroArticle.title + '">';
    html += '<div class="hero-overlay">';
    html += '<h2 class="hero-title"><a href="#" onclick="openArticle(\'' + categorySlug + '\', \'' + heroArticle.articleId + '\'); return false;">' + heroArticle.title + '</a></h2>';
    html += '</div></div></section>';
  }

  // Featured Articles (from current category)
  const featuredArticles = articles.slice(1, 9);
  if (featuredArticles.length > 0) {
    html += '<section class="featured-section"><h3 class="section-title">Featured in ' + categoryName + '</h3>';
    html += '<div class="featured-grid">';
    featuredArticles.forEach(article => {
      usedIds.add(article.articleId);
      html += '<div class="featured-item">';
      html += '<img src="images/' + article.articleId + '.jpg" alt="' + article.title + '">';
      html += '<div class="featured-title"><a href="#" onclick="openArticle(\'' + categorySlug + '\', \'' + article.articleId + '\'); return false;">' + article.title + '</a></div>';
      html += '</div>';
    });
    html += '</div></section>';
  }

  // Spotlight (from OTHER categories)
  const spotlightArticles = otherArticles.filter(a => !usedIds.has(a.articleId)).slice(0, 3);
  if (spotlightArticles.length > 0) {
    html += '<section class="spotlight-section"><h3 class="section-title">In The Spotlight</h3>';
    html += '<div class="spotlight-grid">';
    spotlightArticles.forEach(article => {
      const catName = categoriesData?.categories?.find(c => c.slug === article.categorySlug)?.name || article.categorySlug;
      html += '<div class="spotlight-item">';
      html += '<span class="spotlight-category">' + catName + '</span>';
      html += '<img src="images/' + article.articleId + '.jpg" alt="' + article.title + '">';
      html += '<div class="spotlight-title"><a href="#" onclick="openArticle(\'' + article.categorySlug + '\', \'' + article.articleId + '\'); return false;">' + article.title + '</a></div>';
      html += '</div>';
    });
    html += '</div></section>';
  }

  html += '</div>'; // end main-column

  // Sidebar
  html += '<aside class="sidebar">';

  // Related Information (from OTHER categories)
  const relatedArticles = otherArticles.filter(a => !usedIds.has(a.articleId)).slice(3, 7);
  if (relatedArticles.length > 0) {
    html += '<div class="sidebar-section"><h4 class="sidebar-title">Related Information</h4>';
    html += '<div class="sidebar-content">';
    relatedArticles.forEach(article => {
      html += '<div class="sidebar-item">';
      html += '<img src="images/' + article.articleId + '.jpg" alt="' + article.title + '">';
      html += '<a href="#" onclick="openArticle(\'' + article.categorySlug + '\', \'' + article.articleId + '\'); return false;">' + article.title + '</a>';
      html += '</div>';
    });
    html += '</div></div>';
  }

  html += '</aside></div></main>';

  return html;
}

function closePortal() {
  goHome();
}

// ============================================================================
// ARTICLE DETAIL PAGE
// ============================================================================

async function openArticle(categorySlug, articleId) {
  currentMode = 'article';
  currentCategory = categorySlug;
  currentArticle = articleId;

  document.getElementById('homePage').style.display = 'none';
  document.getElementById('portalPage').style.display = 'none';

  const articlePage = document.getElementById('articleDetailPage');
  articlePage.style.display = 'block';
  articlePage.innerHTML = '<div style="padding: 40px; text-align: center;">Loading article...</div>';

  try {
    // Load article content from category JSON
    const articles = await loadCategoryArticles(categorySlug);
    const article = articles.find(a => a.id === articleId);

    if (!article) {
      throw new Error('Article not found');
    }

    const categoryName = categoriesData?.categories?.find(c => c.slug === categorySlug)?.name || categorySlug;
    const html = buildArticleHTML(article, categorySlug, categoryName);
    articlePage.innerHTML = html;
    window.scrollTo(0, 0);

    // Track view
    if (window.ViewTracker) {
      window.ViewTracker.trackArticleView(articleId, categorySlug);
    }

  } catch (error) {
    console.error('Error loading article:', error);
    articlePage.innerHTML = '<div style="padding: 40px; text-align: center; color: red;">Error loading article. Please try again.</div>';
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
  html += '<img src="images/' + article.id + '.jpg" alt="' + article.title + '">';
  html += '</div>';

  html += '<div class="article-content">';
  paragraphs.forEach(p => {
    html += '<p>' + p + '</p>';
  });
  html += '</div>';

  // Related articles
  const relatedArticles = getArticlesFromOtherCategories(categorySlug, 4);
  if (relatedArticles.length > 0) {
    html += '<section class="related-articles"><h3>Related Articles</h3>';
    html += '<div class="related-grid">';
    relatedArticles.forEach(related => {
      const relCatName = categoriesData?.categories?.find(c => c.slug === related.categorySlug)?.name || related.categorySlug;
      html += '<div class="related-item">';
      html += '<img src="images/' + related.articleId + '.jpg" alt="' + related.title + '">';
      html += '<span class="related-category">' + relCatName + '</span>';
      html += '<a href="#" onclick="openArticle(\'' + related.categorySlug + '\', \'' + related.articleId + '\'); return false;">' + related.title + '</a>';
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
        return `<a href="#" class="more-link" onclick="showContentPage('${a.articleId}', '${categorySlug}'); return false;">${words}...</a>`;
      }).join('');

      return `
        <div class="featured-category-card">
          <div class="featured-category-header">${categoryName}</div>
          <img src="images/${article.articleId}.jpg" alt="${article.title}" class="featured-category-image">
          <div class="featured-category-title">
            <a href="#" onclick="showContentPage('${article.articleId}', '${categorySlug}'); return false;">${article.title}</a>
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
      return `
        <div class="brand-card">
          <img src="images/${article.articleId}.jpg" alt="${article.title}" class="brand-card-image">
          <div class="brand-card-label">${categoryName}</div>
          <div class="brand-card-title">
            <a href="#" onclick="showContentPage('${article.articleId}', '${article.categorySlug}'); return false;">${article.title}</a>
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
  trackerPath: '.webstore/web_tracker.json',
  trackerData: null,

  async init() {
    try {
      const response = await fetch(this.trackerPath);
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

document.addEventListener('DOMContentLoaded', function() {
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

// Handle hash navigation for SEO-friendly URLs
// Supports: #article/{categorySlug}/{articleId} and #{categorySlug}
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
      openArticle(categorySlug, articleId);
      return;
    }
  }

  // Check for category URL format: {categorySlug}
  if (categoriesData) {
    const category = categoriesData.categories.find(c => c.slug === hash);
    if (category) {
      console.log('Hash navigation: Opening category portal', hash);
      openPortal(hash);
    }
  }
}

window.addEventListener('hashchange', handleHashNavigation);

// Also handle initial page load with hash
if (window.location.hash) {
  // Delay to ensure data is loaded
  setTimeout(handleHashNavigation, 500);
}

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
