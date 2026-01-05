/**
 * Page Controller
 * Handles HTML page rendering
 */

const path = require('path');
const { PersonaService, TranslationService } = require('../services');
const logger = require('../utils/logger');
const { asyncHandler } = require('../middleware/errorHandler');

const VIEWS_DIR = path.join(__dirname, '../../views/pages');
const ADMIN_VIEWS_DIR = path.join(__dirname, '../../views/admin');

/**
 * Send HTML page from views/pages
 */
function sendPage(res, pageName) {
  res.sendFile(path.join(VIEWS_DIR, `${pageName}.html`));
}

/**
 * Send admin HTML page from views/admin
 */
function sendAdminPage(res, pageName) {
  res.sendFile(path.join(ADMIN_VIEWS_DIR, `${pageName}.html`));
}

/**
 * Home page
 * GET /
 */
const home = asyncHandler(async (req, res) => {
  sendPage(res, 'home');
});

/**
 * Search page
 * GET /search
 */
const search = asyncHandler(async (req, res) => {
  sendPage(res, 'search');
});

/**
 * About page
 * GET /about
 */
const about = asyncHandler(async (req, res) => {
  sendPage(res, 'about');
});

/**
 * Features page
 * GET /features
 */
const features = asyncHandler(async (req, res) => {
  sendPage(res, 'features');
});

/**
 * Test auth pages
 * GET /test-auth
 */
const testAuth = asyncHandler(async (req, res) => {
  sendPage(res, 'test-auth');
});

/**
 * Login page
 * GET /login
 */
const login = asyncHandler(async (req, res) => {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }
  sendPage(res, 'login');
});

/**
 * Register page
 * GET /register
 */
const register = asyncHandler(async (req, res) => {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }
  sendPage(res, 'register');
});

/**
 * Forgot password page
 * GET /forgot-password
 */
const forgotPassword = asyncHandler(async (req, res) => {
  sendPage(res, 'forgot-password');
});

/**
 * Dashboard page (protected)
 * GET /dashboard
 */
const dashboard = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  sendPage(res, 'dashboard');
});

/**
 * Chat page (protected)
 * GET /chat
 */
const chat = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  sendPage(res, 'chat');
});

/**
 * Conversations page (protected)
 * GET /conversations
 */
const conversations = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  sendPage(res, 'conversations');
});

/**
 * Personas listing page
 * GET /personas
 */
const personas = asyncHandler(async (req, res) => {
  sendPage(res, 'personas');
});

/**
 * Single persona page
 * GET /personas/:slug
 * Note: Currently handled by the personas.html modal, but this allows for a dedicated page if needed
 */
const personaDetail = asyncHandler(async (req, res) => {
  // Redirect to personas page with persona preselected
  // The frontend will handle showing the detail modal
  sendPage(res, 'personas');
});

/**
 * Translation page
 * GET /translation
 */
const translation = asyncHandler(async (req, res) => {
  sendPage(res, 'translation');
});

/**
 * Profile page (protected)
 * GET /profile
 */
const profile = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  sendPage(res, 'profile');
});

/**
 * Settings page (protected)
 * GET /settings
 */
const settings = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  sendPage(res, 'settings');
});

/**
 * Audio test page
 * GET /audiotest
 */
const audiotest = asyncHandler(async (req, res) => {
  sendPage(res, 'audiotest');
});

/**
 * Audio test page 02 (blob visualizer)
 * GET /audiotest02
 */
const audiotest02 = asyncHandler(async (req, res) => {
  sendPage(res, 'audiotest02');
});

/**
 * Audio test page 03 (HUD visualizer)
 * GET /audiotest03
 */
const audiotest03 = asyncHandler(async (req, res) => {
  sendPage(res, 'audiotest03');
});

/**
 * Audio test page 04 (Digital ring visualizer)
 * GET /audiotest04
 */
const audiotest04 = asyncHandler(async (req, res) => {
  sendPage(res, 'audiotest04');
});

/**
 * Admin page (protected, admin only)
 * GET /admin
 * Note: Admin pages are served from views/admin/ directory
 */
const admin = asyncHandler(async (req, res) => {
  sendAdminPage(res, 'admin');
});

/**
 * Plans/Pricing page (public)
 * GET /plans
 */
const plans = asyncHandler(async (req, res) => {
  sendPage(res, 'plans');
});

/**
 * Payment Update page (protected)
 * GET /payment-update
 */
const paymentUpdate = asyncHandler(async (req, res) => {
  sendPage(res, 'payment-update');
});

/**
 * Community page (protected)
 * GET /community
 */
const community = asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  sendPage(res, 'community');
});

/**
 * Hospitality page (public - for visitor engagement)
 * GET /hospitality
 */
const hospitality = asyncHandler(async (req, res) => {
  sendPage(res, 'hospitality');
});

/**
 * Admin Hospitality Dashboard (protected, admin only)
 * GET /admin/hospitality
 * Note: Admin pages are served from views/admin/ directory
 */
const adminHospitality = asyncHandler(async (req, res) => {
  sendAdminPage(res, 'admin-hospitality');
});

/**
 * Admin Hospitality Cockpit (protected, admin only)
 * GET /admin/hospitality-cockpit
 * Flight instrument dashboard for situational awareness
 */
const adminHospitalityCockpit = asyncHandler(async (req, res) => {
  sendAdminPage(res, 'admin-hospitality-cockpit');
});

/**
 * Admin Hospitality Rules (protected, admin only)
 * GET /admin/hospitality/rules
 * Three-panel layout for managing hospitality engagement rules
 */
const adminHospitalityRules = asyncHandler(async (req, res) => {
  sendAdminPage(res, 'admin-hospitality-rules');
});

/**
 * Spaces page (public - emotionally safe persona engagement)
 * GET /spaces
 */
const spaces = asyncHandler(async (req, res) => {
  sendPage(res, 'spaces');
});

/**
 * Admin Tasks Dashboard (protected, admin only)
 * GET /admin/tasks
 * Note: Admin pages are served from views/admin/ directory
 */
const adminTasks = asyncHandler(async (req, res) => {
  sendAdminPage(res, 'admin-tasks');
});

/**
 * Admin Personas Management (protected, admin only)
 * GET /admin/personas
 * Three-panel layout for managing persona progression stages
 */
const adminPersonas = asyncHandler(async (req, res) => {
  sendAdminPage(res, 'admin-personas');
});

/**
 * Admin Collections Management (protected, admin only)
 * GET /admin/collections
 * Three-panel layout for managing system collections
 */
const adminCollections = asyncHandler(async (req, res) => {
  sendAdminPage(res, 'admin-collections');
});

/**
 * Admin Launch Control (protected, admin only)
 * GET /admin/launch
 * Space Shuttle launch control visualization
 */
const adminLaunch = asyncHandler(async (req, res) => {
  sendAdminPage(res, 'launch');
});

/**
 * Payment page (protected - immersive payment experience)
 * GET /payment
 */
const payment = asyncHandler(async (req, res) => {
  sendPage(res, 'payment');
});

/**
 * 404 page
 */
const notFound = asyncHandler(async (req, res) => {
  res.status(404);
  sendPage(res, '404');
});

/**
 * 500 page
 */
const serverError = asyncHandler(async (req, res) => {
  res.status(500);
  sendPage(res, '500');
});

module.exports = {
  home,
  search,
  about,
  features,
  testAuth,
  login,
  register,
  forgotPassword,
  dashboard,
  chat,
  conversations,
  personas,
  personaDetail,
  translation,
  profile,
  settings,
  audiotest,
  audiotest02,
  audiotest03,
  audiotest04,
  admin,
  plans,
  payment,
  paymentUpdate,
  community,
  hospitality,
  adminHospitality,
  adminHospitalityCockpit,
  adminHospitalityRules,
  adminTasks,
  adminPersonas,
  adminCollections,
  adminLaunch,
  spaces,
  notFound,
  serverError
};
