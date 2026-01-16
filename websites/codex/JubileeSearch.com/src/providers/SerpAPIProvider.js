/**
 * SerpAPIProvider.js
 *
 * Provider for querying Google, Yahoo, and Bing search engines via SerpAPI.
 * Returns unified search results format across all engines.
 */

import config from '../config/index.js';

class SerpAPIProvider {
    constructor() {
        this.apiKey = config.serpApi?.apiKey || process.env.SERPAPI_API_KEY;
        this.baseUrl = 'https://serpapi.com/search';
        this.engines = ['google', 'yahoo', 'bing'];
        this.resultsPerEngine = config.serpApi?.resultsPerEngine || 10;
    }

    /**
     * Query a single search engine via SerpAPI
     * @param {string} query - Search query
     * @param {string} engine - Search engine ('google', 'yahoo', 'bing')
     * @returns {Promise<Array>} - Array of search results
     */
    async queryEngine(query, engine) {
        if (!this.apiKey) {
            console.error('SerpAPI key not configured');
            return [];
        }

        try {
            const params = new URLSearchParams({
                api_key: this.apiKey,
                q: query,
                engine: engine,
                num: this.resultsPerEngine.toString(),
                // Exclude ads by default
                ...(engine === 'google' && { filter: '1' }),
                ...(engine === 'bing' && { count: this.resultsPerEngine.toString() })
            });

            const response = await fetch(`${this.baseUrl}?${params.toString()}`);

            if (!response.ok) {
                throw new Error(`SerpAPI error for ${engine}: ${response.status}`);
            }

            const data = await response.json();
            return this.normalizeResults(data, engine);
        } catch (error) {
            console.error(`SerpAPI ${engine} query error:`, error.message);
            return [];
        }
    }

    /**
     * Normalize results from different search engines to a unified format
     * @param {Object} data - Raw API response
     * @param {string} engine - Search engine name
     * @returns {Array} - Normalized results
     */
    normalizeResults(data, engine) {
        let rawResults = [];

        // Extract organic results based on engine
        switch (engine) {
            case 'google':
                rawResults = data.organic_results || [];
                break;
            case 'yahoo':
                rawResults = data.organic_results || [];
                break;
            case 'bing':
                rawResults = data.organic_results || [];
                break;
            default:
                rawResults = data.organic_results || [];
        }

        // Filter out any potential ads that slipped through
        const organicResults = rawResults.filter(result => {
            // Skip results that look like ads
            const isAd = result.is_ad ||
                result.type === 'ad' ||
                result.ad ||
                (result.displayed_link && result.displayed_link.includes('Ad'));
            return !isAd;
        });

        // Normalize to unified format
        return organicResults.map((result, index) => ({
            title: result.title || '',
            url: result.link || result.url || '',
            snippet: result.snippet || result.description || '',
            displayUrl: result.displayed_link || result.visible_url || result.link || '',
            position: index + 1,
            source: engine,
            // Additional metadata
            favicon: result.favicon || null,
            date: result.date || null,
            cachedUrl: result.cached_page_link || null,
            sitelinks: result.sitelinks || null
        }));
    }

    /**
     * Query all configured search engines and aggregate results
     * @param {string} query - Search query
     * @returns {Promise<Object>} - Aggregated results from all engines
     */
    async queryAll(query) {
        const startTime = Date.now();

        // Query all engines in parallel
        const enginePromises = this.engines.map(engine =>
            this.queryEngine(query, engine)
                .then(results => ({ engine, results, error: null }))
                .catch(error => ({ engine, results: [], error: error.message }))
        );

        const engineResults = await Promise.all(enginePromises);

        // Aggregate results
        const allResults = [];
        const engineStats = {};
        const errors = [];

        for (const { engine, results, error } of engineResults) {
            if (error) {
                errors.push({ engine, error });
            }

            engineStats[engine] = {
                count: results.length,
                success: !error
            };

            allResults.push(...results);
        }

        const queryTime = Date.now() - startTime;

        return {
            results: allResults,
            totalFetched: allResults.length,
            enginesQueried: this.engines,
            engineStats,
            errors: errors.length > 0 ? errors : null,
            queryTime
        };
    }

    /**
     * Check if SerpAPI is properly configured
     * @returns {boolean}
     */
    isConfigured() {
        return !!this.apiKey;
    }

    /**
     * Get API usage/credits info (if available)
     * @returns {Promise<Object|null>}
     */
    async getAccountInfo() {
        if (!this.apiKey) {
            return null;
        }

        try {
            const response = await fetch(`https://serpapi.com/account?api_key=${this.apiKey}`);
            if (response.ok) {
                return await response.json();
            }
            return null;
        } catch (error) {
            console.error('Failed to get SerpAPI account info:', error.message);
            return null;
        }
    }
}

export const serpApiProvider = new SerpAPIProvider();
export default serpApiProvider;
