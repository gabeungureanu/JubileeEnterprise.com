/**
 * SearchAggregationService.js
 *
 * Main orchestrator for web search aggregation workflow.
 * Coordinates between cache, search engines, and ranking services.
 *
 * Workflow:
 * 1. Check cache for existing results
 * 2. If cached: increment hit counter and return
 * 3. If not cached: query search engines, rank results, cache, and return
 */

import config from '../config/index.js';
import cacheService from './CacheService.js';
import rankingService from './RankingService.js';
import serpApiProvider from '../providers/SerpAPIProvider.js';

class SearchAggregationService {
    constructor() {
        this.maxResults = config.search?.maxResults || 10;
        this.cacheExpirationHours = config.search?.cacheExpirationHours || 24;
    }

    /**
     * Main search method - orchestrates the full search workflow
     * @param {string} query - User's search query
     * @param {Object} options - Search options
     * @returns {Promise<Object>} - Search results and metadata
     */
    async search(query, options = {}) {
        const startTime = Date.now();
        const normalizedQuery = this.normalizeQuery(query);

        if (!normalizedQuery || normalizedQuery.length < 2) {
            return {
                success: false,
                error: 'Query too short. Please enter at least 2 characters.',
                results: [],
                query: normalizedQuery
            };
        }

        try {
            // Step 1: Check cache
            const cachedResult = await cacheService.lookup(normalizedQuery);

            if (cachedResult && cachedResult.cached) {
                // Cache hit - increment counter and return cached results
                await cacheService.incrementHitCounter(cachedResult.id);

                return {
                    success: true,
                    cached: true,
                    results: cachedResult.results,
                    query: normalizedQuery,
                    hitCounter: cachedResult.hitCounter + 1,
                    cachedAt: cachedResult.createdAt,
                    searchTime: Date.now() - startTime,
                    source: 'cache'
                };
            }

            // Step 2: Cache miss - query search engines
            const searchEngineResults = await serpApiProvider.queryAll(normalizedQuery);

            if (!searchEngineResults.results || searchEngineResults.results.length === 0) {
                // No results from any search engine
                return {
                    success: true,
                    cached: false,
                    results: [],
                    query: normalizedQuery,
                    message: 'No results found for your search.',
                    searchTime: Date.now() - startTime,
                    source: 'live',
                    engineStats: searchEngineResults.engineStats
                };
            }

            // Step 3: Rank results
            const rankedResults = rankingService.rankResults(
                searchEngineResults.results,
                normalizedQuery,
                this.maxResults
            );

            // Step 4: Prepare final results (clean up for response)
            const finalResults = rankedResults.results.map(result => ({
                title: result.title,
                url: result.url,
                snippet: result.snippet,
                displayUrl: result.displayUrl,
                source: result.source,
                scores: result.scores,
                favicon: result.favicon
            }));

            // Step 5: Cache results (async, don't wait)
            this.cacheResultsAsync(normalizedQuery, finalResults, {
                totalFetched: searchEngineResults.totalFetched,
                enginesQueried: searchEngineResults.enginesQueried,
                scoringDetails: rankedResults.scoringDetails
            });

            return {
                success: true,
                cached: false,
                results: finalResults,
                query: normalizedQuery,
                totalFetched: searchEngineResults.totalFetched,
                duplicatesRemoved: rankedResults.duplicatesRemoved,
                searchTime: Date.now() - startTime,
                source: 'live',
                engineStats: searchEngineResults.engineStats
            };

        } catch (error) {
            console.error('Search aggregation error:', error);

            // Try to return stale cache if available
            try {
                const staleCache = await cacheService.lookup(normalizedQuery);
                if (staleCache) {
                    return {
                        success: true,
                        cached: true,
                        stale: true,
                        results: staleCache.results,
                        query: normalizedQuery,
                        message: 'Showing cached results due to search engine unavailability.',
                        searchTime: Date.now() - startTime,
                        source: 'stale-cache'
                    };
                }
            } catch {
                // Ignore cache errors in fallback
            }

            return {
                success: false,
                error: 'Search temporarily unavailable. Please try again.',
                results: [],
                query: normalizedQuery,
                searchTime: Date.now() - startTime
            };
        }
    }

    /**
     * Normalize search query
     * @param {string} query - Raw query
     * @returns {string} - Normalized query
     */
    normalizeQuery(query) {
        if (!query) return '';
        return query.trim().replace(/\s+/g, ' ');
    }

    /**
     * Cache results asynchronously (fire and forget)
     * @param {string} query - Search query
     * @param {Array<Object>} results - Results to cache
     * @param {Object} metadata - Additional metadata
     */
    async cacheResultsAsync(query, results, metadata) {
        try {
            await cacheService.save(query, results, {
                ...metadata,
                expiresInHours: this.cacheExpirationHours
            });
        } catch (error) {
            console.error('Failed to cache results:', error.message);
            // Non-critical - don't throw
        }
    }

    /**
     * Get search statistics
     * @returns {Promise<Object>} - Statistics about cached searches
     */
    async getStats() {
        const cacheStats = await cacheService.getStats();
        const serpApiInfo = await serpApiProvider.getAccountInfo();

        return {
            cache: cacheStats,
            serpApi: serpApiInfo ? {
                searchesRemaining: serpApiInfo.plan_searches_left,
                plan: serpApiInfo.plan_name
            } : null
        };
    }

    /**
     * Check if the service is properly configured
     * @returns {Object} - Configuration status
     */
    checkConfiguration() {
        return {
            serpApiConfigured: serpApiProvider.isConfigured(),
            cacheApiUrl: !!config.inspireCodexApiUrl,
            maxResults: this.maxResults,
            cacheExpirationHours: this.cacheExpirationHours
        };
    }
}

export const searchAggregationService = new SearchAggregationService();
export default searchAggregationService;
