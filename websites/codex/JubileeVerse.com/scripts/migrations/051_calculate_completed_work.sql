-- ============================================
-- JubileeVerse Database Schema
-- Migration 051: Calculate Completed Work (AI+Human) Values
-- ============================================
-- Calculates CW+ (Completed Work with AI+Human collaboration)
-- at 90% efficiency rating.
--
-- AI-assisted development dramatically reduces time compared to EHH:
-- - Simple UI tweaks: 0.1-0.3 hours (AI generates code instantly)
-- - Medium features: 0.5-2.0 hours (AI + human review)
-- - Complex services: 2.0-8.0 hours (AI scaffolding + human refinement)
-- - Infrastructure: 5.0-15.0 hours (AI patterns + human integration)
--
-- The ratio of CW+/EHH demonstrates AI productivity multiplier

-- Task 6-14: Simple UI enhancements (label changes, CSS tweaks)
-- Raw: 5-10 min per task -> 0.1-0.2 hours
UPDATE admin_tasks SET completed_work = 0.10 WHERE task_number = 6;  -- Gauge text position
UPDATE admin_tasks SET completed_work = 0.10 WHERE task_number = 7;  -- Font size increase
UPDATE admin_tasks SET completed_work = 0.10 WHERE task_number = 8;  -- Label rename
UPDATE admin_tasks SET completed_work = 0.10 WHERE task_number = 9;  -- Label rename
UPDATE admin_tasks SET completed_work = 0.10 WHERE task_number = 10; -- Add last name
UPDATE admin_tasks SET completed_work = 0.15 WHERE task_number = 11; -- Sync styling
UPDATE admin_tasks SET completed_work = 0.10 WHERE task_number = 12; -- Position link
UPDATE admin_tasks SET completed_work = 0.10 WHERE task_number = 13; -- Move control
UPDATE admin_tasks SET completed_work = 0.20 WHERE task_number = 14; -- Fix billing toggle

-- Task 15-40: Database schema design and implementation
-- AI generates SQL quickly, human reviews structure
UPDATE admin_tasks SET completed_work = 0.80 WHERE task_number = 15; -- User auth schema
UPDATE admin_tasks SET completed_work = 1.00 WHERE task_number = 16; -- Persona schema
UPDATE admin_tasks SET completed_work = 0.80 WHERE task_number = 17; -- Conversation schema
UPDATE admin_tasks SET completed_work = 0.80 WHERE task_number = 18; -- Translation schema
UPDATE admin_tasks SET completed_work = 1.20 WHERE task_number = 19; -- Analytics schema
UPDATE admin_tasks SET completed_work = 1.00 WHERE task_number = 20; -- Admin config
UPDATE admin_tasks SET completed_work = 1.50 WHERE task_number = 21; -- Discussion boards
UPDATE admin_tasks SET completed_work = 0.80 WHERE task_number = 22; -- Community schema
UPDATE admin_tasks SET completed_work = 1.50 WHERE task_number = 23; -- Teams & invitations
UPDATE admin_tasks SET completed_work = 0.80 WHERE task_number = 24; -- Community inbox
UPDATE admin_tasks SET completed_work = 1.50 WHERE task_number = 25; -- Subscription schema
UPDATE admin_tasks SET completed_work = 2.20 WHERE task_number = 26; -- Billing & payments
UPDATE admin_tasks SET completed_work = 2.00 WHERE task_number = 27; -- Hospitality core
UPDATE admin_tasks SET completed_work = 1.50 WHERE task_number = 28; -- Hospitality cockpit
UPDATE admin_tasks SET completed_work = 0.80 WHERE task_number = 29; -- Hospitality rules ext
UPDATE admin_tasks SET completed_work = 0.80 WHERE task_number = 30; -- Plan features
UPDATE admin_tasks SET completed_work = 0.80 WHERE task_number = 31; -- Plan translations
UPDATE admin_tasks SET completed_work = 1.20 WHERE task_number = 32; -- Admin tasks core
UPDATE admin_tasks SET completed_work = 1.20 WHERE task_number = 33; -- Task workflow
UPDATE admin_tasks SET completed_work = 1.20 WHERE task_number = 34; -- QA tests system
UPDATE admin_tasks SET completed_work = 0.80 WHERE task_number = 35; -- Task work history
UPDATE admin_tasks SET completed_work = 0.80 WHERE task_number = 36; -- Task hierarchy
UPDATE admin_tasks SET completed_work = 1.20 WHERE task_number = 37; -- Dashboard metrics
UPDATE admin_tasks SET completed_work = 1.20 WHERE task_number = 38; -- Daily progress
UPDATE admin_tasks SET completed_work = 1.50 WHERE task_number = 39; -- Operational health
UPDATE admin_tasks SET completed_work = 0.80 WHERE task_number = 40; -- Precise metrics

-- Task 41-57: Backend services (complex business logic)
-- AI scaffolds structure, human integrates and refines
UPDATE admin_tasks SET completed_work = 6.00 WHERE task_number = 41; -- AIService (complex API integration)
UPDATE admin_tasks SET completed_work = 2.00 WHERE task_number = 42; -- AuthService
UPDATE admin_tasks SET completed_work = 4.00 WHERE task_number = 43; -- ConversationService
UPDATE admin_tasks SET completed_work = 7.50 WHERE task_number = 44; -- DiscussionBoardService (largest)
UPDATE admin_tasks SET completed_work = 2.50 WHERE task_number = 45; -- PersonaService
UPDATE admin_tasks SET completed_work = 4.00 WHERE task_number = 46; -- HospitalityService
UPDATE admin_tasks SET completed_work = 3.50 WHERE task_number = 47; -- HospitalityRuleEngine
UPDATE admin_tasks SET completed_work = 4.50 WHERE task_number = 48; -- HospitalityCockpitService
UPDATE admin_tasks SET completed_work = 1.20 WHERE task_number = 49; -- CommunityService
UPDATE admin_tasks SET completed_work = 2.50 WHERE task_number = 50; -- CommunityInboxService
UPDATE admin_tasks SET completed_work = 3.00 WHERE task_number = 51; -- TranslationService
UPDATE admin_tasks SET completed_work = 3.20 WHERE task_number = 52; -- PlanTranslationService
UPDATE admin_tasks SET completed_work = 1.20 WHERE task_number = 53; -- MessageTranslationService
UPDATE admin_tasks SET completed_work = 2.00 WHERE task_number = 54; -- QdrantService
UPDATE admin_tasks SET completed_work = 1.50 WHERE task_number = 55; -- AttachmentService
UPDATE admin_tasks SET completed_work = 0.80 WHERE task_number = 56; -- TokenUsageService
UPDATE admin_tasks SET completed_work = 2.20 WHERE task_number = 57; -- AdminTaskService

-- Task 58-67: API modules (CRUD + business rules)
UPDATE admin_tasks SET completed_work = 2.20 WHERE task_number = 58; -- Auth API
UPDATE admin_tasks SET completed_work = 6.00 WHERE task_number = 59; -- Chat API (streaming, complex)
UPDATE admin_tasks SET completed_work = 2.00 WHERE task_number = 60; -- Personas API
UPDATE admin_tasks SET completed_work = 5.00 WHERE task_number = 61; -- Discussion Boards API
UPDATE admin_tasks SET completed_work = 4.50 WHERE task_number = 62; -- Communities API
UPDATE admin_tasks SET completed_work = 3.50 WHERE task_number = 63; -- Translation API
UPDATE admin_tasks SET completed_work = 5.50 WHERE task_number = 64; -- Billing API (payment critical)
UPDATE admin_tasks SET completed_work = 5.00 WHERE task_number = 65; -- Hospitality API
UPDATE admin_tasks SET completed_work = 7.50 WHERE task_number = 66; -- Admin API (comprehensive)
UPDATE admin_tasks SET completed_work = 4.00 WHERE task_number = 67; -- Pages API

-- Task 68-87: Frontend pages (HTML, CSS, JS)
-- AI generates markup/styling fast, human polishes UX
UPDATE admin_tasks SET completed_work = 1.50 WHERE task_number = 68; -- Home page
UPDATE admin_tasks SET completed_work = 1.80 WHERE task_number = 69; -- Login page
UPDATE admin_tasks SET completed_work = 1.70 WHERE task_number = 70; -- Registration page
UPDATE admin_tasks SET completed_work = 1.30 WHERE task_number = 71; -- Forgot password
UPDATE admin_tasks SET completed_work = 2.00 WHERE task_number = 72; -- Dashboard
UPDATE admin_tasks SET completed_work = 3.00 WHERE task_number = 73; -- Chat (interactive, SSE)
UPDATE admin_tasks SET completed_work = 1.80 WHERE task_number = 74; -- Conversations
UPDATE admin_tasks SET completed_work = 2.00 WHERE task_number = 75; -- Personas
UPDATE admin_tasks SET completed_work = 1.50 WHERE task_number = 76; -- Profile
UPDATE admin_tasks SET completed_work = 2.20 WHERE task_number = 77; -- Translation
UPDATE admin_tasks SET completed_work = 1.70 WHERE task_number = 78; -- Settings
UPDATE admin_tasks SET completed_work = 2.50 WHERE task_number = 79; -- Community
UPDATE admin_tasks SET completed_work = 2.80 WHERE task_number = 80; -- Spaces
UPDATE admin_tasks SET completed_work = 1.00 WHERE task_number = 81; -- Hospitality
UPDATE admin_tasks SET completed_work = 1.50 WHERE task_number = 82; -- Search
UPDATE admin_tasks SET completed_work = 2.20 WHERE task_number = 83; -- Payment (Stripe)
UPDATE admin_tasks SET completed_work = 1.30 WHERE task_number = 84; -- Plans
UPDATE admin_tasks SET completed_work = 0.90 WHERE task_number = 85; -- About
UPDATE admin_tasks SET completed_work = 1.10 WHERE task_number = 86; -- Features
UPDATE admin_tasks SET completed_work = 0.70 WHERE task_number = 87; -- Error pages

-- Task 88-92: Admin pages (complex UI, data management)
UPDATE admin_tasks SET completed_work = 1.80 WHERE task_number = 88; -- Admin Dashboard
UPDATE admin_tasks SET completed_work = 2.50 WHERE task_number = 89; -- Admin Tasks
UPDATE admin_tasks SET completed_work = 2.20 WHERE task_number = 90; -- Admin Hospitality
UPDATE admin_tasks SET completed_work = 3.00 WHERE task_number = 91; -- Admin Cockpit
UPDATE admin_tasks SET completed_work = 1.80 WHERE task_number = 92; -- Admin Rules

-- Task 93-97: Frontend components (reusable partials)
UPDATE admin_tasks SET completed_work = 0.70 WHERE task_number = 93; -- Header partial
UPDATE admin_tasks SET completed_work = 0.90 WHERE task_number = 94; -- Sidebar partial
UPDATE admin_tasks SET completed_work = 0.60 WHERE task_number = 95; -- Admin Header
UPDATE admin_tasks SET completed_work = 0.70 WHERE task_number = 96; -- Admin Sidebar
UPDATE admin_tasks SET completed_work = 0.40 WHERE task_number = 97; -- Footer partial

-- Task 98-104: Infrastructure & architecture
UPDATE admin_tasks SET completed_work = 2.40 WHERE task_number = 98;  -- CSS architecture
UPDATE admin_tasks SET completed_work = 3.00 WHERE task_number = 99;  -- JS modules
UPDATE admin_tasks SET completed_work = 3.00 WHERE task_number = 100; -- Queue system
UPDATE admin_tasks SET completed_work = 1.50 WHERE task_number = 101; -- Cache system
UPDATE admin_tasks SET completed_work = 2.00 WHERE task_number = 102; -- Observability
UPDATE admin_tasks SET completed_work = 25.00 WHERE task_number = 103; -- Models (771 EHH - massive)
UPDATE admin_tasks SET completed_work = 3.50 WHERE task_number = 104; -- Testing infrastructure
