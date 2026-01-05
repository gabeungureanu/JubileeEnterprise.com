/**
 * Controllers Index
 * Exports all controller modules
 */

const AuthController = require('./AuthController');
const ChatController = require('./ChatController');
const DiscussionBoardController = require('./DiscussionBoardController');
const CommunityController = require('./CommunityController');
const CommunityInboxController = require('./CommunityInboxController');
const PersonaController = require('./PersonaController');
const TranslationController = require('./TranslationController');
const PageController = require('./PageController');
const LogController = require('./LogController');
const HospitalityController = require('./HospitalityController');
const SafeguardController = require('./SafeguardController');
const PlanManagementController = require('./PlanManagementController');

module.exports = {
  AuthController,
  ChatController,
  DiscussionBoardController,
  CommunityController,
  CommunityInboxController,
  PersonaController,
  TranslationController,
  PageController,
  LogController,
  HospitalityController,
  SafeguardController,
  PlanManagementController
};
