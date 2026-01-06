/**
 * generateDailyHistory.js
 *
 * Generates daily history JSON files for website content randomization.
 * Creates a new history file for each day with randomized article ordering
 * to provide fresh content arrangement on a daily basis.
 *
 * Usage: node scripts/generateDailyHistory.js [domain]
 * Example: node scripts/generateDailyHistory.js GodsGrace.com
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const DATASTORE_PATH = path.join(__dirname, '..', '.datastore', 'websites');

// Category order (matches homepage)
const CATEGORY_ORDER = [
  'divine-inspirations',
  'prayer-worship',
  'biblical-teachings',
  'family-relationships',
  'christian-living'
];

/**
 * Seeded random number generator for reproducible shuffling
 * Uses the date as seed to ensure same results for same day
 */
function seededRandom(seed) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

/**
 * Shuffle array using Fisher-Yates algorithm with seeded random
 */
function shuffleWithSeed(array, seed) {
  const shuffled = [...array];
  let currentSeed = seed;

  for (let i = shuffled.length - 1; i > 0; i--) {
    currentSeed++;
    const j = Math.floor(seededRandom(currentSeed) * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

/**
 * Get random items from array using seeded random
 */
function getRandomItems(array, count, seed) {
  const shuffled = shuffleWithSeed(array, seed);
  return shuffled.slice(0, count);
}

/**
 * Get a single random item from array using seeded random
 */
function getRandomItem(array, seed) {
  const index = Math.floor(seededRandom(seed) * array.length);
  return array[index];
}

/**
 * Generate the history filename for a given date
 */
function getHistoryFilename(date) {
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}${day}.json`;
}

/**
 * Get build seed - uses current timestamp for true randomness
 * Each regeneration will produce different results
 */
function getBuildSeed() {
  return Date.now();
}

/**
 * Load articles from a category's web_articles.json
 */
function loadCategoryArticles(domainPath, categorySlug) {
  const articlesPath = path.join(domainPath, categorySlug, 'web_articles.json');

  if (!fs.existsSync(articlesPath)) {
    console.warn(`Warning: Articles file not found for category ${categorySlug}`);
    return [];
  }

  try {
    const data = JSON.parse(fs.readFileSync(articlesPath, 'utf8'));
    return data.articles || [];
  } catch (error) {
    console.error(`Error loading articles for ${categorySlug}:`, error.message);
    return [];
  }
}

/**
 * Load categories from web_categories.json
 */
function loadCategories(domainPath) {
  const categoriesPath = path.join(domainPath, '.webstore', 'web_categories.json');

  if (!fs.existsSync(categoriesPath)) {
    throw new Error('Categories file not found');
  }

  const data = JSON.parse(fs.readFileSync(categoriesPath, 'utf8'));
  return data.categories || [];
}

/**
 * Load site config from web_config.json
 */
function loadConfig(domainPath) {
  const configPath = path.join(domainPath, '.webstore', 'web_config.json');

  if (!fs.existsSync(configPath)) {
    throw new Error('Config file not found');
  }

  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

/**
 * Load theme from web_theme.json
 */
function loadTheme(domainPath) {
  const themePath = path.join(domainPath, '.webstore', 'web_theme.json');

  if (!fs.existsSync(themePath)) {
    return { siteName: '', siteTagline: '' };
  }

  try {
    return JSON.parse(fs.readFileSync(themePath, 'utf8'));
  } catch {
    return { siteName: '', siteTagline: '' };
  }
}

/**
 * Generate daily history file for a domain
 */
function generateDailyHistory(domain, targetDate = new Date()) {
  const domainPath = path.join(DATASTORE_PATH, domain);

  if (!fs.existsSync(domainPath)) {
    throw new Error(`Domain path not found: ${domainPath}`);
  }

  // Load configuration
  const config = loadConfig(domainPath);
  const theme = loadTheme(domainPath);
  const categories = loadCategories(domainPath);

  // Sort categories by CATEGORY_ORDER
  const sortedCategories = [...categories].sort((a, b) => {
    const indexA = CATEGORY_ORDER.indexOf(a.slug);
    const indexB = CATEGORY_ORDER.indexOf(b.slug);
    if (indexA === -1 && indexB === -1) return 0;
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  // Load all articles by category
  const articlesByCategory = {};
  const allArticles = [];

  for (const category of sortedCategories) {
    const articles = loadCategoryArticles(domainPath, category.slug);
    articlesByCategory[category.slug] = articles;

    for (const article of articles) {
      allArticles.push({
        articleId: article.id,
        title: article.title,
        slug: article.slug,
        categorySlug: category.slug,
        categoryName: category.name,
        excerpt: article.content ? article.content.substring(0, 100) + '...' : '',
        image: `images/${article.id}.jpg`
      });
    }
  }

  // Generate seed from date
  const buildSeed = getBuildSeed();
  const dateStr = targetDate.toISOString().split('T')[0];

  // Build hero carousel (3 random articles from the FIRST category only)
  // This makes the homepage look unique every day
  const heroCarousel = [];
  let seedOffset = 0;

  // Get the first category (homepage category)
  const firstCategory = sortedCategories[0];
  if (firstCategory) {
    const categoryArticles = articlesByCategory[firstCategory.slug];
    if (categoryArticles.length > 0) {
      // Get 3 random articles from the first category
      const shuffledArticles = shuffleWithSeed(categoryArticles, buildSeed + seedOffset);
      const heroArticles = shuffledArticles.slice(0, 3);

      for (const article of heroArticles) {
        heroCarousel.push({
          categorySlug: firstCategory.slug,
          categoryName: firstCategory.name,
          articleId: article.id,
          title: article.title,
          slug: article.slug,
          excerpt: article.content ? article.content.substring(0, 80) + '...' : '',
          image: `images/${article.id}.jpg`
        });
      }
    }
  }

  // Build home featured articles (8 articles from first category, excluding hero carousel)
  // These are the articles shown in the Featured section on homepage
  const homeFeatured = [];
  seedOffset = 500;

  if (firstCategory) {
    const categoryArticles = articlesByCategory[firstCategory.slug];
    if (categoryArticles.length > 0) {
      // Get hero article IDs to exclude
      const heroArticleIds = heroCarousel.map(a => a.articleId);

      // Filter out hero articles and shuffle the rest
      const remainingArticles = categoryArticles.filter(a => !heroArticleIds.includes(a.id));
      const shuffledRemaining = shuffleWithSeed(remainingArticles, buildSeed + seedOffset);

      // Take up to 8 articles for featured section
      const featuredCount = Math.min(8, shuffledRemaining.length);
      for (let i = 0; i < featuredCount; i++) {
        const article = shuffledRemaining[i];
        homeFeatured.push({
          articleId: article.id,
          title: article.title,
          slug: article.slug,
          categorySlug: firstCategory.slug,
          categoryName: firstCategory.name,
          excerpt: article.content ? article.content.substring(0, 100) + '...' : '',
          image: `images/${article.id}.jpg`
        });
      }
    }
  }

  // Build home spotlight section (for homepage)
  // Business Rule: Main spotlight article must be unique (not in hero or featured)
  // The 12th article (index 11) after shuffling: 0-2 hero, 3-10 featured, 11 = spotlight main
  // The 2 list items can be any articles (duplicates allowed)
  let homeSpotlight = null;
  seedOffset = 600;

  if (firstCategory) {
    const categoryArticles = articlesByCategory[firstCategory.slug];
    if (categoryArticles.length >= 12) {
      // Get hero and featured article IDs to exclude for main spotlight
      const heroArticleIds = heroCarousel.map(a => a.articleId);
      const featuredArticleIds = homeFeatured.map(a => a.articleId);
      const usedIds = [...heroArticleIds, ...featuredArticleIds];

      // Filter out used articles and get the spotlight main
      const remainingForSpotlight = categoryArticles.filter(a => !usedIds.includes(a.id));
      const shuffledSpotlight = shuffleWithSeed(remainingForSpotlight, buildSeed + seedOffset);

      if (shuffledSpotlight.length > 0) {
        const mainArticle = shuffledSpotlight[0];

        // For list items, we can use any articles (shuffled differently)
        const listShuffle = shuffleWithSeed(categoryArticles, buildSeed + seedOffset + 50);
        const listItems = listShuffle.slice(0, 2);

        // Get articles from OTHER categories for Related Information and Recommended
        // Business Rule: These sections show content from categories OTHER than the current one
        const otherCategoryArticles = [];
        for (const otherCat of sortedCategories) {
          if (otherCat.slug !== firstCategory.slug) {
            const otherArticles = articlesByCategory[otherCat.slug] || [];
            for (const article of otherArticles) {
              otherCategoryArticles.push({
                articleId: article.id,
                title: article.title,
                slug: article.slug,
                categorySlug: otherCat.slug,
                categoryName: otherCat.name,
                excerpt: article.content ? article.content.substring(0, 100) + '...' : '',
                image: `images/${article.id}.jpg`
              });
            }
          }
        }

        // Shuffle other category articles for random selection
        const shuffledOtherArticles = shuffleWithSeed(otherCategoryArticles, buildSeed + seedOffset + 100);

        // Related Information: 4 random articles from other categories
        const relatedInfo = shuffledOtherArticles.slice(0, 4);

        // Recommended: 10 random articles from other categories
        const recommended = shuffledOtherArticles.slice(4, 14);

        // Sidebar sections: Most Popular, Must Read, You Might Like
        // All from OTHER categories, using different shuffle offsets for variety
        const sidebarShuffle1 = shuffleWithSeed(otherCategoryArticles, buildSeed + seedOffset + 200);
        const sidebarShuffle2 = shuffleWithSeed(otherCategoryArticles, buildSeed + seedOffset + 300);
        const sidebarShuffle3 = shuffleWithSeed(otherCategoryArticles, buildSeed + seedOffset + 400);

        // Most Popular: 7 random articles from other categories
        const mostPopular = sidebarShuffle1.slice(0, 7);

        // Must Read: 7 random articles from other categories
        const mustRead = sidebarShuffle2.slice(0, 7);

        // You Might Like: 5 random articles from other categories
        const youMightLike = sidebarShuffle3.slice(0, 5);

        homeSpotlight = {
          main: {
            articleId: mainArticle.id,
            title: mainArticle.title,
            slug: mainArticle.slug,
            categorySlug: firstCategory.slug,
            categoryName: firstCategory.name,
            excerpt: mainArticle.content ? mainArticle.content.substring(0, 150) + '...' : '',
            image: `images/${mainArticle.id}.jpg`
          },
          list: listItems.map(article => ({
            articleId: article.id,
            title: article.title,
            slug: article.slug,
            categorySlug: firstCategory.slug,
            categoryName: firstCategory.name,
            image: `images/${article.id}.jpg`
          })),
          relatedInfo: relatedInfo,
          recommended: recommended,
          mostPopular: mostPopular,
          mustRead: mustRead,
          youMightLike: youMightLike
        };
      }
    }
  }

  // Build featured articles per category (for category portal pages)
  // Each category gets its own set: 3 hero + 8 featured + 1 unique spotlight main
  // Business Rule: 12 unique articles per category page (3 hero + 8 featured + 1 spotlight main)
  const featuredArticles = {};
  seedOffset = 1000;

  for (const category of sortedCategories) {
    const categoryArticles = articlesByCategory[category.slug];
    if (categoryArticles.length > 0) {
      const shuffled = shuffleWithSeed(categoryArticles, buildSeed + seedOffset);

      // First 3 are hero carousel for this category
      const heroArticles = shuffled.slice(0, 3).map(article => ({
        articleId: article.id,
        title: article.title,
        slug: article.slug,
        excerpt: article.content ? article.content.substring(0, 80) + '...' : '',
        image: `images/${article.id}.jpg`
      }));

      // Next 8 are featured (indices 3-10)
      const featuredList = shuffled.slice(3, 11).map(article => ({
        articleId: article.id,
        title: article.title,
        slug: article.slug,
        excerpt: article.content ? article.content.substring(0, 100) + '...' : '',
        image: `images/${article.id}.jpg`
      }));

      // 12th article (index 11) is the unique spotlight main
      // List items can be any articles (shuffled differently for variety)
      let spotlight = null;
      if (shuffled.length >= 12) {
        const spotlightMain = shuffled[11];
        const listShuffle = shuffleWithSeed(categoryArticles, buildSeed + seedOffset + 50);
        const listItems = listShuffle.slice(0, 2);

        spotlight = {
          main: {
            articleId: spotlightMain.id,
            title: spotlightMain.title,
            slug: spotlightMain.slug,
            excerpt: spotlightMain.content ? spotlightMain.content.substring(0, 150) + '...' : '',
            image: `images/${spotlightMain.id}.jpg`
          },
          list: listItems.map(article => ({
            articleId: article.id,
            title: article.title,
            slug: article.slug,
            image: `images/${article.id}.jpg`
          }))
        };
      }

      // Get articles from OTHER categories for Related Information and Recommended
      // Business Rule: These sections show content from categories OTHER than the current one
      const otherCategoryArticles = [];
      for (const otherCat of sortedCategories) {
        if (otherCat.slug !== category.slug) {
          const otherArticles = articlesByCategory[otherCat.slug] || [];
          for (const article of otherArticles) {
            otherCategoryArticles.push({
              articleId: article.id,
              title: article.title,
              slug: article.slug,
              categorySlug: otherCat.slug,
              categoryName: otherCat.name,
              excerpt: article.content ? article.content.substring(0, 100) + '...' : '',
              image: `images/${article.id}.jpg`
            });
          }
        }
      }

      // Shuffle other category articles for random selection
      const shuffledOtherArticles = shuffleWithSeed(otherCategoryArticles, buildSeed + seedOffset + 100);

      // Related Information: 4 random articles from other categories
      const relatedInfo = shuffledOtherArticles.slice(0, 4);

      // Recommended: 10 random articles from other categories
      const recommended = shuffledOtherArticles.slice(4, 14);

      // Sidebar sections: Most Popular, Must Read, You Might Like
      // All from OTHER categories, using different shuffle offsets for variety
      const sidebarShuffle1 = shuffleWithSeed(otherCategoryArticles, buildSeed + seedOffset + 200);
      const sidebarShuffle2 = shuffleWithSeed(otherCategoryArticles, buildSeed + seedOffset + 300);
      const sidebarShuffle3 = shuffleWithSeed(otherCategoryArticles, buildSeed + seedOffset + 400);

      // Most Popular: 7 random articles from other categories
      const mostPopular = sidebarShuffle1.slice(0, 7);

      // Must Read: 7 random articles from other categories
      const mustRead = sidebarShuffle2.slice(0, 7);

      // You Might Like: 5 random articles from other categories
      const youMightLike = sidebarShuffle3.slice(0, 5);

      featuredArticles[category.slug] = {
        hero: heroArticles,
        featured: featuredList,
        spotlight: spotlight,
        relatedInfo: relatedInfo,
        recommended: recommended,
        mostPopular: mostPopular,
        mustRead: mustRead,
        youMightLike: youMightLike
      };

      seedOffset += 100;
    }
  }

  // Build spotlight article (random from all - legacy, kept for backwards compatibility)
  seedOffset = 2000;
  const spotlightArticle = getRandomItem(allArticles, buildSeed + seedOffset);

  // Build popular articles (5 random from all)
  seedOffset = 3000;
  const popularArticles = getRandomItems(allArticles, 5, buildSeed + seedOffset).map(article => ({
    articleId: article.articleId,
    title: article.title,
    categorySlug: article.categorySlug
  }));

  // Build read next articles (3 random from all)
  seedOffset = 4000;
  const readNextArticles = getRandomItems(allArticles, 3, buildSeed + seedOffset).map(article => ({
    articleId: article.articleId,
    title: article.title,
    slug: article.slug,
    excerpt: article.excerpt,
    image: article.image
  }));

  // Build allArticles list
  const formattedAllArticles = allArticles.map(article => ({
    articleId: article.articleId,
    title: article.title,
    slug: article.slug,
    categorySlug: article.categorySlug,
    categoryName: article.categoryName
  }));

  // Build article data paths
  const articleDataPaths = {};
  for (const category of sortedCategories) {
    articleDataPaths[category.slug] = `${category.slug}/web_articles.json`;
  }

  // Build portal pages (shuffled articles per category)
  const portalPages = {};
  seedOffset = 5000;

  for (const category of sortedCategories) {
    const categoryArticles = articlesByCategory[category.slug];
    if (categoryArticles.length > 0) {
      const shuffled = shuffleWithSeed(categoryArticles, buildSeed + seedOffset);

      portalPages[category.slug] = {
        categoryName: category.name,
        categorySlug: category.slug,
        description: category.description,
        headerImage: `images/${shuffled[0].id}.jpg`,
        buildSeed: buildSeed,
        articles: shuffled.map(article => ({
          articleId: article.id,
          title: article.title,
          slug: article.slug,
          excerpt: article.content ? article.content.substring(0, 80) + '...' : '',
          image: `images/${article.id}.jpg`
        }))
      };

      seedOffset += 100;
    }
  }

  // Build final history object
  const history = {
    buildDate: dateStr,
    buildTimestamp: targetDate.toISOString(),
    domain: config.domain,
    siteCode: config.siteCode,
    siteName: theme.siteName || "God's Grace",
    siteTagline: theme.siteTagline || 'Faith, Hope, and Divine Inspiration',
    categories: sortedCategories.map(cat => ({
      name: cat.name,
      slug: cat.slug,
      articleCount: cat.articleCount
    })),
    heroCarousel,
    homeFeatured,
    homeSpotlight,
    featuredArticles,
    spotlightArticle: {
      articleId: spotlightArticle.articleId,
      title: spotlightArticle.title,
      slug: spotlightArticle.slug,
      categorySlug: spotlightArticle.categorySlug,
      categoryName: spotlightArticle.categoryName,
      excerpt: spotlightArticle.excerpt,
      image: spotlightArticle.image
    },
    popularArticles,
    readNextArticles,
    allArticles: formattedAllArticles,
    articleDataPaths,
    portalPages
  };

  // Ensure history directory exists
  const historyDir = path.join(domainPath, '.webstore', 'history');
  if (!fs.existsSync(historyDir)) {
    fs.mkdirSync(historyDir, { recursive: true });
  }

  // Write history file
  const filename = getHistoryFilename(targetDate);
  const filePath = path.join(historyDir, filename);

  fs.writeFileSync(filePath, JSON.stringify(history, null, 2), 'utf8');

  console.log(`Generated history file: ${filename}`);
  console.log(`  - ${heroCarousel.length} hero carousel items`);
  console.log(`  - ${Object.keys(featuredArticles).length} category featured sections`);
  console.log(`  - ${popularArticles.length} popular articles`);
  console.log(`  - ${readNextArticles.length} read next articles`);
  console.log(`  - ${formattedAllArticles.length} total articles`);

  return filePath;
}

/**
 * Check if today's history file exists, generate if not
 */
function ensureTodayHistory(domain) {
  const today = new Date();
  const domainPath = path.join(DATASTORE_PATH, domain);
  const historyDir = path.join(domainPath, '.webstore', 'history');
  const filename = getHistoryFilename(today);
  const filePath = path.join(historyDir, filename);

  if (fs.existsSync(filePath)) {
    console.log(`Today's history file already exists: ${filename}`);
    return filePath;
  }

  console.log(`Generating today's history file...`);
  return generateDailyHistory(domain, today);
}

// Export functions for use in other scripts
export {
  generateDailyHistory,
  ensureTodayHistory,
  getHistoryFilename,
  getBuildSeed
};

// CLI execution
const args = process.argv.slice(2);
if (args.length > 0 || process.argv[1]?.includes('generateDailyHistory')) {
  const domain = args[0] || 'GodsGrace.com';
  const forceRegenerate = args.includes('--force') || args.includes('-f');

  console.log(`\nDaily History Generator`);
  console.log(`=======================`);
  console.log(`Domain: ${domain}`);
  console.log(`Date: ${new Date().toISOString().split('T')[0]}`);
  if (forceRegenerate) {
    console.log(`Mode: Force regenerate`);
  }
  console.log('');

  try {
    let filePath;
    if (forceRegenerate) {
      filePath = generateDailyHistory(domain, new Date());
    } else {
      filePath = ensureTodayHistory(domain);
    }
    console.log(`\nSuccess! History file: ${filePath}`);
  } catch (error) {
    console.error(`\nError: ${error.message}`);
    process.exit(1);
  }
}
