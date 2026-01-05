# Jubilee Website Generator

AI-powered complete website generation system that creates content-rich websites with multiple AI writers, categories, and articles.

## 🎯 What It Generates

For each website, the system creates:
- **12 unique AI writers** with distinct voices and profile photos
- **3, 7, or 12 categories** (your choice)
- **12 articles per category** with featured images
- **SEO optimization** and internal linking
- **Complete sitemap** (XML + HTML + RSS feeds)
- **Export options**: Static HTML, WordPress XML, Ghost JSON

### Example Output
- 12 categories × 12 articles = **144 articles**
- ~150,000 words of unique content
- 157 AI-generated images (writers + categories + articles)
- Full SEO optimization with meta tags
- Internal linking between related articles

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure API Keys

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` and add your API keys:

```
ANTHROPIC_API_KEY=your_anthropic_key_here
OPENAI_API_KEY=your_openai_key_here
```

**Note**: You need at least ONE API key (Anthropic or OpenAI) for the system to work.

### 3. Start the Server

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

### 4. Open in Browser

Navigate to: **http://localhost:3001**

## 📋 Step-by-Step Process

### Step 1: Domain Analysis (Current Implementation)
- Enter your domain name (e.g., "faithfulparenting.com")
- Provide a brief website overview
- Select number of categories (3, 7, or 12)
- Choose Quick Mode (15-20 min) or Full Mode (45-60 min)

The system will:
- Extract keywords from your domain
- Identify your niche and target audience
- Suggest content type (Business-Based or Faith-Based)
- Create site folder structure
- Generate site code for tracking

### Steps 2-7 (Coming Soon)
- **Step 2**: Select Content Type (BB/FB) and generate overview
- **Step 3**: Generate 12 AI writers with photos
- **Step 4**: Generate categories with images
- **Step 5**: Generate 144 articles with featured images
- **Step 6**: Generate sitemap and navigation
- **Step 7**: Export and launch website

## 🛠️ Technology Stack

- **Backend**: Node.js + Express
- **AI APIs**: OpenAI GPT-4o + Anthropic Claude Sonnet 4
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Storage**: File-based JSON (syncs with Google Drive)
- **Image Processing**: Sharp

## 📁 Project Structure

```
jubilee-website-generator/
├── server.js                  # Main Express server
├── package.json               # Dependencies
├── .env                       # Environment variables (create this)
├── .env.example               # Template for .env
├── create_website.html        # Main UI (Step 1)
│
└── .webstore/                 # Generated data (auto-created)
    ├── .registry/
    │   └── sites_history.json # Registry of all sites
    ├── .namespace/            # GPT prompt templates (coming soon)
    └── sites/                 # Generated websites
        └── [SITECODE]-[DOMAIN]/
            ├── [SITECODE].config.json
            ├── writers/
            ├── categories/
            ├── articles/
            ├── sitemap/
            ├── theme/
            └── export/
```

## 🔑 API Endpoints

### Health Check
```
GET /api/health
```
Returns server status and API key configuration.

### List All Websites
```
GET /api/websites
```
Returns all generated websites from registry.

### Analyze Domain (Step 1)
```
POST /api/website/analyze-domain
Content-Type: application/json

{
  "domain": "example.com",
  "overview": "Brief description...",
  "categoryCount": 12,
  "quickMode": false
}
```

Returns domain analysis, site code, and initial configuration.

### Get Site Details
```
GET /api/website/:siteCode
```
Returns complete site configuration and status.

## 🎨 Content Types

### BB (Business-Based)
- Professional tone
- ROI-focused content
- Case studies and testimonials
- Lead generation optimization
- Industry-specific terminology

### FB (Faith-Based)
- Inspirational and devotional tone
- Scripture references
- Ministry focus
- Community and discipleship
- Kingdom impact orientation

## ⚡ Quick Mode vs Full Mode

### Quick Mode (~15-20 minutes)
- Pre-made writer templates
- Shorter articles (600-800 words)
- Standard images
- Basic SEO optimization

### Full Mode (~45-60 minutes)
- Custom AI-generated writers
- Longer articles (1000-1500 words)
- AI-generated custom images
- Advanced SEO optimization
- Internal linking optimization

## 🔧 Configuration

Environment variables in `.env`:

```bash
# Required: At least one API key
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Optional: Server configuration
PORT=3001
NODE_ENV=development

# Optional: Storage paths (defaults will be used)
WEBSTORE_PATH=.webstore
SITES_PATH=.webstore/sites
```

## 📊 Current Status

**✅ Implemented:**
- Project structure and dependencies
- Express server with CORS
- Domain analysis endpoint (Step 1)
- Site folder creation
- Registry system
- AI integration (OpenAI + Claude)
- Frontend UI for Step 1
- API key validation
- Error handling

**🚧 Coming Soon:**
- Steps 2-7 implementation
- Writer generation with photos
- Category generation with images
- Article generation (144 per site)
- Sitemap generation
- Export system (HTML/WordPress/Ghost)
- Admin dashboard

## 🐛 Troubleshooting

### Server won't start
```bash
# Make sure dependencies are installed
npm install

# Check if port 3001 is available
lsof -i :3001  # Mac/Linux
netstat -ano | findstr :3001  # Windows
```

### API errors
```bash
# Verify API keys in .env file
cat .env

# Test API keys manually
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer YOUR_OPENAI_KEY"
```

### Can't access website
- Make sure server is running (`npm start`)
- Check browser console for errors (F12)
- Verify you're accessing http://localhost:3001

## 📝 Development Notes

### Adding New Steps
1. Create new HTML file for step UI
2. Add API endpoint in `server.js`
3. Create GPT prompt file in `.webstore/.namespace/`
4. Update navigation between steps
5. Update registry with step completion status

### Database-Free Design
This system uses file-based storage for simplicity:
- JSON files for structured data
- File system for content organization
- Google Drive Desktop for cloud sync
- No database server required

## 🎓 Based On

This project is based on the successful **Jubilee Intelligence** book creation system, adapted for website generation. It uses the same proven architecture:
- Modular pipeline design
- AI provider abstraction
- File-based content management
- Registry pattern for tracking
- GPT prompt file system

## 📄 License

ISC

## 👤 Author

Jubilee Intelligence

---

**Ready to generate your first website?**

1. Install dependencies: `npm install`
2. Add API keys to `.env`
3. Start server: `npm start`
4. Open: http://localhost:3001

Let the AI do the heavy lifting! 🚀
