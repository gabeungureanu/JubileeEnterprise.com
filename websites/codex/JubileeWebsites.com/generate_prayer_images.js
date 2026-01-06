// Generate DALL-E 3 images for all 12 Prayer & Worship articles
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();

const openaiApiKey = process.env.OPENAI_API_KEY_BACKUP || process.env.OPENAI_API_KEY;

console.log('Generating DALL-E 3 Images for Prayer & Worship Category');
console.log('============================================================');
console.log(`API Key found: ${openaiApiKey ? 'Yes (' + openaiApiKey.substring(0, 15) + '...)' : 'No'}`);

if (!openaiApiKey) {
  console.log('ERROR: No OPENAI_API_KEY found in environment');
  process.exit(1);
}

// All 12 articles from Prayer & Worship category
const articles = [
  { id: "GvxGmVh5iAw1", title: "Unlocking the Power of Prayer: A Comprehensive Guide" },
  { id: "uBak8fXDBhY8", title: "10 Inspiring Worship Songs to Elevate Your Spirit" },
  { id: "D9miTZjlCVPq", title: "How to Deepen Your Daily Prayer Routine" },
  { id: "Ylf9VcU3Hoy1", title: "The Transformative Impact of Group Worship" },
  { id: "qC5jtfxCxiXw", title: "Exploring Ancient Prayer Practices for Modern Life" },
  { id: "pKpe2QN0r53i", title: "Finding Solace in Prayer During Difficult Times" },
  { id: "qXSwsb0H1BwS", title: "How Worship Shapes Our Relationship with God" },
  { id: "Gd0QYwVFV4a0", title: "5 Ways to Cultivate a Heart of Worship" },
  { id: "fJTtuafjdpY8", title: "The Role of Silence and Stillness in Prayer" },
  { id: "bqoYigPKzqeU", title: "How to Create a Sacred Space for Worship" },
  { id: "Pc1ajSciReYA", title: "Understanding the Biblical Foundations of Worship" },
  { id: "z9YBcTk2Cp2v", title: "A Beginner's Guide to Prayer Journaling" }
];

const DATASTORE_BASE = process.env.DATASTORE_PATH || path.join(process.cwd(), '.datastore');
const imagesDir = path.join(DATASTORE_BASE, 'websites', 'GodsGrace.com', 'images');

async function generateImage(article, index) {
  const imagePrompt = `Create a professional, modern header image for a Faith-Based/Christian website article titled "${article.title}" in the category "Prayer & Worship". The image should be clean, inspiring, and suitable for a news/blog website header banner. No text in the image. Professional photography style. The image should evoke themes of prayer, worship, spiritual devotion, and connection with God. LANDSCAPE orientation.`;

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
