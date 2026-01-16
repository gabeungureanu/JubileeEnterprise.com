/**
 * CacheService.js
 *
 * Service for caching web search results via InspireCodex API.
 * Handles cache lookups, saves, and hit counter increments.
 */

import crypto from 'crypto';
import config from '../config/index.js';

class CacheService {
    constructor() {
        this.apiUrl = config.inspireCodexApiUrl;
        this.cacheEndpoint = '/api/v1/inspire/web-search/cache';
    }

    /**
     * Generate a consistent hash for a search keyword
     * @param {string} keyword - Search keyword/phrase
     * @returns {string} - SHA256 hash of normalized keyword
     */
    generateKeywordHash(keyword) {
        if (!keyword) return '';

        // Normalize: lowercase, trim, collapse whitespace
        const normalized = keyword.toLowerCase().trim().replace(/\s+/g, ' ');

        return crypto.createHash('sha256').update(normalized).digest('hex');
    }

    /**
     * Look up cached search results by keyword
     * @param {string} keyword - Search keyword/phrase
     * @returns {Promise<Object|null>} - Cached results or null if not found
     */
    async lookup(keyword) {
        const hash = this.generateKeywordHash(keyword);

        if (!hash) {
            return null;
        }

        try {
            const response = await fetch(`${this.apiUrl}${this.cacheEndpoint}/${hash}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 404) {
                // Cache miss - this is expected and not an error
                return null;
            }

            if (!response.ok) {
                console.error(`Cache lookup error: ${response.status}`);
                return null;
            }

            const data = await response.json();

            if (data.success && data.data) {
                return {
                    cached: true,
                    id: data.data.id,
                    keyword: data.data.keyword,
                    results: typeof data.data.results === 'string'
                        ? JSON.parse(data.data.results)
                        : data.data.results,
                    hitCounter: data.data.hit_counter,
                    createdAt: data.data.created_at,
                    updatedAt: data.data.updated_at,
                    expiresAt: data.data.expires_at
                };
            }

            return null;
        } catch (error) {
            console.error('Cache lookup error:', error.message);
            return null;
        }
    }

    /**
     * Increment the hit counter for a cached search
     * @param {string} cacheId - UUID of the cached search entry
     * @returns {Promise<boolean>} - Success status
     */
    async incrementHitCounter(cacheId) {
        if (!cacheId) {
            return false;
        }

        try {
            const response = await fetch(`${this.apiUrl}${this.cacheEndpoint}/${cacheId}/hit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                console.error(`Hit counter increment error: ${response.status}`);
                return false;
            }

            const data = await response.json();
            return data.success;
        } catch (error) {
            console.error('Hit counter increment error:', error.message);
            return false;
        }
    }

    /**
     * Save search results to cache
     * @param {string} keyword - Search keyword/phrase
     * @param {Array<Object>} results - Ranked search results
     * @param {Object} metadata - Additional metadata
     * @returns {Promise<Object|null>} - Saved cache entry or null on error
     */
    async save(keyword, results, metadata = {}) {
        if (!keyword || !results) {
            return null;
        }

        const hash = this.generateKeywordHash(keyword);

        try {
            const payload = {
                keyword,
                keyword_hash: hash,
                results,
                total_results_fetched: metadata.totalFetched || results.length,
                search_engines_queried: metadata.enginesQueried || [],
                ranking_scores: metadata.scoringDetails || [],
                expires_in_hours: metadata.expiresInHours || 24
            };

            const response = await fetch(`${this.apiUrl}${this.cacheEndpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                console.error(`Cache save error: ${response.status}`);
                return null;
            }

            const data = await response.json();

            if (data.success && data.data) {
                return {
                    id: data.data.id,
                    keyword: data.data.keyword,
                    hitCounter: data.data.hit_counter,
                    createdAt: data.data.created_at,
                    expiresAt: data.data.expires_at
                };
            }

            return null;
        } catch (error) {
            console.error('Cache save error:', error.message);
            return null;
        }
    }

    /**
     * Get cache statistics
     * @returns {Promise<Object|null>} - Cache statistics
     */
    async getStats() {
        try {
            const response = await fetch(`${this.apiUrl}${this.cacheEndpoint}/stats`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                console.error(`Cache stats error: ${response.status}`);
                return null;
            }

            const data = await response.json();
            return data.success ? data.data : null;
        } catch (error) {
            console.error('Cache stats error:', error.message);
            return null;
        }
    }
}

export const cacheService = new CacheService();
export default cacheService;
