-- Migration: 0003_add_cached_web_searches
-- Description: Add tables for caching web search results from aggregated search engines
-- Created: 2026-01-16

-- ============================================================================
-- CACHED WEB SEARCHES TABLE
-- Stores aggregated and ranked search results from Google, Yahoo, Bing
-- ============================================================================

CREATE TABLE IF NOT EXISTS cached_web_searches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Search keyword/phrase
    keyword VARCHAR(500) NOT NULL,
    keyword_hash VARCHAR(64) NOT NULL,

    -- Cached results (JSONB array of ranked result objects)
    results JSONB NOT NULL,

    -- Hit counter - increments each time this keyword is searched
    hit_counter INTEGER DEFAULT 1,

    -- Metadata
    total_results_fetched INTEGER,
    search_engines_queried JSONB DEFAULT '[]'::jsonb,
    ranking_scores JSONB DEFAULT '[]'::jsonb,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,

    -- Soft delete
    is_active BOOLEAN DEFAULT true,

    -- Unique constraint on keyword hash for fast lookups
    CONSTRAINT unique_keyword_hash UNIQUE (keyword_hash)
);

-- Index for fast hash-based lookups
CREATE INDEX IF NOT EXISTS idx_cached_searches_keyword_hash
    ON cached_web_searches(keyword_hash);

-- Index for finding popular searches
CREATE INDEX IF NOT EXISTS idx_cached_searches_hit_counter
    ON cached_web_searches(hit_counter DESC);

-- Index for cleanup queries (expired/inactive)
CREATE INDEX IF NOT EXISTS idx_cached_searches_expires_at
    ON cached_web_searches(expires_at)
    WHERE expires_at IS NOT NULL;

-- Index for recent searches
CREATE INDEX IF NOT EXISTS idx_cached_searches_created_at
    ON cached_web_searches(created_at DESC);

-- ============================================================================
-- WEB SEARCH ANALYTICS TABLE
-- Tracks individual search events for analytics
-- ============================================================================

CREATE TABLE IF NOT EXISTS web_search_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Reference to cached search
    search_id UUID REFERENCES cached_web_searches(id) ON DELETE SET NULL,

    -- When the search was performed
    searched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Anonymous tracking data
    user_agent VARCHAR(500),
    ip_hash VARCHAR(64),
    session_id VARCHAR(100),

    -- Whether this was a cache hit or fresh search
    was_cache_hit BOOLEAN DEFAULT false
);

-- Index for analytics queries
CREATE INDEX IF NOT EXISTS idx_search_analytics_search_id
    ON web_search_analytics(search_id);

CREATE INDEX IF NOT EXISTS idx_search_analytics_searched_at
    ON web_search_analytics(searched_at DESC);

-- ============================================================================
-- HELPER FUNCTION: Update timestamp on modification
-- ============================================================================

CREATE OR REPLACE FUNCTION update_cached_search_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_update_cached_search_timestamp ON cached_web_searches;
CREATE TRIGGER trigger_update_cached_search_timestamp
    BEFORE UPDATE ON cached_web_searches
    FOR EACH ROW
    EXECUTE FUNCTION update_cached_search_timestamp();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE cached_web_searches IS 'Caches aggregated web search results from Google, Yahoo, Bing';
COMMENT ON COLUMN cached_web_searches.keyword IS 'The original search keyword/phrase';
COMMENT ON COLUMN cached_web_searches.keyword_hash IS 'SHA-256 hash of normalized keyword for fast lookups';
COMMENT ON COLUMN cached_web_searches.results IS 'JSONB array of top 10 ranked search results';
COMMENT ON COLUMN cached_web_searches.hit_counter IS 'Number of times this keyword has been searched';
COMMENT ON COLUMN cached_web_searches.search_engines_queried IS 'Array of search engines used: ["google", "yahoo", "bing"]';
COMMENT ON COLUMN cached_web_searches.ranking_scores IS 'Detailed scoring breakdown for each result';

COMMENT ON TABLE web_search_analytics IS 'Tracks individual search events for analytics and reporting';
