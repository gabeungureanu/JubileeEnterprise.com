-- Migration: Add completed task for Genesis ESV migration

INSERT INTO admin_tasks (
  id, task_number, title, description, task_type, priority, status, component,
  completed_at, created_at, updated_at, resolution
)
SELECT
  gen_random_uuid(),
  COALESCE(MAX(task_number), 0) + 1,
  'Genesis ESV Bible verses - Complete book migration',
  'Inserted all 50 chapters (1,533 verses) of Genesis from the ESV translation into the bible_verses table. Created migrations 083-087 for chapters 16-50 and re-ran migrations 080-082 for chapters 1-15. Standardized book_id to lowercase genesis.',
  'development',
  'medium',
  'completed',
  'database',
  NOW(),
  NOW(),
  NOW(),
  'All 50 chapters successfully migrated with section headings. Total: 1,533 verses.'
FROM admin_tasks;
