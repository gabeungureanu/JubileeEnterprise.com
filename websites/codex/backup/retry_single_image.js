// Retry single failed image - LmVqBwmgQp9F
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();

const openaiApiKey = process.env.OPENAI_API_KEY_BACKUP || process.env.OPENAI_API_KEY;

const article = {
  id: "LmVqBwmgQp9F",
  title: "Discovering Joy in God's Promises: A Study"
};

const DATASTORE_BASE = process.env.DATASTORE_PATH || path.join(process.cwd(), '.datastore');
const imagesDir = path.join(DATASTORE_BASE, 'websites', 'GodsGrace.com', 'images');

async function retryImage() {
  const imagePrompt = `Create a professional, modern header image for a Faith-Based/Christian website article titled "${article.title}" in the category "Divine Inspirations". The image should be clean, inspiring, and suitable for a news/blog website header banner. No text in the image. Professional photography style. The image should evoke themes of faith, hope, divine presence, and spiritual inspiration. LANDSCAPE orientation.`;

  console.log(`Retrying image for: ${article.title}`);
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
        const imageResponse = await fetch(data.data[0].url);
        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

        const imagePath = path.join(imagesDir, `${article.id}.jpg`);
        await fs.writeFile(imagePath, imageBuffer);

        console.log(`✅ Image saved: ${article.id}.jpg`);
      }
    } else {
      const errorText = await response.text();
      console.log(`❌ API Error: ${response.status} - ${errorText}`);
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

retryImage();
