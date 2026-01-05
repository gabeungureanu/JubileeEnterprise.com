#!/usr/bin/env node
const { Pool } = require('pg');
require('dotenv').config();

// CW+ hours - actual time spent with AI assistance
// Estimated from file timestamps: work span ~6:28 PM to 7:01 PM = ~33 min active coding
// Plus discussion, research, and testing time = ~1.5 hours total
const CW_PLUS_HOURS = 1.5; // Estimated from session activity timestamps

// EHH estimate - how long a skilled human without AI would take
const EHH_HOURS = 48; // Based on: Frontend page (complex with state) 24-48 hours

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'jubileeverse'
});

async function addTask() {
  // Get next task number
  const taskNumResult = await pool.query('SELECT COALESCE(MAX(task_number), 0) + 1 as next_num FROM admin_tasks');
  const taskNumber = taskNumResult.rows[0].next_num;

  // Create the task with correct column names
  const result = await pool.query(`
    INSERT INTO admin_tasks (
      task_number,
      title,
      description,
      task_type,
      priority,
      component,
      status,
      effort_hours,
      frozen_ehh,
      frozen_cw_plus,
      notes,
      completed_at,
      created_at,
      updated_at
    ) VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      'completed',
      $7,
      $7,
      $8,
      $9,
      NOW(),
      NOW(),
      NOW()
    ) RETURNING id, task_number
  `, [
    taskNumber,
    'Tree expansion and alignment logic redesign - admin-collections.html',
    'Redesigned the JubileeVerse collections tree expansion system to be automated, consistent, and data-driven. Removed special-case handling for individual collections and created a unified approach that works for all 35 collections.',
    'development',
    'high',
    'admin',
    EHH_HOURS,
    CW_PLUS_HOURS,
    `## Work Completed

### Created Unified Loading System
- loadCollectionCategoriesIntoPanel(container, collectionSlug, collectionId) - works for ANY collection
- Fetches categories from /api/admin/collections/:slug/categories
- Falls back to getSubcategoriesForCollection() when no database categories exist

### Added Slugs to All Collections
- Every collection in loadDemoCollections() now has a slug property
- Added getCollectionById() helper function

### Removed Special-Case Handling
- Replaced a4 (Inspire Family) special case with generic handling for ALL collections
- Auto-load on page refresh now works for ANY expanded collection

### Created Supporting Functions
- getSectionIdForCollection(collection)
- renderCollectionPanelCategories() - renders database categories
- renderFallbackSubcategories() - renders hardcoded categories when DB has no data
- attachCollectionPanelHandlers() - attaches event handlers for database-loaded categories
- attachFallbackCategoryHandlers() - attaches event handlers for fallback categories

### Simplified Initial Rendering
- Collection items render with empty subcategories container
- Categories loaded dynamically ONLY when user expands a collection

### Consistent Plus Icon Rendering
- All collections show plus (+) expand icon consistently
- Icon is data-driven, not based on collection names

## EHH Estimation (Traditional)
- Frontend page (complex with state management): 24-48 hours
- Research and investigation of existing code: 4-8 hours
- Testing across all 35 collections: 4-8 hours
- Total: ~40-60 hours (using median: 48 hours)

## Metrics
- CW+ (Actual hours with AI): ${CW_PLUS_HOURS} hours
- EHH (Human equivalent hours): ${EHH_HOURS} hours
- Work Efficiency: ${Math.round((EHH_HOURS / CW_PLUS_HOURS) * 100)}%`
  ]);

  console.log(`Created task JV-${String(taskNumber).padStart(3, '0')}: Tree expansion and alignment logic redesign`);
  console.log(`EHH: ${EHH_HOURS} hours, CW+: ${CW_PLUS_HOURS} hours`);

  await pool.end();
}

addTask().catch(err => {
  console.error('Error:', err);
  pool.end();
});
