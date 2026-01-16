import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.JUBILEE_SEARCH_PORT || 3010,
  nodeEnv: process.env.NODE_ENV || 'development',

  // API URLs
  inspireCodexApiUrl: process.env.INSPIRE_CODEX_API_URL || 'https://api.inspirecodex.com',

  // CORS
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3010'],

  // Search settings
  search: {
    defaultLimit: 10,
    maxLimit: 100,
    minQueryLength: 2,
    maxResults: 10,
    cacheExpirationHours: parseInt(process.env.CACHE_EXPIRATION_HOURS || '24')
  },

  // SerpAPI configuration
  serpApi: {
    apiKey: process.env.SERPAPI_API_KEY,
    resultsPerEngine: parseInt(process.env.SERPAPI_RESULTS_PER_ENGINE || '10')
  },

  // Ranking weights
  ranking: {
    relevanceWeight: parseFloat(process.env.RANKING_RELEVANCE_WEIGHT || '0.6'),
    sentimentWeight: parseFloat(process.env.RANKING_SENTIMENT_WEIGHT || '0.3'),
    positionWeight: parseFloat(process.env.RANKING_POSITION_WEIGHT || '0.1')
  }
};

export default config;
