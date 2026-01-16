/**
 * RankingService.js
 *
 * Service for ranking search results by combining:
 * - Relevance score (query term matches)
 * - Sentiment score (positive language)
 * - Source position bonus (original search engine rank)
 */

import config from '../config/index.js';
import sentimentAnalyzer from '../utils/SentimentAnalyzer.js';

class RankingService {
    constructor() {
        // Default weights from config or fallback
        this.weights = {
            relevance: config.ranking?.relevanceWeight || 0.6,
            sentiment: config.ranking?.sentimentWeight || 0.3,
            position: config.ranking?.positionWeight || 0.1
        };
    }

    /**
     * Calculate relevance score based on query term matches
     * @param {Object} result - Search result
     * @param {string} query - Original search query
     * @returns {number} - Relevance score (0-1)
     */
    calculateRelevanceScore(result, query) {
        if (!query) return 0;

        const queryTerms = query.toLowerCase()
            .split(/\s+/)
            .filter(term => term.length > 2);

        if (queryTerms.length === 0) return 0;

        const title = (result.title || '').toLowerCase();
        const snippet = (result.snippet || '').toLowerCase();
        const url = (result.url || '').toLowerCase();

        let matchScore = 0;
        let termMatchCount = 0;

        for (const term of queryTerms) {
            // Title matches (highest value)
            if (title.includes(term)) {
                matchScore += 0.4;
                termMatchCount++;
            }

            // Snippet matches
            if (snippet.includes(term)) {
                matchScore += 0.3;
                termMatchCount++;
            }

            // URL matches (domain relevance)
            if (url.includes(term)) {
                matchScore += 0.2;
                termMatchCount++;
            }
        }

        // Exact phrase match bonus
        const queryLower = query.toLowerCase();
        if (title.includes(queryLower)) {
            matchScore += 0.3;
        }
        if (snippet.includes(queryLower)) {
            matchScore += 0.2;
        }

        // Normalize by number of query terms
        const normalizedScore = matchScore / (queryTerms.length * 1.2);

        return Math.min(1, normalizedScore);
    }

    /**
     * Calculate position score based on original search engine rank
     * Higher positions (1, 2, 3) get higher scores
     * @param {number} position - Original position in search results
     * @param {number} maxPosition - Maximum position considered (default 10)
     * @returns {number} - Position score (0-1)
     */
    calculatePositionScore(position, maxPosition = 10) {
        if (!position || position < 1) return 0.5;

        // Inverse linear: position 1 = 1.0, position 10 = 0.1
        return Math.max(0, 1 - ((position - 1) / maxPosition));
    }

    /**
     * Calculate combined score for a search result
     * @param {Object} result - Search result with sentiment already analyzed
     * @param {string} query - Original search query
     * @returns {Object} - Score breakdown and combined score
     */
    calculateCombinedScore(result, query) {
        const relevanceScore = this.calculateRelevanceScore(result, query);
        const sentimentScore = result.sentiment?.score || sentimentAnalyzer.analyzeSearchResult(result).score;
        const positionScore = this.calculatePositionScore(result.position);

        const combinedScore =
            (relevanceScore * this.weights.relevance) +
            (sentimentScore * this.weights.sentiment) +
            (positionScore * this.weights.position);

        return {
            combined: combinedScore,
            relevance: relevanceScore,
            sentiment: sentimentScore,
            position: positionScore,
            weights: this.weights
        };
    }

    /**
     * Rank and deduplicate search results from multiple engines
     * @param {Array<Object>} results - Array of search results from all engines
     * @param {string} query - Original search query
     * @param {number} limit - Maximum results to return (default 10)
     * @returns {Object} - Ranked results with scoring details
     */
    rankResults(results, query, limit = 10) {
        if (!results || results.length === 0) {
            return {
                results: [],
                totalProcessed: 0,
                duplicatesRemoved: 0,
                scoringDetails: []
            };
        }

        // First, add sentiment analysis to all results
        const resultsWithSentiment = sentimentAnalyzer.analyzeResults(results);

        // Deduplicate by URL (keep first occurrence, which maintains original engine position)
        const seenUrls = new Set();
        const uniqueResults = [];
        let duplicatesRemoved = 0;

        for (const result of resultsWithSentiment) {
            const normalizedUrl = this.normalizeUrl(result.url);
            if (!seenUrls.has(normalizedUrl)) {
                seenUrls.add(normalizedUrl);
                uniqueResults.push(result);
            } else {
                duplicatesRemoved++;
            }
        }

        // Calculate combined scores
        const scoredResults = uniqueResults.map(result => {
            const scores = this.calculateCombinedScore(result, query);
            return {
                ...result,
                scores
            };
        });

        // Sort by combined score (descending)
        scoredResults.sort((a, b) => b.scores.combined - a.scores.combined);

        // Take top results
        const topResults = scoredResults.slice(0, limit);

        // Prepare scoring details for caching
        const scoringDetails = topResults.map(r => ({
            url: r.url,
            source: r.source,
            scores: r.scores
        }));

        return {
            results: topResults,
            totalProcessed: results.length,
            uniqueCount: uniqueResults.length,
            duplicatesRemoved,
            scoringDetails
        };
    }

    /**
     * Normalize URL for deduplication
     * @param {string} url - URL to normalize
     * @returns {string} - Normalized URL
     */
    normalizeUrl(url) {
        if (!url) return '';

        try {
            const parsed = new URL(url);
            // Remove protocol, www, trailing slash, and common tracking params
            let normalized = parsed.hostname.replace(/^www\./, '') + parsed.pathname;
            normalized = normalized.replace(/\/$/, '').toLowerCase();
            return normalized;
        } catch {
            return url.toLowerCase()
                .replace(/^https?:\/\//, '')
                .replace(/^www\./, '')
                .replace(/\/$/, '');
        }
    }

    /**
     * Update ranking weights
     * @param {Object} newWeights - New weight configuration
     */
    updateWeights(newWeights) {
        this.weights = {
            ...this.weights,
            ...newWeights
        };

        // Ensure weights sum to 1
        const total = this.weights.relevance + this.weights.sentiment + this.weights.position;
        if (Math.abs(total - 1) > 0.01) {
            this.weights.relevance /= total;
            this.weights.sentiment /= total;
            this.weights.position /= total;
        }
    }
}

export const rankingService = new RankingService();
export default rankingService;
