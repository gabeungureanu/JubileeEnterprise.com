-- ============================================
-- JubileeVerse Database Schema
-- Migration 049: Accurate EHH for Submitted Tasks
-- ============================================
-- Updates submitted tasks with accurate Est. Human-Only Hours (EHH)
-- based on realistic scope assessment at 70% efficiency rating.
-- EHH represents the time a human developer would need to complete
-- each task working at typical professional productivity.

-- Task 105: Mobile responsive audit
-- Scope: Review all pages for mobile issues, document findings, prioritize fixes
-- Raw estimate: 12 hours -> EHH: 12 / 0.7 = 17.1 hours
UPDATE admin_tasks SET effort_hours = 17.1 WHERE task_number = 105;

-- Task 106: PWA implementation
-- Scope: Service worker, manifest, offline support, install prompts
-- Raw estimate: 24 hours -> EHH: 24 / 0.7 = 34.3 hours
UPDATE admin_tasks SET effort_hours = 34.3 WHERE task_number = 106;

-- Task 107: Touch gesture support
-- Scope: Swipe navigation, pinch-zoom, pull-to-refresh across app
-- Raw estimate: 16 hours -> EHH: 16 / 0.7 = 22.9 hours
UPDATE admin_tasks SET effort_hours = 22.9 WHERE task_number = 107;

-- Task 108: Frontend bundle optimization
-- Scope: Webpack analysis, code splitting, tree shaking, lazy loading
-- Raw estimate: 20 hours -> EHH: 20 / 0.7 = 28.6 hours
UPDATE admin_tasks SET effort_hours = 28.6 WHERE task_number = 108;

-- Task 109: Image optimization pipeline
-- Scope: WebP conversion, responsive images, lazy loading, CDN integration
-- Raw estimate: 14 hours -> EHH: 14 / 0.7 = 20.0 hours
UPDATE admin_tasks SET effort_hours = 20.0 WHERE task_number = 109;

-- Task 110: Database query optimization
-- Scope: Query analysis, indexing strategy, N+1 fixes, connection pooling
-- Raw estimate: 24 hours -> EHH: 24 / 0.7 = 34.3 hours
UPDATE admin_tasks SET effort_hours = 34.3 WHERE task_number = 110;

-- Task 111: API response time optimization
-- Scope: Caching layer, response compression, pagination, batching
-- Raw estimate: 18 hours -> EHH: 18 / 0.7 = 25.7 hours
UPDATE admin_tasks SET effort_hours = 25.7 WHERE task_number = 111;

-- Task 112: Security audit - Authentication
-- Scope: Comprehensive auth review, token handling, session management, MFA
-- Raw estimate: 32 hours -> EHH: 32 / 0.7 = 45.7 hours
UPDATE admin_tasks SET effort_hours = 45.7 WHERE task_number = 112;

-- Task 113: Security audit - Input validation
-- Scope: XSS prevention, SQL injection, CSRF, input sanitization across all endpoints
-- Raw estimate: 28 hours -> EHH: 28 / 0.7 = 40.0 hours
UPDATE admin_tasks SET effort_hours = 40.0 WHERE task_number = 113;

-- Task 114: Content Security Policy
-- Scope: CSP headers, nonce implementation, script/style allowlisting
-- Raw estimate: 10 hours -> EHH: 10 / 0.7 = 14.3 hours
UPDATE admin_tasks SET effort_hours = 14.3 WHERE task_number = 114;

-- Task 115: Streaming response improvements
-- Scope: SSE optimization, chunked transfer, backpressure handling
-- Raw estimate: 16 hours -> EHH: 16 / 0.7 = 22.9 hours
UPDATE admin_tasks SET effort_hours = 22.9 WHERE task_number = 115;

-- Task 116: Multi-persona conversation UI
-- Scope: UI for switching personas, conversation context, persona indicators
-- Raw estimate: 20 hours -> EHH: 20 / 0.7 = 28.6 hours
UPDATE admin_tasks SET effort_hours = 28.6 WHERE task_number = 116;

-- Task 117: Voice input support
-- Scope: Web Speech API, transcription, noise cancellation, mobile support
-- Raw estimate: 24 hours -> EHH: 24 / 0.7 = 34.3 hours
UPDATE admin_tasks SET effort_hours = 34.3 WHERE task_number = 117;

-- Task 118: Voice output support
-- Scope: Text-to-speech, voice selection, playback controls, queue management
-- Raw estimate: 20 hours -> EHH: 20 / 0.7 = 28.6 hours
UPDATE admin_tasks SET effort_hours = 28.6 WHERE task_number = 118;

-- Task 119: Conversation export
-- Scope: PDF/Markdown/JSON export, formatting, download UI
-- Raw estimate: 8 hours -> EHH: 8 / 0.7 = 11.4 hours
UPDATE admin_tasks SET effort_hours = 11.4 WHERE task_number = 119;

-- Task 120: Community moderation tools
-- Scope: Report system, ban/mute, content review queue, moderation logs
-- Raw estimate: 32 hours -> EHH: 32 / 0.7 = 45.7 hours
UPDATE admin_tasks SET effort_hours = 45.7 WHERE task_number = 120;

-- Task 121: Community analytics dashboard
-- Scope: Member metrics, engagement stats, growth trends, activity heatmaps
-- Raw estimate: 24 hours -> EHH: 24 / 0.7 = 34.3 hours
UPDATE admin_tasks SET effort_hours = 34.3 WHERE task_number = 121;

-- Task 122: Community notifications
-- Scope: Email digests, push notifications, in-app notifications, preferences
-- Raw estimate: 20 hours -> EHH: 20 / 0.7 = 28.6 hours
UPDATE admin_tasks SET effort_hours = 28.6 WHERE task_number = 122;

-- Task 123: Usage-based billing implementation
-- Scope: Token counting, usage tracking, billing calculations, overage handling
-- Raw estimate: 40 hours -> EHH: 40 / 0.7 = 57.1 hours
UPDATE admin_tasks SET effort_hours = 57.1 WHERE task_number = 123;

-- Task 124: Subscription upgrade/downgrade flow
-- Scope: Plan comparison, proration, payment method changes, confirmation
-- Raw estimate: 28 hours -> EHH: 28 / 0.7 = 40.0 hours
UPDATE admin_tasks SET effort_hours = 40.0 WHERE task_number = 124;

-- Task 125: Invoice customization
-- Scope: Invoice templates, branding, line items, PDF generation
-- Raw estimate: 16 hours -> EHH: 16 / 0.7 = 22.9 hours
UPDATE admin_tasks SET effort_hours = 22.9 WHERE task_number = 125;

-- Task 126: Admin user management
-- Scope: CRUD operations, role assignment, bulk actions, audit logging
-- Raw estimate: 24 hours -> EHH: 24 / 0.7 = 34.3 hours
UPDATE admin_tasks SET effort_hours = 34.3 WHERE task_number = 126;

-- Task 127: System backup automation
-- Scope: Scheduled backups, retention policies, restore testing, monitoring
-- Raw estimate: 20 hours -> EHH: 20 / 0.7 = 28.6 hours
UPDATE admin_tasks SET effort_hours = 28.6 WHERE task_number = 127;

-- Task 128: Deployment automation
-- Scope: CI/CD pipeline, environment configs, rollback procedures, health checks
-- Raw estimate: 32 hours -> EHH: 32 / 0.7 = 45.7 hours
UPDATE admin_tasks SET effort_hours = 45.7 WHERE task_number = 128;

-- Task 129: Error alerting system
-- Scope: Error aggregation, alert rules, PagerDuty/Slack integration, escalation
-- Raw estimate: 16 hours -> EHH: 16 / 0.7 = 22.9 hours
UPDATE admin_tasks SET effort_hours = 22.9 WHERE task_number = 129;

-- Task 130: API documentation
-- Scope: OpenAPI spec, endpoint docs, examples, authentication guide
-- Raw estimate: 24 hours -> EHH: 24 / 0.7 = 34.3 hours
UPDATE admin_tasks SET effort_hours = 34.3 WHERE task_number = 130;

-- Task 131: User documentation
-- Scope: Getting started, feature guides, FAQs, video tutorials
-- Raw estimate: 20 hours -> EHH: 20 / 0.7 = 28.6 hours
UPDATE admin_tasks SET effort_hours = 28.6 WHERE task_number = 131;

-- Task 132: Developer documentation
-- Scope: Architecture docs, API reference, contribution guide, SDK examples
-- Raw estimate: 28 hours -> EHH: 28 / 0.7 = 40.0 hours
UPDATE admin_tasks SET effort_hours = 40.0 WHERE task_number = 132;
