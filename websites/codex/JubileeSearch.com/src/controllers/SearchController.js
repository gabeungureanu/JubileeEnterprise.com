import searchService from '../services/SearchService.js';
import searchAggregationService from '../services/SearchAggregationService.js';
import config from '../config/index.js';

export class SearchController {
  async search(req, res) {
    try {
      const { q: query, limit = 10, offset = 0, type = 'all' } = req.query;

      if (!query || query.trim().length < config.search.minQueryLength) {
        return res.status(400).json({
          success: false,
          error: `Query must be at least ${config.search.minQueryLength} characters`
        });
      }

      const results = await searchService.search(query.trim(), {
        limit: parseInt(limit),
        offset: parseInt(offset),
        type
      });

      return res.json(results);
    } catch (error) {
      console.error('Search controller error:', error);
      return res.status(500).json({
        success: false,
        error: 'An error occurred while searching'
      });
    }
  }

  /**
   * Web search endpoint - queries Google, Yahoo, Bing via SerpAPI
   * with caching and ranking by relevance + sentiment
   */
  async webSearch(req, res) {
    try {
      const { q: query } = req.query;

      if (!query || query.trim().length < config.search.minQueryLength) {
        return res.status(400).json({
          success: false,
          error: `Query must be at least ${config.search.minQueryLength} characters`
        });
      }

      const results = await searchAggregationService.search(query.trim());

      return res.json(results);
    } catch (error) {
      console.error('Web search controller error:', error);
      return res.status(500).json({
        success: false,
        error: 'An error occurred while searching the web'
      });
    }
  }

  /**
   * Get web search statistics (cache hits, API usage)
   */
  async webSearchStats(req, res) {
    try {
      const stats = await searchAggregationService.getStats();
      return res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Web search stats error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch search statistics'
      });
    }
  }

  /**
   * Check web search configuration status
   */
  async webSearchConfig(req, res) {
    try {
      const config = searchAggregationService.checkConfiguration();
      return res.json({
        success: true,
        data: config
      });
    } catch (error) {
      console.error('Web search config check error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to check configuration'
      });
    }
  }

  async searchBible(req, res) {
    try {
      const { q: query, version = 'KJV', limit = 10 } = req.query;

      if (!query || query.trim().length < config.search.minQueryLength) {
        return res.status(400).json({
          success: false,
          error: `Query must be at least ${config.search.minQueryLength} characters`
        });
      }

      const results = await searchService.searchBible(query.trim(), {
        version,
        limit: parseInt(limit)
      });

      return res.json(results);
    } catch (error) {
      console.error('Bible search controller error:', error);
      return res.status(500).json({
        success: false,
        error: 'An error occurred while searching the Bible'
      });
    }
  }

  async suggest(req, res) {
    try {
      const { q: query } = req.query;

      if (!query || query.trim().length < 1) {
        return res.json({ suggestions: [] });
      }

      // Mock suggestions for now
      const suggestions = [
        `${query} in the Bible`,
        `${query} meaning`,
        `${query} verses`,
        `${query} scripture`,
        `${query} devotional`
      ].slice(0, 5);

      return res.json({ suggestions });
    } catch (error) {
      console.error('Suggest controller error:', error);
      return res.json({ suggestions: [] });
    }
  }
}

export const searchController = new SearchController();
export default searchController;
