# JubileeInspire.com

AI-powered spiritual companion chat interface with multi-layered prompt system.

## Overview

JubileeInspire provides an interactive chat experience powered by AI with specialized prompts for spiritual guidance. The server supports multiple AI models with configurable personality layers.

## Features

### Chat Interface
- **Clean Chat UI**: Modern responsive chat interface
- **Login System**: User authentication support
- **Real-time Messaging**: Instant message delivery
- **Profile Integration**: User profile display with Jubilee branding

### Prompt System
The prompt system uses a three-layer architecture:

1. **System Layer** (`model_system.txt`): Foundation prompt always included
2. **Model Layer** (`model_<name>.txt`): Model-specific personality and behavior
3. **Developer Layer** (`model_developer.txt`): Developer suffix always included
4. **User Declarations** (`model_userdeclarations.txt`): User identity awareness

### New in v1.1.0 (2026-01-11)
- **Qdrant RAG Integration**: Vector database for contextual responses
- **Multi-model Support**: GospelPulse and other AI personalities
- **Prompt API**: External access to prompt layers via `/api/prompt`

## Port

- Default: `3001` (or `3003` in production/iisnode)
- Configurable via `PORT` environment variable

## API Endpoints

### Pages
- `GET /` - Main index page
- `GET /login` - Login page (rewrites to `/login.html`)
- `GET /chat` - Chat interface (rewrites to `/chat.html`)

### API
- `GET /api/prompt?model=<name>` - Get prompt layers for specified model

### Prompt API Response
```json
{
    "success": true,
    "model": "gospelpulse",
    "layers": {
        "system": "...",
        "model": "...",
        "developer": "...",
        "userDeclarations": "..."
    },
    "combined": "...",
    "prompt": "..."
}
```

## Directory Structure

```
JubileeInspire.com/
├── index.html          # Main landing page
├── login.html          # Login page
├── chat.html           # Chat interface
├── server.js           # Node.js static server
├── serve.json          # URL rewrite configuration
├── web.config          # IIS configuration
├── prompts/            # AI prompt templates
│   ├── model_system.txt
│   ├── model_developer.txt
│   ├── model_gospelpulse.txt
│   └── model_userdeclarations.txt
├── scripts/            # Client-side scripts
├── data/               # Data files
└── images/             # Image assets
```

## Running Locally

```bash
cd websites/codex/JubileeInspire.com
node server.js
```

Or with npm:
```bash
npm start
```

## Configuration

### serve.json
URL rewrites for clean routing:
```json
{
    "rewrites": [
        { "source": "/login", "destination": "/login.html" },
        { "source": "/chat", "destination": "/chat.html" }
    ]
}
```

## CORS

Cross-origin requests are enabled for all origins (`*`) with the following methods:
- GET
- POST
- OPTIONS

## Caching

- Static assets (images, fonts): 1 day cache
- CSS/JS files: 1 hour cache
- HTML files: No cache

## Technology Stack

- Node.js (native HTTP server)
- Static file serving
- SPA-style routing support
- MIME type handling

## Security

- Directory traversal prevention
- Path normalization
- Sandboxed file serving within BASE_DIR

## License

Copyright 2024-2026 Jubilee Solutions
