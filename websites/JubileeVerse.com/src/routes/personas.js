/**
 * Persona routes
 * Delegates to PersonaController and PageController for request handling
 */

const express = require('express');
const router = express.Router();
const { PersonaController, PageController } = require('../controllers');
const { requireAuth } = require('../middleware');

// Page route
router.get('/', PageController.personas);

// API endpoints
router.get('/list', PersonaController.getAllPersonas);
router.get('/featured', PersonaController.getFeaturedPersonas);
router.get('/categories', PersonaController.getCategories);
router.get('/category/:category', PersonaController.getByCategory);
router.get('/search', PersonaController.searchPersonas);
router.get('/slug/:slug', PersonaController.getPersonaBySlug);

// Start conversation with persona (redirect)
router.get('/:id/start', requireAuth, (req, res) => {
  const { id } = req.params;
  res.redirect(`/chat?persona=${id}&new=true`);
});

// Get specific persona (must be after other routes to avoid conflicts)
router.get('/:id', PersonaController.getPersonaById);

module.exports = router;
