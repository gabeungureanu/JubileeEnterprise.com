// Generate DALL-E 3 images for all 12 Biblical Teachings articles
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();

const openaiApiKey = process.env.OPENAI_API_KEY_BACKUP || process.env.OPENAI_API_KEY;

console.log('Generating DALL-E 3 Images for Biblical Teachings Category');
console.log('============================================================');
console.log(`API Key found: ${openaiApiKey ? 'Yes (' + openaiApiKey.substring(0, 15) + '...)' : 'No'}`);

if (!openaiApiKey) {
  console.log('ERROR: No OPENAI_API_KEY found in environment');
  process.exit(1);
}

// All 12 articles from Biblical Teachings category
const articles = [
  { id: "aBnPJuEnTUJ3", title: "Unlocking Biblical Wisdom for Modern Challenges" },
  { id: "Kr6yxwyVzEN0", title: "10 Commandments: Deep Dive into Divine Guidance" },
  { id: "jXJLHuY6eU3E", title: "How to Live a Christ-Centered Life Daily" },
  { id: "wmlygW0Mr31E", title: "Understanding Parables: Unearth Hidden Biblical Lessons" },
  { id: "UjSL4fU79Rt7", title: "Faith in Action: Applying Scripture to Everyday Life" },
  { id: "avHEef8JRMOG", title: "The Beatitudes Explained: Pathway to True Happiness" },
  { id: "Yu4w0UTlDct3", title: "Bible Study Essentials: Tools for Scripture Mastery" },
  { id: "NHTn6JvwLj2P", title: "7 Biblical Steps to Strengthen Your Faith" },
  { id: "ni50umCjPZip", title: "Exploring God's Grace Through Biblical Stories" },
  { id: "TSnGg3NYqCuf", title: "Prophets of the Bible: Their Messages Today" },
  { id: "JgYBRWxP5r8c", title: "Scripture and Science: Harmonizing Faith and Reason" },
  { id: "aUpbZbtDTItk", title: "The Role of Prayer in Biblical Teachings" }
];

const DATASTORE_BASE = process.env.DATASTORE_PATH || path.join(process.cwd(), '.datastore');
const imagesDir = path.join(DATASTORE_BASE, 'websites', 'GodsGrace.com', 'images');

async function generateImage(article, index) {
  const imagePrompt = `Create a professional, modern header image for a Faith-Based/Christian website article titled "${article.title}" in the category "Biblical Teachings". The image should be clean, inspiring, and suitable for a news/blog website header banner. No text in the image. Professional photography style. The image should evoke themes of Scripture, biblical wisdom, spiritual learning, and divine truth. LANDSCAPE orientation.`;

  console.log(`\n[${index + 1}/12] Generating image for: ${article.title}`);
  console.log(`Article ID: ${article.id}`);

  try {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: imagePrompt,
        n: 1,
        size: '1792x1024',
        quality: 'standard'
      })
    });

    if (response.ok) {
      const data = await response.json();
      if (data.data && data.data[0] && data.data[0].url) {
        // Download and save the image
        const imageResponse = await fetch(data.data[0].url);
        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

        const imagePath = path.join(imagesDir, `${article.id}.jpg`);
        await fs.writeFile(imagePath, imageBuffer);

        console.log(`   ✅ Image saved: ${article.id}.jpg`);
        return { success: true, id: article.id };
      }
    } else {
      const errorText = await response.text();
      console.log(`   ❌ API Error: ${response.status} - ${errorText}`);
      return { success: false, id: article.id, error: errorText };
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return { success: false, id: article.id, error: error.message };
  }
}

async function generateAllImages() {
  // Ensure images directory exists
  await fs.mkdir(imagesDir, { recursive: true });
  console.log(`\nImages directory: ${imagesDir}`);

  let successCount = 0;
  let failCount = 0;
  const failed = [];

  for (let i = 0; i < articles.length; i++) {
    const result = await generateImage(articles[i], i);
    if (result.success) {
      successCount++;
    } else {
      failCount++;
      failed.push(articles[i].id);
    }

    // Add a small delay between API calls to avoid rate limiting
    if (i < articles.length - 1) {
      console.log('   Waiting 2 seconds before next request...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('\n============================================================');
  console.log(`Generation Complete!`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  if (failed.length > 0) {
    console.log(`   Failed IDs: ${failed.join(', ')}`);
  }
  console.log('============================================================');
}

generateAllImages();
