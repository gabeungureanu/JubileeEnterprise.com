import { Router } from 'express';
import searchController from '../controllers/SearchController.js';

const router = Router();

// Main search endpoint (internal/ministry content)
router.get('/', (req, res) => searchController.search(req, res));

// Web search endpoint (Google/Yahoo/Bing via SerpAPI with caching)
router.get('/web', (req, res) => searchController.webSearch(req, res));

// Web search statistics
router.get('/web/stats', (req, res) => searchController.webSearchStats(req, res));

// Web search configuration status
router.get('/web/config', (req, res) => searchController.webSearchConfig(req, res));

// Bible-specific search
router.get('/bible', (req, res) => searchController.searchBible(req, res));

// Autocomplete suggestions
router.get('/suggest', (req, res) => searchController.suggest(req, res));

export default router;
