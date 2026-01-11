// Generate DALL-E 3 images for all 12 Divine Inspirations articles
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();

const openaiApiKey = process.env.OPENAI_API_KEY_BACKUP || process.env.OPENAI_API_KEY;

console.log('Generating DALL-E 3 Images for Divine Inspirations Category');
console.log('============================================================');
console.log(`API Key found: ${openaiApiKey ? 'Yes (' + openaiApiKey.substring(0, 15) + '...)' : 'No'}`);

if (!openaiApiKey) {
  console.log('ERROR: No OPENAI_API_KEY found in environment');
  process.exit(1);
}

// All 12 articles from Divine Inspirations category
const articles = [
  { id: "ePUFEsoLRy7F", title: "10 Everyday Miracles That Prove God's Grace" },
  { id: "QTIFGOT0UGTS", title: "How to Strengthen Your Faith Through Adversity" },
  { id: "YQRXpNohCYEc", title: "Unveiling Divine Intervention: Real-Life Testimonies" },
  { id: "qXbgtxjQ7HEb", title: "The Power of Prayer: Inspiring Stories of Hope" },
  { id: "t4cS1mty4pxr", title: "7 Bible Verses That Illuminate God's Presence" },
  { id: "WEouy9bSsmi1", title: "Finding God's Grace in Daily Life: A Guide" },
  { id: "EmnD2dDp7BWm", title: "From Doubt to Faith: Transformational Journeys" },
  { id: "KMGOn7qr8B64", title: "Understanding God's Plan: Reflections on Trust" },
  { id: "p3o9OKBQ6qVe", title: "5 Inspirational Quotes to Elevate Your Spirit" },
  { id: "LmVqBwmgQp9F", title: "Discovering Joy in God's Promises: A Study" },
  { id: "FWiHTJoPcp9h", title: "Miracles in Modern Times: A Closer Look" },
  { id: "idYudeonBsXD", title: "Embracing God's Love: Personal Stories of Renewal" }
];

const DATASTORE_BASE = process.env.DATASTORE_PATH || path.join(process.cwd(), '.datastore');
const imagesDir = path.join(DATASTORE_BASE, 'websites', 'GodsGrace.com', 'images');

async function generateImage(article, index) {
  const imagePrompt = `Create a professional, modern header image for a Faith-Based/Christian website article titled "${article.title}" in the category "Divine Inspirations". The image should be clean, inspiring, and suitable for a news/blog website header banner. No text in the image. Professional photography style. The image should evoke themes of faith, hope, divine presence, and spiritual inspiration. LANDSCAPE orientation.`;

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

  for (let i = 0; i < articles.length; i++) {
    const result = await generateImage(articles[i], i);
    if (result.success) {
      successCount++;
    } else {
      failCount++;
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
  console.log('============================================================');
}

generateAllImages();
