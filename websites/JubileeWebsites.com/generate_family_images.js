/**
 * Generate Images for Family & Relationships Category
 * Uses DALL-E 3 model
 */

import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();

const openaiApiKey = process.env.OPENAI_API_KEY_BACKUP || process.env.OPENAI_API_KEY;
const DATASTORE_BASE = process.env.DATASTORE_PATH || path.join(process.cwd(), '.datastore');
const SITE_PATH = path.join(DATASTORE_BASE, 'websites', 'GodsGrace.com');

// Read articles from the generated JSON
async function getArticles() {
  const filePath = path.join(SITE_PATH, 'family-relationships', 'web_articles.json');
  const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));
  return data.articles;
}

async function generateImage(article, index, total) {
  const imagePrompt = `Create a professional, modern header image for a Faith-Based/Christian website article titled "${article.title}" in the category "Family & Relationships". The image should be clean, inspiring, and suitable for a news/blog website header banner. No text in the image. Professional photography style. The image should evoke themes of family, love, relationships, faith, and Christian values. Warm, inviting colors. LANDSCAPE orientation.`;

  console.log(`\n[${index + 1}/${total}] Generating image for: ${article.title}`);
  console.log(`Article ID: ${article.id}`);

  try {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: imagePrompt,
        n: 1,
        size: '1792x1024',
        quality: 'standard',
        response_format: 'b64_json'
      })
    });

    const data = await response.json();

    if (data.data && data.data[0] && data.data[0].b64_json) {
      const imagesDir = path.join(SITE_PATH, 'images');
      await fs.mkdir(imagesDir, { recursive: true });

      const imagePath = path.join(imagesDir, `${article.id}.jpg`);
      const imageBuffer = Buffer.from(data.data[0].b64_json, 'base64');
      await fs.writeFile(imagePath, imageBuffer);

      console.log(`SUCCESS: Saved images/${article.id}.jpg`);
      return true;
    } else {
      console.error(`ERROR: ${JSON.stringify(data.error || data)}`);
      return false;
    }
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('========================================');
  console.log('Generating Images for Family & Relationships');
  console.log('========================================');
  console.log(`API Key: ${openaiApiKey ? 'Found' : 'Missing'}`);

  if (!openaiApiKey) {
    console.error('ERROR: No OpenAI API key found');
    process.exit(1);
  }

  const articles = await getArticles();
  console.log(`\nFound ${articles.length} articles to process\n`);

  let successCount = 0;
  for (let i = 0; i < articles.length; i++) {
    const success = await generateImage(articles[i], i, articles.length);
    if (success) successCount++;

    // Delay between requests to avoid rate limits
    if (i < articles.length - 1) {
      console.log('Waiting 15 seconds before next request...');
      await new Promise(resolve => setTimeout(resolve, 15000));
    }
  }

  console.log('\n========================================');
  console.log(`Complete! Generated ${successCount}/${articles.length} images`);
  console.log('========================================');
}

main().catch(console.error);
