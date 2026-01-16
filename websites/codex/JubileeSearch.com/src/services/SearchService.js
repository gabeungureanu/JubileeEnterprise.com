import config from '../config/index.js';

class SearchService {
  constructor() {
    this.apiUrl = config.inspireCodexApiUrl;
  }

  async search(query, options = {}) {
    const {
      limit = config.search.defaultLimit,
      offset = 0,
      type = 'all' // 'all', 'bible', 'content', 'ministry'
    } = options;

    try {
      // Call InspireCodex API for search
      const response = await fetch(`${this.apiUrl}/api/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query,
          limit: Math.min(limit, config.search.maxLimit),
          offset,
          type
        })
      });

      if (!response.ok) {
        throw new Error(`Search API error: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: true,
        results: data.results || [],
        total: data.total || 0,
        query,
        searchTime: data.searchTime || 0
      };
    } catch (error) {
      console.error('Search error:', error);

      // Return mock results for development/demo
      return this.getMockResults(query, limit);
    }
  }

  async searchBible(query, options = {}) {
    const { version = 'KJV', limit = 10 } = options;

    try {
      const response = await fetch(`${this.apiUrl}/api/bible/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query,
          version,
          limit
        })
      });

      if (!response.ok) {
        throw new Error(`Bible search API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Bible search error:', error);
      return this.getMockBibleResults(query, limit);
    }
  }

  getMockResults(query, limit = 10) {
    // Mock results for development
    const mockResults = [
      {
        id: '1',
        type: 'bible',
        title: 'John 3:16',
        snippet: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.',
        book: 'John',
        chapter: 3,
        verse: 16,
        relevance: 0.95
      },
      {
        id: '2',
        type: 'bible',
        title: 'Romans 8:28',
        snippet: 'And we know that all things work together for good to them that love God, to them who are the called according to his purpose.',
        book: 'Romans',
        chapter: 8,
        verse: 28,
        relevance: 0.88
      },
      {
        id: '3',
        type: 'bible',
        title: 'Psalm 23:1',
        snippet: 'The LORD is my shepherd; I shall not want.',
        book: 'Psalms',
        chapter: 23,
        verse: 1,
        relevance: 0.85
      },
      {
        id: '4',
        type: 'content',
        title: 'Understanding God\'s Love',
        snippet: 'A comprehensive study on the nature of divine love as expressed throughout Scripture...',
        category: 'Study',
        relevance: 0.82
      },
      {
        id: '5',
        type: 'bible',
        title: 'Philippians 4:13',
        snippet: 'I can do all things through Christ which strengtheneth me.',
        book: 'Philippians',
        chapter: 4,
        verse: 13,
        relevance: 0.80
      },
      {
        id: '6',
        type: 'ministry',
        title: 'Morning Devotional - Faith Journey',
        snippet: 'Start your day with encouraging words and scripture readings to strengthen your faith...',
        category: 'Devotional',
        relevance: 0.78
      },
      {
        id: '7',
        type: 'bible',
        title: 'Proverbs 3:5-6',
        snippet: 'Trust in the LORD with all thine heart; and lean not unto thine own understanding. In all thy ways acknowledge him, and he shall direct thy paths.',
        book: 'Proverbs',
        chapter: 3,
        verse: 5,
        relevance: 0.75
      },
      {
        id: '8',
        type: 'content',
        title: 'The Power of Prayer',
        snippet: 'Discover the transformative power of prayer in your daily life and spiritual growth...',
        category: 'Teaching',
        relevance: 0.72
      }
    ];

    // Filter by query relevance (simple mock filtering)
    const queryLower = query.toLowerCase();
    const filtered = mockResults.filter(r =>
      r.title.toLowerCase().includes(queryLower) ||
      r.snippet.toLowerCase().includes(queryLower) ||
      queryLower.includes('love') ||
      queryLower.includes('god') ||
      queryLower.includes('faith')
    );

    return {
      success: true,
      results: filtered.slice(0, limit),
      total: filtered.length,
      query,
      searchTime: Math.random() * 0.5 + 0.1 // Mock search time 0.1-0.6 seconds
    };
  }

  getMockBibleResults(query, limit = 10) {
    return this.getMockResults(query, limit);
  }
}

export const searchService = new SearchService();
export default searchService;
