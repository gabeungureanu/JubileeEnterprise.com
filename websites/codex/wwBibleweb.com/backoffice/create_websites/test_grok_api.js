// Test GPT-image-1 Image Generation API - Save to GodsGrace.com images folder
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();

const openaiApiKey = process.env.OPENAI_API_KEY_BACKUP || process.env.OPENAI_API_KEY;
const DATASTORE_BASE = process.env.DATASTORE_PATH || path.join(process.cwd(), '.datastore');

console.log('Testing GPT-image-1 Image Generation API');
console.log('========================================');
console.log(`API Key found: ${openaiApiKey ? 'Yes (' + openaiApiKey.substring(0, 15) + '...)' : 'No'}`);

if (!openaiApiKey) {
  console.log('ERROR: No OPENAI_API_KEY found in environment');
  process.exit(1);
}

// Generate a random article ID similar to what the system uses
function generateArticleId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function testGptImageGeneration() {
  // First article: "10 Everyday Miracles That Prove God's Grace" - Divine Inspirations category
  const articleTitle = "10 Everyday Miracles That Prove God's Grace";
  const categoryName = "Divine Inspirations";
  const articleId = generateArticleId();

  // GPT-image-1 prompt
  const imagePrompt = `Create a professional, modern header image for a Faith-Based/Christian website article titled "${articleTitle}" in the category "${categoryName}". The image should be clean, inspiring, and suitable for a news/blog website header banner. No text in the image. Professional photography style. The image should evoke themes of faith, divine presence, and everyday miracles.`;

  console.log('\nArticle:', articleTitle);
  console.log('Category:', categoryName);
  console.log('Article ID:', articleId);
  console.log('\nPrompt:', imagePrompt);
  console.log('\n--- Generating LANDSCAPE image (1536x1024) with GPT-image-1 API ---\n');

  try {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt: imagePrompt,
        n: 1,
        size: '1536x1024',
        quality: 'low'
      })
    });

    console.log('Response status:', response.status);

    const responseText = await response.text();

    if (response.ok) {
      const data = JSON.parse(responseText);
      console.log('\nSUCCESS!');

      if (data.data && data.data[0]) {
        // Create the images directory
        const imagesDir = path.join(DATASTORE_BASE, 'websites', 'GodsGrace.com', 'images');
        await fs.mkdir(imagesDir, { recursive: true });

        const imageFileName = `${articleId}.jpg`;
        const imagePath = path.join(imagesDir, imageFileName);

        // GPT-image-1 returns base64 by default
        if (data.data[0].b64_json) {
          console.log('\nBase64 image received (length:', data.data[0].b64_json.length, ')');
          const imageBuffer = Buffer.from(data.data[0].b64_json, 'base64');
          await fs.writeFile(imagePath, imageBuffer);
          console.log('\n✅ LANDSCAPE Image (1536x1024) saved to:', imagePath);
          console.log('File name:', imageFileName);
        } else if (data.data[0].url) {
          console.log('\nImage URL:', data.data[0].url);

          // Download and save the image from URL
          const imageResponse = await fetch(data.data[0].url);
          const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
          await fs.writeFile(imagePath, imageBuffer);
          console.log('\n✅ LANDSCAPE Image (1536x1024) saved to:', imagePath);
          console.log('File name:', imageFileName);
        }
      }
    } else {
      console.log('\n❌ ERROR: API returned non-OK status');
      try {
        const errorData = JSON.parse(responseText);
        console.log('Error details:', JSON.stringify(errorData, null, 2));

        if (errorData.error && errorData.error.message && errorData.error.message.includes('verified')) {
          console.log('\n⚠️  NOTE: Your OpenAI organization needs to be verified to use gpt-image-1.');
          console.log('   Please visit: https://platform.openai.com/settings/organization/general');
          console.log('   Click "Verify Organization" and wait up to 15 minutes for access.');
        }
      } catch (e) {
        console.log('Raw error:', responseText);
      }
    }

  } catch (error) {
    console.log('\n❌ Fetch error:', error.message);
    console.log('Full error:', error);
  }
}

testGptImageGeneration();
