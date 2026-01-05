-- Migration: Add Email Verification task from TODO.md

INSERT INTO admin_tasks (
  id, task_number, title, description, task_type, priority, status, component,
  created_at, updated_at
)
SELECT
  gen_random_uuid(),
  COALESCE(MAX(task_number), 0) + 1,
  'Email verification for new user registrations',
  'Implement email verification flow for new user registrations. Users should receive a verification email upon registration and must verify their email before accessing full platform features.',
  'development',
  'high',
  'submitted',
  'auth',
  NOW(),
  NOW()
FROM admin_tasks;
