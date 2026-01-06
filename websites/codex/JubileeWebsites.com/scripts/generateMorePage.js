/**
 * Generate Sitemap Page Script
 *
 * This script generates the "Sitemap" page for a website domain.
 * The Sitemap page displays all articles in a 4-column grid layout,
 * organized by category, serving as both a visual archive and sitemap.
 *
 * Usage: node scripts/generateMorePage.js <domain>
 * Example: node scripts/generateMorePage.js GodsGrace.com
 *
 * This script should be run once daily via cron job or task scheduler.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WEBSITES_PATH = path.join(__dirname, '..', '.datastore', 'websites');

/**
 * Category display order (matches homepage navigation)
 * Categories not in this list will be sorted alphabetically at the end
 */
const CATEGORY_ORDER = [
  'divine-inspirations',
  'prayer-worship',
  'biblical-teachings',
  'family-relationships',
  'christian-living'
];

/**
 * Format domain name into readable site name
 */
function formatSiteName(domain) {
  return domain
    .replace('.com', '')
    .replace('.org', '')
    .replace('.net', '')
    .replace(/([A-Z])/g, ' $1')
    .replace(/\bGods\b/gi, "God's")
    .trim();
}

/**
 * Read all articles from a website's category folders
 */
async function getAllArticles(websitePath) {
  const categories = [];
  const entries = await fs.readdir(websitePath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      const articlesPath = path.join(websitePath, entry.name, 'web_articles.json');
      try {
        const data = await fs.readFile(articlesPath, 'utf8');
        const { articles } = JSON.parse(data);
        if (articles && articles.length > 0) {
          categories.push({
            name: articles[0].category,
            slug: articles[0].categorySlug,
            articles: articles.sort((a, b) => a.number - b.number)
          });
        }
      } catch (err) {
        // Skip directories without articles
      }
    }
  }

  // Sort categories by predefined order (matches homepage navigation)
  return categories.sort((a, b) => {
    const aIndex = CATEGORY_ORDER.indexOf(a.slug);
    const bIndex = CATEGORY_ORDER.indexOf(b.slug);

    // If both are in the order list, sort by that order
    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex;
    }
    // If only one is in the order list, it comes first
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    // If neither is in the order list, sort alphabetically
    return a.name.localeCompare(b.name);
  });
}

/**
 * Read categories configuration
 */
async function getCategories(websitePath) {
  const categoriesPath = path.join(websitePath, '.webstore', 'web_categories.json');
  try {
    const data = await fs.readFile(categoriesPath, 'utf8');
    const { categories } = JSON.parse(data);
    return categories;
  } catch (err) {
    return [];
  }
}

/**
 * Generate article card HTML
 * Links use index.html with hash to trigger the single-page app navigation
 */
function generateArticleCard(article) {
  return `        <article class="article-card">
          <a href="index.html#article/${article.categorySlug}/${article.id}">
            <img src="images/${article.id}.jpg" alt="${article.title.replace(/"/g, '&quot;')}" class="article-thumbnail" loading="lazy">
            <div class="article-info">
              <h3 class="article-title">${article.title}</h3>
            </div>
          </a>
        </article>`;
}

/**
 * Generate category section HTML
 */
function generateCategorySection(category) {
  const articlesHtml = category.articles.map(generateArticleCard).join('\n');

  return `    <!-- ${category.name} -->
    <section class="category-section">
      <div class="category-header">
        <h2 class="category-title">${category.name}</h2>
        <span class="category-count">${category.articles.length} articles</span>
      </div>
      <div class="article-grid">
${articlesHtml}
      </div>
    </section>`;
}

/**
 * Generate navigation links from categories
 * Uses relative paths with hash for single-page app navigation
 */
function generateNavLinks(categories) {
  const categoryLinks = categories.map(cat =>
    `      <div class="nav-link">
        <a href="index.html#category/${cat.slug}">${cat.name}</a>
      </div>`
  ).join('\n');

  return `      <div class="nav-link">
        <a href="index.html">
          <span class="home-icon">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
            </svg>
          </span>
          Home
        </a>
      </div>
${categoryLinks}`;
}

/**
 * Generate article links row (3 featured articles)
 */
function generateArticleLinksRow(categories) {
  // Pick first article from first 3 categories for the article links
  const links = [];
  for (let i = 0; i < Math.min(3, categories.length); i++) {
    const cat = categories[i];
    if (cat.articles && cat.articles.length > 0) {
      const article = cat.articles[0];
      const shortTitle = article.title.length > 40
        ? article.title.substring(0, 37) + '...'
        : article.title;
      links.push(`      <div class="article-link"><a href="index.html#article/${cat.slug}/${article.id}"><span class="article-category">${cat.name}:</span> ${shortTitle}</a></div>`);
    }
  }
  return links.join('\n');
}

/**
 * Generate the complete More page HTML
 */
function generateMorePageHtml(domain, siteName, categories) {
  const currentYear = new Date().getFullYear();
  const generatedDate = new Date().toISOString().split('T')[0];
  const totalArticles = categories.reduce((sum, cat) => sum + cat.articles.length, 0);

  const navLinks = generateNavLinks(categories);
  const articleLinksRow = generateArticleLinksRow(categories);
  const categorySections = categories.map(generateCategorySection).join('\n\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sitemap - ${siteName} | Complete Article Archive</title>

  <!-- SEO Meta Tags -->
  <meta name="description" content="Browse all ${totalArticles} articles on ${siteName}. Explore our complete archive of faith-based content organized by category.">
  <meta name="keywords" content="Christian articles, faith articles, Bible teachings, prayer guides, worship, Christian living, spiritual growth">
  <meta name="author" content="${siteName}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="https://${domain.toLowerCase()}/sitemap">

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://${domain.toLowerCase()}/sitemap">
  <meta property="og:title" content="Sitemap - ${siteName}">
  <meta property="og:description" content="Browse our complete archive of ${totalArticles} faith-based articles.">
  <meta property="og:site_name" content="${siteName}">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&family=Roboto+Condensed:wght@400;700&display=swap" rel="stylesheet">

  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Roboto', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #e0e0e0;
      color: #333;
      line-height: 1.5;
    }

    a {
      text-decoration: none;
      color: inherit;
    }

    /* Accessibility - Visually Hidden (Screen Reader Only) */
    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    /* Page Container */
    .page-container {
      max-width: 1200px;
      margin: 0 auto;
      background: #f5f5f5;
    }

    /* Header Table Container */
    .header-table-wrapper {
      width: 100%;
      background: #ffd700;
    }

    .header-table {
      width: 1200px;
      margin: 0 auto;
      border-collapse: collapse;
      background: #ffd700;
    }

    .header-table td {
      padding: 0;
    }

    /* Header Row */
    .header-row td {
      padding: 2px 20px;
      border-bottom: 3px solid #333;
    }

    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .header-brand {
      display: flex;
      align-items: baseline;
      gap: 10px;
    }

    .header-title {
      font-family: 'Roboto Condensed', sans-serif;
      font-size: 50px;
      font-weight: 700;
      color: #000;
      letter-spacing: -1px;
      line-height: 1;
      margin: 0;
      padding: 0;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 15px;
    }

    .search-box {
      display: flex;
      align-items: center;
      background: white;
      border: 1px solid #ccc;
      border-radius: 3px;
      padding: 5px 10px;
    }

    .search-box input {
      border: none;
      outline: none;
      font-size: 15px;
      width: 150px;
    }

    .search-box button {
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
      font-size: 16px;
    }

    .btn-subscribe {
      background: #cc0000;
      color: white;
      padding: 8px 15px;
      font-size: 14px;
      font-weight: 600;
      border-radius: 3px;
      text-transform: uppercase;
      cursor: pointer;
      border: none;
      transition: background 0.2s;
    }

    .btn-subscribe:hover {
      background: #a00000;
    }

    /* Subscribe Modal */
    .modal-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.7);
      z-index: 1000;
      justify-content: center;
      align-items: center;
    }

    .modal-overlay.active {
      display: flex;
    }

    .modal-content {
      background: #000;
      border: 3px solid #ffd700;
      border-radius: 12px;
      max-width: 450px;
      width: 90%;
      box-shadow: 0 10px 40px rgba(0,0,0,0.5);
      animation: modalSlideIn 0.3s ease;
      overflow: hidden;
    }

    @keyframes modalSlideIn {
      from {
        opacity: 0;
        transform: translateY(-30px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .modal-header {
      padding: 25px 25px 15px;
      display: flex;
      align-items: flex-start;
      gap: 15px;
    }

    .modal-title-wrap {
      flex: 1;
    }

    .modal-header h2 {
      font-family: 'Roboto Condensed', sans-serif;
      font-size: 26px;
      color: #ffd700;
      margin: 0 0 5px 0;
      padding-bottom: 8px;
      border-bottom: 2px solid #ffd700;
      display: block;
      width: 100%;
    }

    .modal-subtitle {
      color: #ccc;
      font-size: 16px;
      margin-top: 10px;
      line-height: 1.5;
    }

    .modal-body {
      padding: 0 25px 25px;
    }

    .subscribe-form {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .subscribe-form input[type="text"],
    .subscribe-form input[type="email"] {
      padding: 12px 15px;
      border: 1px solid #444;
      border-radius: 6px;
      font-size: 16px;
      outline: none;
      background: #1a1a1a;
      color: #fff;
      transition: border-color 0.2s;
    }

    .subscribe-form input[type="text"]::placeholder,
    .subscribe-form input[type="email"]::placeholder {
      color: #888;
    }

    .subscribe-form input[type="text"]:focus,
    .subscribe-form input[type="email"]:focus {
      border-color: #ffd700;
      box-shadow: 0 0 5px rgba(255, 215, 0, 0.3);
    }

    .modal-buttons {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 20px;
    }

    .btn-cancel {
      background: transparent;
      color: #999;
      padding: 10px 20px;
      border: 1px solid #444;
      border-radius: 6px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-cancel:hover {
      background: #222;
      color: #fff;
      border-color: #666;
    }

    .btn-submit {
      background: #ffd700;
      color: #000;
      padding: 10px 25px;
      border: none;
      border-radius: 6px;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.2s;
    }

    .btn-submit:hover {
      background: #e6c200;
    }

    .btn-submit:disabled {
      background: #666;
      cursor: not-allowed;
    }

    /* Thank You Message */
    .thank-you-view {
      display: none;
      text-align: center;
      padding: 20px 0;
    }

    .thank-you-view.active {
      display: block;
    }

    .thank-you-view .thank-icon {
      font-size: 50px;
      margin-bottom: 15px;
    }

    .thank-you-view h3 {
      color: #ffd700;
      font-size: 24px;
      margin-bottom: 10px;
    }

    .thank-you-view p {
      color: #ccc;
      font-size: 16px;
      margin-bottom: 20px;
    }

    .thank-you-view .btn-ok {
      background: #ffd700;
      color: #000;
      padding: 10px 40px;
      border: none;
      border-radius: 6px;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.2s;
    }

    .thank-you-view .btn-ok:hover {
      background: #e6c200;
    }

    .subscribe-form-view {
      display: block;
    }

    .subscribe-form-view.hidden {
      display: none;
    }

    .subscribe-error {
      color: #ff6b6b;
      font-size: 15px;
      text-align: center;
      margin-top: 10px;
      display: none;
    }

    .subscribe-error.active {
      display: block;
    }

    /* Navigation Row */
    .nav-row-wrapper {
      width: 100%;
      background: #000;
    }

    .nav-container {
      max-width: 1200px;
      width: 100%;
      margin: 0 auto;
      display: flex;
      justify-content: stretch;
      align-items: stretch;
      padding: 0;
    }

    .nav-link {
      flex: 1 1 20%;
      display: flex;
      justify-content: center;
      align-items: center;
      text-align: center;
    }

    .home-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      margin-right: 4px;
      vertical-align: middle;
    }

    .home-icon svg {
      width: 16px;
      height: 16px;
      fill: #fff;
    }

    .nav-link a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      white-space: nowrap;
      padding: 14px 20px;
      font-size: 14px;
      font-weight: 600;
      color: #fff;
      text-transform: uppercase;
      letter-spacing: 1px;
      border-bottom: 3px solid transparent;
      transition: all 0.2s;
    }

    .nav-link a:hover,
    .nav-link.active a {
      background: rgba(255,255,255,0.1);
      border-bottom-color: #ffd700;
    }

    /* Article Links Row */
    .article-row-wrapper {
      width: 100%;
      background: #1a1a1a;
      border-top: 1px solid #333;
    }

    .article-container {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
    }

    .article-link {
      flex: 1;
      text-align: center;
      border-right: 1px solid #333;
    }

    .article-link:last-child {
      border-right: none;
    }

    .article-link a {
      display: block;
      padding: 10px 15px;
      font-size: 12px;
      color: #ccc;
      transition: all 0.2s;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .article-link a:hover {
      background: rgba(255,255,255,0.05);
      color: #ffd700;
    }

    .article-link .article-category {
      color: #ffd700;
      font-weight: 600;
    }

    /* Main Content */
    .main-content {
      max-width: 1200px;
      margin: 0 auto;
      padding: 30px 20px;
      background: #fff;
    }

    .page-header {
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #ddd;
    }

    .page-title {
      font-family: 'Roboto Condensed', sans-serif;
      font-size: 36px;
      font-weight: 700;
      color: #333;
      margin-bottom: 10px;
    }

    .page-subtitle {
      font-size: 16px;
      color: #666;
    }

    /* Category Section */
    .category-section {
      margin-bottom: 40px;
    }

    .category-header {
      display: flex;
      align-items: center;
      gap: 15px;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #ffd700;
    }

    .category-title {
      font-family: 'Roboto Condensed', sans-serif;
      font-size: 24px;
      font-weight: 700;
      color: #333;
    }

    .category-count {
      background: #ffd700;
      color: #333;
      padding: 4px 12px;
      border-radius: 15px;
      font-size: 12px;
      font-weight: 600;
    }

    /* Article Grid */
    .article-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 25px;
    }

    .article-card {
      background: #fff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .article-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 4px 15px rgba(0,0,0,0.15);
    }

    .article-thumbnail {
      width: 100%;
      aspect-ratio: 16/10;
      object-fit: cover;
      display: block;
    }

    .article-info {
      padding: 15px;
    }

    .article-title {
      font-size: 14px;
      font-weight: 600;
      color: #333;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .article-card a:hover .article-title {
      color: #0066cc;
    }

    /* Footer */
    .site-footer {
      background: #1a1a1a;
      color: white;
      margin-top: 40px;
    }

    .footer-top {
      background: #ffd700;
      padding: 15px 0;
    }

    .footer-brands {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 20px;
      display: flex;
      justify-content: center;
      gap: 30px;
    }

    .footer-brand-item {
      font-size: 16px;
      font-weight: 700;
      color: #333;
    }

    .footer-main {
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 20px;
    }

    .footer-grid {
      display: grid;
      grid-template-columns: 2fr repeat(3, 1fr);
      gap: 40px;
      margin-bottom: 30px;
    }

    .footer-about h3 {
      font-size: 26px;
      font-weight: 700;
      color: #ffd700;
      margin-bottom: 15px;
    }

    .footer-about p {
      font-size: 15px;
      color: #999;
      line-height: 1.6;
    }

    .footer-col h4 {
      font-size: 15px;
      font-weight: 700;
      text-transform: uppercase;
      color: #ffd700;
      margin-bottom: 15px;
    }

    .footer-col ul {
      list-style: none;
    }

    .footer-col li {
      margin-bottom: 8px;
    }

    .footer-col a {
      font-size: 15px;
      color: #999;
      transition: color 0.2s;
    }

    .footer-col a:hover {
      color: white;
    }

    .footer-bottom {
      border-top: 1px solid #333;
      padding-top: 20px;
      text-align: center;
      font-size: 14px;
      color: #666;
    }

    .footer-links {
      display: flex;
      justify-content: center;
      gap: 20px;
      margin-bottom: 10px;
    }

    .footer-links a {
      color: #999;
    }

    .footer-links a:hover {
      color: white;
    }

    /* JubileeVerse Pulse Circle */
    .jv-pulse-circle {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: white;
      margin-right: 6px;
      vertical-align: middle;
      animation: jvPulse 2s ease-in-out infinite;
    }

    @keyframes jvPulse {
      0%, 100% {
        background: white;
        box-shadow: 0 0 4px rgba(255, 255, 255, 0.5);
      }
      50% {
        background: #87CEEB;
        box-shadow: 0 0 8px rgba(135, 206, 235, 0.8);
      }
    }

    /* Responsive */
    @media (max-width: 1024px) {
      .article-grid {
        grid-template-columns: repeat(3, 1fr);
      }

      .header-table {
        width: 100%;
      }
    }

    @media (max-width: 768px) {
      .article-grid {
        grid-template-columns: repeat(2, 1fr);
      }

      .header-title {
        font-size: 32px;
      }

      .nav-link a {
        padding: 10px 12px;
        font-size: 12px;
      }

      .page-title {
        font-size: 28px;
      }

      .article-container {
        flex-direction: column;
      }

      .article-link {
        border-right: none;
        border-bottom: 1px solid #333;
      }

      .article-link:last-child {
        border-bottom: none;
      }

      .footer-grid {
        grid-template-columns: 1fr;
      }

      .footer-brands {
        flex-wrap: wrap;
        gap: 15px;
      }

      .footer-links {
        flex-wrap: wrap;
        gap: 10px;
      }
    }

    @media (max-width: 480px) {
      .article-grid {
        grid-template-columns: 1fr;
      }

      .header-actions {
        flex-direction: column;
        gap: 8px;
      }

      .search-box {
        display: none;
      }

      .nav-container {
        flex-wrap: wrap;
      }

      .nav-link {
        flex: 1 1 50%;
      }
    }
  </style>
</head>
<body>
  <!-- Header Table (fixed width matching page content) -->
  <header role="banner">
  <div class="header-table-wrapper">
    <table class="header-table">
      <tr class="header-row">
        <td>
          <div class="header-content">
            <div class="header-brand">
              <h1 class="header-title"><a href="index.html">${siteName.toUpperCase()}</a></h1>
            </div>
            <div class="header-actions">
              <form class="search-box" role="search" aria-label="Site search">
                <label for="site-search" class="visually-hidden">Search articles</label>
                <input type="search" id="site-search" name="q" placeholder="Search..." aria-label="Search articles">
                <button type="submit" aria-label="Submit search"><span aria-hidden="true">&#128269;</span></button>
              </form>
              <button class="btn-subscribe" id="subscribe-btn" aria-label="Subscribe to newsletter">Subscribe Now!</button>
            </div>
          </div>
        </td>
      </tr>
    </table>
  </div>
  </header>

  <!-- Navigation -->
  <nav class="nav-row-wrapper" aria-label="Main navigation">
    <div class="nav-container">
${navLinks}
    </div>
  </nav>

  <!-- Article Links Row -->
  <nav class="article-row-wrapper" aria-label="Quick article links">
    <div class="article-container">
${articleLinksRow}
    </div>
  </nav>

  <!-- Main Content -->
  <main class="main-content">
    <header class="page-header">
      <h1 class="page-title">Sitemap</h1>
      <p class="page-subtitle">Browse our complete archive of ${totalArticles} faith-based articles. Find inspiration, guidance, and biblical wisdom for your spiritual journey.</p>
    </header>

${categorySections}

  </main>

  <!-- Footer -->
  <footer class="site-footer" role="contentinfo">
    <div class="footer-top">
      <div class="footer-brands">
${categories.map(cat => `        <span class="footer-brand-item">${cat.name}</span>`).join('\n')}
      </div>
    </div>
    <div class="footer-main">
      <div class="footer-grid">
        <div class="footer-about">
          <h3>${siteName}</h3>
          <p>${siteName} is your trusted source for quality content, expert insights, and the latest updates. Our team of dedicated writers brings you comprehensive coverage across multiple categories.</p>
        </div>
        <div class="footer-col">
          <h4>Categories</h4>
          <ul>
${categories.map(cat => `            <li><a href="index.html#category/${cat.slug}">${cat.name}</a></li>`).join('\n')}
          </ul>
        </div>
        <div class="footer-col">
          <h4>Resources</h4>
          <ul>
            <li><a href="#">About Us</a></li>
            <li><a href="#">Contact</a></li>
            <li><a href="#">Advertise</a></li>
            <li><a href="#">Careers</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Legal</h4>
          <ul>
            <li><a href="#">Privacy Policy</a></li>
            <li><a href="#">Terms of Use</a></li>
            <li><a href="#">Cookie Policy</a></li>
            <li><a href="sitemap.html">Sitemap</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <div class="footer-links">
${categories.map((cat, i) => `          <a href="index.html#category/${cat.slug}">${cat.name}</a>${i < categories.length - 1 ? ' |' : ''}`).join('\n')}
        </div>
        <p>Copyright &copy; <span id="copyright-year">${currentYear}</span> ${siteName}. All Rights Reserved. | <a href="sitemap.html">Sitemap</a> | <a href="#">Terms of Use</a> | <a href="#">Privacy Policy</a></p>
        <p style="margin-top: 5px;">Powered by <span class="jv-pulse-circle"></span><a href="https://jubileeverse.com" style="color: #999;">JubileeVerse.com</a></p>
      </div>
    </div>
  </footer>

  <!-- Subscribe Modal -->
  <div class="modal-overlay" id="subscribe-modal">
    <div class="modal-content">
      <!-- Form View -->
      <div class="subscribe-form-view" id="form-view">
        <div class="modal-header">
          <div class="modal-title-wrap">
            <h2>Subscribe</h2>
            <p class="modal-subtitle">Join our faith community and receive weekly inspiration, biblical teachings, and prayer guides directly in your inbox.</p>
          </div>
        </div>
        <div class="modal-body">
          <form class="subscribe-form" id="subscribe-form">
            <input type="text" id="subscribe-name" placeholder="Full Name" required>
            <input type="email" id="subscribe-email" placeholder="Email Address" required>
            <div class="subscribe-error" id="subscribe-error"></div>
            <div class="modal-buttons">
              <button type="button" class="btn-cancel" id="btn-cancel">Cancel</button>
              <button type="submit" class="btn-submit" id="subscribe-submit">Subscribe</button>
            </div>
          </form>
        </div>
      </div>
      <!-- Thank You View -->
      <div class="thank-you-view" id="thank-you-view">
        <div class="thank-icon">&#10004;</div>
        <h3>Thank You for Subscribing!</h3>
        <p>God bless you! You'll receive our first newsletter soon.</p>
        <button class="btn-ok" id="btn-ok">OK</button>
      </div>
    </div>
  </div>

  <!-- Subscribe Modal Script -->
  <script>
    (function() {
      const subscribeBtn = document.getElementById('subscribe-btn');
      const modal = document.getElementById('subscribe-modal');
      const cancelBtn = document.getElementById('btn-cancel');
      const okBtn = document.getElementById('btn-ok');
      const subscribeForm = document.getElementById('subscribe-form');
      const formView = document.getElementById('form-view');
      const thankYouView = document.getElementById('thank-you-view');
      const subscribeError = document.getElementById('subscribe-error');

      function openModal() {
        modal.classList.add('active');
        formView.classList.remove('hidden');
        thankYouView.classList.remove('active');
        subscribeError.classList.remove('active');
        document.getElementById('subscribe-name').value = '';
        document.getElementById('subscribe-email').value = '';
      }

      function closeModal() {
        modal.classList.remove('active');
      }

      subscribeBtn.addEventListener('click', openModal);
      cancelBtn.addEventListener('click', closeModal);
      okBtn.addEventListener('click', closeModal);

      modal.addEventListener('click', function(e) {
        if (e.target === modal) {
          closeModal();
        }
      });

      subscribeForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const name = document.getElementById('subscribe-name').value.trim();
        const email = document.getElementById('subscribe-email').value.trim();

        if (!name || !email) {
          subscribeError.textContent = 'Please fill in all fields.';
          subscribeError.classList.add('active');
          return;
        }

        if (!email.includes('@')) {
          subscribeError.textContent = 'Please enter a valid email address.';
          subscribeError.classList.add('active');
          return;
        }

        // Show thank you view
        formView.classList.add('hidden');
        thankYouView.classList.add('active');
      });

      // Close on escape key
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
          closeModal();
        }
      });
    })();

    // Dynamic copyright year
    (function() {
      const yearEl = document.getElementById('copyright-year');
      if (yearEl) {
        yearEl.textContent = new Date().getFullYear();
      }
    })();
  </script>

</body>
</html>`;
}

/**
 * Main execution
 */
async function main() {
  const domain = process.argv[2];

  if (!domain) {
    console.error('Usage: node scripts/generateMorePage.js <domain>');
    console.error('Example: node scripts/generateMorePage.js GodsGrace.com');
    process.exit(1);
  }

  const websitePath = path.join(WEBSITES_PATH, domain);

  try {
    // Check if website exists
    await fs.access(websitePath);
  } catch (err) {
    console.error(`Website not found: ${domain}`);
    console.error(`Expected path: ${websitePath}`);
    process.exit(1);
  }

  console.log(`Generating More page for ${domain}...`);

  // Get all articles organized by category
  const categories = await getAllArticles(websitePath);

  if (categories.length === 0) {
    console.error('No articles found for this website.');
    process.exit(1);
  }

  const totalArticles = categories.reduce((sum, cat) => sum + cat.articles.length, 0);
  console.log(`Found ${categories.length} categories with ${totalArticles} total articles.`);

  // Generate site name
  const siteName = formatSiteName(domain);

  // Generate the More page HTML
  const html = generateMorePageHtml(domain, siteName, categories);

  // Write the More page
  const outputPath = path.join(websitePath, 'sitemap.html');
  await fs.writeFile(outputPath, html, 'utf8');

  console.log(`More page generated successfully: ${outputPath}`);
  console.log(`Total articles: ${totalArticles}`);
  console.log(`Categories: ${categories.map(c => c.name).join(', ')}`);
}

main().catch(err => {
  console.error('Error generating More page:', err);
  process.exit(1);
});
