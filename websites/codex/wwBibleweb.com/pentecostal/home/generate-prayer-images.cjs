const fs = require('fs');
const path = require('path');
const https = require('https');

const LEONARDO_API_KEY = '5b9a5710-f068-42a5-8962-cd55af51836b';
const articlesPath = './prayer-and-devotion/web_articles.json';
const websiteImagesPath = './prayer-and-devotion/images';
const datastoreImagesPath = 'c:/data/JubileeEnterprise.com/.datastore/websites/home.pentecostal/images/prayer-and-devotion';

// Theme extraction for image prompts
function extractThemes(article) {
    const text = `${article.title} ${article.excerpt || ''} ${article.content || ''}`.toLowerCase();
    const themes = [];

    if (text.includes('morning') || text.includes('dawn') || text.includes('sunrise')) themes.push('golden morning light streaming through window');
    if (text.includes('prayer') || text.includes('praying')) themes.push('person in peaceful prayer posture');
    if (text.includes('devotion') || text.includes('devotional')) themes.push('quiet contemplative spiritual moment');
    if (text.includes('bible') || text.includes('scripture')) themes.push('open Bible with warm lighting');
    if (text.includes('fasting')) themes.push('spiritual discipline and meditation');
    if (text.includes('intercessory') || text.includes('intercession')) themes.push('hands raised in prayer for others');
    if (text.includes('psalm') || text.includes('psalms')) themes.push('ancient scrolls and worship atmosphere');
    if (text.includes('evening') || text.includes('night')) themes.push('peaceful evening sunset golden hour');
    if (text.includes('journal') || text.includes('journaling')) themes.push('open journal with pen and candlelight');
    if (text.includes('corporate') || text.includes('together') || text.includes('community')) themes.push('group of people praying together');
    if (text.includes('strength') || text.includes('difficult')) themes.push('light breaking through storm clouds');
    if (text.includes('closet') || text.includes('sacred space')) themes.push('intimate prayer corner with soft lighting');

    if (themes.length === 0) {
        themes.push('peaceful spiritual devotion scene');
    }

    return themes.slice(0, 3);
}

function generatePrompt(article) {
    const themes = extractThemes(article);
    return `Pure photography without any text or writing. A beautiful warm-toned photograph capturing ${themes.join(' and ')}. Soft natural lighting, peaceful and serene atmosphere, professional editorial photography style, cinematic quality, no typography, no words, no letters anywhere in the image.`;
}

async function makeRequest(options, postData = null) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(data);
                }
            });
        });
        req.on('error', reject);
        req.setTimeout(60000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        if (postData) req.write(postData);
        req.end();
    });
}

async function generateImage(prompt) {
    console.log('  Generating image with Leonardo AI...');

    const postData = JSON.stringify({
        prompt: prompt,
        modelId: 'de7d3faf-762f-48e0-b3b7-9d0ac3a3fcf3', // Leonardo Phoenix 1.0
        width: 1024,
        height: 768,
        num_images: 1
    });

    const options = {
        hostname: 'cloud.leonardo.ai',
        path: '/api/rest/v1/generations',
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${LEONARDO_API_KEY}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    const response = await makeRequest(options, postData);

    if (!response.sdGenerationJob) {
        throw new Error('Failed to start generation: ' + JSON.stringify(response));
    }

    const generationId = response.sdGenerationJob.generationId;
    console.log('  Generation ID:', generationId);

    // Poll for completion
    for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 3000));

        const pollOptions = {
            hostname: 'cloud.leonardo.ai',
            path: `/api/rest/v1/generations/${generationId}`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${LEONARDO_API_KEY}`
            }
        };

        const pollResponse = await makeRequest(pollOptions);

        if (pollResponse.generations_by_pk?.status === 'COMPLETE') {
            const images = pollResponse.generations_by_pk.generated_images;
            if (images && images.length > 0) {
                return images[0].url;
            }
        }
        console.log('  Polling... attempt', i + 1);
    }

    throw new Error('Generation timed out');
}

async function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath);
        https.get(url, (response) => {
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(filepath, () => {});
            reject(err);
        });
    });
}

async function main() {
    console.log('Loading articles...');
    const data = JSON.parse(fs.readFileSync(articlesPath, 'utf8'));

    console.log(`Found ${data.articles.length} articles\n`);

    for (let i = 0; i < data.articles.length; i++) {
        const article = data.articles[i];
        const imageFilename = `prayer-${String(i + 1).padStart(2, '0')}.jpg`;

        console.log(`\n[${i + 1}/${data.articles.length}] ${article.title}`);

        // Check if already has image
        if (article.image && fs.existsSync(path.join(websiteImagesPath, imageFilename))) {
            console.log('  Already has image, skipping...');
            continue;
        }

        try {
            const prompt = generatePrompt(article);
            console.log('  Prompt:', prompt.substring(0, 100) + '...');

            const imageUrl = await generateImage(prompt);
            console.log('  Image URL received');

            // Download to both locations
            const websitePath = path.join(websiteImagesPath, imageFilename);
            const datastorePath = path.join(datastoreImagesPath, imageFilename);

            await downloadImage(imageUrl, websitePath);
            console.log('  Saved to website folder');

            fs.copyFileSync(websitePath, datastorePath);
            console.log('  Copied to datastore');

            // Update article with image path
            const timestamp = Date.now();
            article.image = `images/${imageFilename}?v=${timestamp}`;

            // Save after each article
            fs.writeFileSync(articlesPath, JSON.stringify(data, null, 2));
            console.log('  Updated web_articles.json');

        } catch (error) {
            console.error('  ERROR:', error.message);
        }

        // Brief pause between generations
        await new Promise(r => setTimeout(r, 2000));
    }

    console.log('\n\nDone! All images generated.');
}

main().catch(console.error);
