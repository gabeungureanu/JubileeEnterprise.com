/**
 * Add Category Script for GodsGrace.com
 *
 * This script creates a new category with 12 articles, generates content,
 * creates images, and updates all required JSON files.
 *
 * Usage: node add_category.js
 *
 * Environment Variables:
 * - OPENAI_API_KEY or OPENAI_API_KEY_BACKUP: For image generation
 * - ANTHROPIC_API_KEY: For content generation
 * - DATASTORE_PATH (optional): Custom datastore path
 *
 * Business Rules:
 * - No duplicate article IDs within a single portal page (per category)
 * - Each article should have unique 12-character alphanumeric ID
 * - Strip markdown (* and #) from displayed content in frontend
 */

import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

dotenv.config();

// Configuration
const DATASTORE_BASE = process.env.DATASTORE_PATH || path.join(process.cwd(), '.datastore');
const SITE_PATH = path.join(DATASTORE_BASE, 'websites', 'GodsGrace.com');
const openaiApiKey = process.env.OPENAI_API_KEY_BACKUP || process.env.OPENAI_API_KEY;

// New Category Definition
const NEW_CATEGORY = {
  rank: 5,
  name: "Christian Living",
  slug: "christian-living",
  description: "Practical guidance for living out your faith in everyday life. Explore topics like work-life balance, financial stewardship, handling stress, making ethical decisions, and finding purpose in your daily routines. This category bridges Sunday faith with Monday reality, helping believers walk authentically with Christ in every area of life.",
  keywords: [
    "practical faith",
    "Christian lifestyle",
    "daily devotion",
    "faith at work",
    "biblical stewardship"
  ],
  articleCount: 12,
  folderPath: "/christian-living"
};

// Article titles with assigned writers (matched to their expertise)
const ARTICLES = [
  {
    title: "Faith at Work: Honoring God in Your Career",
    writerId: "ETDt7sRfd78E",
    writerName: "Zev Inspire",
    keywords: ["faith at work", "Christian career", "workplace ministry"]
  },
  {
    title: "Biblical Financial Stewardship: Managing Money God's Way",
    writerId: "sFCDRxbd4fnj",
    writerName: "Eliana Inspire",
    keywords: ["biblical finances", "stewardship", "money management"]
  },
  {
    title: "Finding Peace in Anxious Times: A Christian Perspective",
    writerId: "iHAV4x4QMoKP",
    writerName: "Tahoma Inspire",
    keywords: ["Christian anxiety", "peace of God", "mental health faith"]
  },
  {
    title: "Digital Discipleship: Using Technology for God's Glory",
    writerId: "kzixebHo5TNF",
    writerName: "Amir Inspire",
    keywords: ["digital faith", "technology ministry", "online discipleship"]
  },
  {
    title: "The Christian's Guide to Rest and Sabbath",
    writerId: "pcyzL5zS3gsE",
    writerName: "Nova Inspire",
    keywords: ["sabbath rest", "Christian rest", "spiritual renewal"]
  },
  {
    title: "Making Ethical Decisions in a Complex World",
    writerId: "iyGstLVYICTV",
    writerName: "Elias Inspire",
    keywords: ["Christian ethics", "moral decisions", "biblical wisdom"]
  },
  {
    title: "Overcoming Comparison: Finding Contentment in Christ",
    writerId: "8YZ0aNGgrd6f",
    writerName: "Jubilee Inspire",
    keywords: ["Christian contentment", "overcoming comparison", "identity in Christ"]
  },
  {
    title: "Hospitality as Ministry: Opening Your Home and Heart",
    writerId: "gK44D5gaPKV9",
    writerName: "Caleb Inspire",
    keywords: ["Christian hospitality", "ministry home", "welcoming others"]
  },
  {
    title: "Developing Daily Spiritual Habits That Last",
    writerId: "qOVJkQjAwOpw",
    writerName: "Zariah Inspire",
    keywords: ["spiritual habits", "daily devotion", "faith disciplines"]
  },
  {
    title: "Handling Criticism with Grace and Wisdom",
    writerId: "WkGIwqu5107H",
    writerName: "Imani Inspire",
    keywords: ["handling criticism", "Christian response", "graceful living"]
  },
  {
    title: "Serving Others: Practical Ways to Live Out Your Faith",
    writerId: "xeOCblfCgOUp",
    writerName: "Santiago Inspire",
    keywords: ["Christian service", "practical faith", "serving others"]
  },
  {
    title: "Redeeming Your Time: Priorities for the Busy Believer",
    writerId: "sdgeLNUcnjzY",
    writerName: "Melody Inspire",
    keywords: ["time management", "Christian priorities", "busy believer"]
  }
];

// Generate unique 12-character ID
function generateId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Generate slug from title
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

// Generate article content using Claude
async function generateArticleContent(article, categoryName) {
  const anthropic = new Anthropic();

  const prompt = `Write a comprehensive, faith-based article for a Christian website called GodsGrace.com.

Article Title: "${article.title}"
Category: ${categoryName}
Writer: ${article.writerName}
Keywords: ${article.keywords.join(', ')}

Requirements:
- Write at least 1000 words (aim for 1200-1500 words)
- Include relevant Scripture references naturally woven throughout
- Write in a warm, encouraging, biblically-grounded tone
- Structure with clear sections/paragraphs (but don't use headers)
- Make it practical and applicable to modern Christian families
- Include real-world examples and scenarios
- End with encouragement and hope
- Do NOT include the title in the content
- Do NOT use markdown formatting - write plain prose

Write the article now:`;

  console.log(`  Generating content for: ${article.title}`);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }]
  });

  return response.content[0].text;
}

// Generate image using OpenAI
async function generateArticleImage(article, categoryName, articleId) {
  const imagePrompt = `Create a professional, modern header image for a Faith-Based/Christian website article titled "${article.title}" in the category "${categoryName}". The image should be clean, inspiring, and suitable for a news/blog website header banner. No text in the image. Professional photography style. The image should evoke themes of family, love, relationships, faith, and Christian values. Warm, inviting colors. LANDSCAPE orientation.`;

  console.log(`  Generating image for: ${article.title}`);

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt: imagePrompt,
      n: 1,
      size: '1536x1024',
      quality: 'medium'
    })
  });

  const data = await response.json();

  if (data.data && data.data[0] && data.data[0].b64_json) {
    const imagesDir = path.join(SITE_PATH, 'images');
    await fs.mkdir(imagesDir, { recursive: true });

    const imagePath = path.join(imagesDir, `${articleId}.jpg`);
    const imageBuffer = Buffer.from(data.data[0].b64_json, 'base64');
    await fs.writeFile(imagePath, imageBuffer);

    console.log(`    Saved: images/${articleId}.jpg`);
    return `images/${articleId}.jpg`;
  } else {
    throw new Error(`Image generation failed: ${JSON.stringify(data)}`);
  }
}

// Update web_categories.json
async function updateCategoriesJson() {
  const filePath = path.join(SITE_PATH, '.webstore', 'web_categories.json');
  const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));

  // Check if category already exists
  const exists = data.categories.some(c => c.slug === NEW_CATEGORY.slug);
  if (!exists) {
    data.categories.push(NEW_CATEGORY);
    data.totalCategories = data.categories.length;
    data.generatedAt = new Date().toISOString();
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    console.log('Updated: web_categories.json');
  } else {
    console.log('Category already exists in web_categories.json');
  }
}

// Create category articles JSON
async function createArticlesJson(articles) {
  const categoryDir = path.join(SITE_PATH, NEW_CATEGORY.slug);
  await fs.mkdir(categoryDir, { recursive: true });

  const articlesData = {
    articles: articles
  };

  const filePath = path.join(categoryDir, 'web_articles.json');
  await fs.writeFile(filePath, JSON.stringify(articlesData, null, 2));
  console.log(`Created: ${NEW_CATEGORY.slug}/web_articles.json`);
}

// Update history JSON
async function updateHistoryJson(articles) {
  const today = new Date();
  const fileName = `${today.getFullYear().toString().slice(-2)}-${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}.json`;
  const filePath = path.join(SITE_PATH, '.webstore', 'history', fileName);

  let historyData;
  try {
    historyData = JSON.parse(await fs.readFile(filePath, 'utf-8'));
  } catch {
    console.log('History file not found, creating new one');
    historyData = {
      buildDate: today.toISOString().split('T')[0],
      buildTimestamp: today.toISOString(),
      domain: "GodsGrace.com",
      siteCode: "WEB-GODS-070312",
      siteName: "God's Grace",
      siteTagline: "Faith, Hope, and Divine Inspiration",
      categories: [],
      heroCarousel: [],
      featuredArticles: {},
      spotlightArticle: {},
      popularArticles: [],
      readNextArticles: [],
      allArticles: [],
      articleDataPaths: {},
      portalPages: {}
    };
  }

  // Add category to categories array
  const categoryEntry = {
    name: NEW_CATEGORY.name,
    slug: NEW_CATEGORY.slug,
    articleCount: 12
  };
  if (!historyData.categories.some(c => c.slug === NEW_CATEGORY.slug)) {
    historyData.categories.push(categoryEntry);
  }

  // Add to articleDataPaths
  historyData.articleDataPaths[NEW_CATEGORY.slug] = `${NEW_CATEGORY.slug}/web_articles.json`;

  // Add articles to allArticles
  const newAllArticles = articles.map(a => ({
    articleId: a.id,
    title: a.title,
    slug: a.slug,
    categorySlug: NEW_CATEGORY.slug,
    categoryName: NEW_CATEGORY.name
  }));
  historyData.allArticles = [...historyData.allArticles, ...newAllArticles];

  // Add featured articles for this category
  historyData.featuredArticles[NEW_CATEGORY.slug] = {
    main: {
      articleId: articles[0].id,
      title: articles[0].title,
      slug: articles[0].slug,
      excerpt: articles[0].content.substring(0, 120) + '...',
      image: `images/${articles[0].id}.jpg`
    },
    sidebar: articles.slice(1, 5).map(a => ({
      articleId: a.id,
      title: a.title,
      slug: a.slug
    }))
  };

  // Add hero carousel entry
  historyData.heroCarousel.push({
    categorySlug: NEW_CATEGORY.slug,
    categoryName: NEW_CATEGORY.name,
    articleId: articles[0].id,
    title: articles[0].title,
    slug: articles[0].slug,
    excerpt: articles[0].content.substring(0, 100) + '...',
    image: `images/${articles[0].id}.jpg`
  });

  // Add portal page
  // Business Rule: No duplicate article IDs within a single portal page
  const buildSeed = parseInt(fileName.split('-')[1]);
  const seenIds = new Set();
  const uniqueArticles = articles.filter(a => {
    if (seenIds.has(a.id)) return false;
    seenIds.add(a.id);
    return true;
  });

  historyData.portalPages[NEW_CATEGORY.slug] = {
    categoryName: NEW_CATEGORY.name,
    categorySlug: NEW_CATEGORY.slug,
    description: NEW_CATEGORY.description,
    headerImage: `images/${uniqueArticles[0].id}.jpg`,
    buildSeed: buildSeed,
    articles: uniqueArticles.map(a => ({
      articleId: a.id,
      title: a.title,
      slug: a.slug,
      excerpt: a.content.substring(0, 100) + '...',
      image: `images/${a.id}.jpg`
    }))
  };

  await fs.writeFile(filePath, JSON.stringify(historyData, null, 2));
  console.log(`Updated: .webstore/history/${fileName}`);
}

// Main execution
async function main() {
  console.log('========================================');
  console.log('Adding New Category: ' + NEW_CATEGORY.name);
  console.log('========================================\n');

  // Validate API keys
  if (!openaiApiKey) {
    console.error('ERROR: OPENAI_API_KEY not found');
    process.exit(1);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ERROR: ANTHROPIC_API_KEY not found');
    process.exit(1);
  }

  const generatedArticles = [];

  // Step 1: Generate content for all articles
  console.log('\nStep 1: Generating article content...\n');
  for (let i = 0; i < ARTICLES.length; i++) {
    const article = ARTICLES[i];
    const articleId = generateId();
    const slug = generateSlug(article.title);

    console.log(`[${i + 1}/${ARTICLES.length}] Processing: ${article.title}`);

    try {
      const content = await generateArticleContent(article, NEW_CATEGORY.name);

      generatedArticles.push({
        id: articleId,
        number: i + 1,
        title: article.title,
        slug: slug,
        content: content,
        category: NEW_CATEGORY.name,
        categorySlug: NEW_CATEGORY.slug,
        domain: "GodsGrace.com",
        writerId: article.writerId,
        writerName: article.writerName,
        keywords: article.keywords,
        hitCount: 0,
        createdAt: new Date().toISOString()
      });

      console.log(`    Content generated (${content.split(' ').length} words)\n`);

      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`    ERROR generating content: ${error.message}`);
    }
  }

  // Step 2: Generate images for all articles
  console.log('\n\nStep 2: Generating article images...\n');
  for (let i = 0; i < generatedArticles.length; i++) {
    const article = generatedArticles[i];
    console.log(`[${i + 1}/${generatedArticles.length}] Generating image...`);

    try {
      await generateArticleImage(
        { title: article.title, keywords: article.keywords },
        NEW_CATEGORY.name,
        article.id
      );

      // Delay between image generations
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`    ERROR generating image: ${error.message}`);
    }
  }

  // Step 3: Update all JSON files
  console.log('\n\nStep 3: Updating JSON files...\n');

  await updateCategoriesJson();
  await createArticlesJson(generatedArticles);
  await updateHistoryJson(generatedArticles);

  console.log('\n========================================');
  console.log('Category Addition Complete!');
  console.log('========================================');
  console.log(`Category: ${NEW_CATEGORY.name}`);
  console.log(`Articles: ${generatedArticles.length}`);
  console.log(`Slug: ${NEW_CATEGORY.slug}`);
  console.log('\nNext steps:');
  console.log('1. Review generated content in ' + NEW_CATEGORY.slug + '/web_articles.json');
  console.log('2. Check images in images/ folder');
  console.log('3. Refresh index.html to see new category');
}

main().catch(console.error);
