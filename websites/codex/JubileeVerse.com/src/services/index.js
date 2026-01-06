/**
 * Services Index
 * Exports all service modules
 */

const AIService = require('./AIService');
const AttachmentService = require('./AttachmentService');
const AuthService = require('./AuthService');
const ConversationService = require('./ConversationService');
const DiscussionBoardService = require('./DiscussionBoardService');
const CommunityService = require('./CommunityService');
const CommunityInboxService = require('./CommunityInboxService');
const PersonaService = require('./PersonaService');
const TranslationService = require('./TranslationService');
const MessageTranslationService = require('./MessageTranslationService');
const HospitalityService = require('./HospitalityService');
const HospitalityRuleEngine = require('./HospitalityRuleEngine');
const HospitalityCockpitService = require('./HospitalityCockpitService');
const PlanTranslationService = require('./PlanTranslationService');
const AdminTaskService = require('./AdminTaskService');
const ConversationAnalysisService = require('./ConversationAnalysisService');
const SafeguardService = require('./SafeguardService');
const PlanManagementService = require('./PlanManagementService');

module.exports = {
  AIService,
  AttachmentService,
  AuthService,
  ConversationService,
  DiscussionBoardService,
  CommunityService,
  CommunityInboxService,
  PersonaService,
  TranslationService,
  MessageTranslationService,
  HospitalityService,
  HospitalityRuleEngine,
  HospitalityCockpitService,
  PlanTranslationService,
  AdminTaskService,
  ConversationAnalysisService,
  SafeguardService,
  PlanManagementService
};
