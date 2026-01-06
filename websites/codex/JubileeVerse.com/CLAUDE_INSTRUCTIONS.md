# Claude Code Instructions for JubileeVerse

## CRITICAL: Work Tracking Protocol

### Trigger Phrases That REQUIRE Task Recording

When the user says ANY of these phrases, you MUST:
1. Stop and verify work has been tracked
2. Create a new task record if not already tracked
3. Confirm the task metrics with the user

**Trigger phrases:**
- "I'm done with..."
- "Done with this page"
- "That's complete"
- "Finished with..."
- "All done"
- "Task complete"
- "Work is done"
- "Let's move on"
- "That's it for now"
- "Wrapping up"

### Task Recording Checklist

Before acknowledging completion, verify:

- [ ] Task title clearly describes work done
- [ ] EHH (Estimated Human Hours) - how long would a human take WITHOUT AI?
- [ ] CW+ (Completed Work) - actual hours spent WITH AI assistance
- [ ] Task is inserted into `admin_tasks` table with status='completed'
- [ ] Frozen EHH and CW+ values are set
- [ ] Dashboard totals updated

### EHH Estimation Guidelines

| Work Type | Typical EHH Range |
|-----------|-------------------|
| Simple bug fix | 2-8 hours |
| UI component update | 8-24 hours |
| Complex UI with animations | 24-48 hours |
| New API endpoint | 8-16 hours |
| Database migration (simple) | 4-16 hours |
| Database migration (complex) | 24-60 hours |
| Full service implementation | 40-120 hours |
| Major feature | 80-200 hours |

### CW+ Estimation

CW+ is the ACTUAL time spent with AI assistance. This is typically:
- 1-3 hours for small tasks
- 2-6 hours for medium tasks
- 4-12 hours for large features

### Quick Task Creation

Run this to create a task record:
```bash
node scripts/complete-work-session.js
```

Or create programmatically:
```javascript
// In scripts/create-task.js format
const task = {
  title: 'Description of work',
  description: 'Detailed breakdown of what was done',
  task_type: 'enhancement', // development, enhancement, bug, operational
  priority: 'high',
  effort_hours: 32,  // EHH
  completed_work: 1.5  // CW+
};
```

## Session Workflow

### At Start of Work
1. Note what task is being worked on
2. Consider creating a pending task record

### During Work
1. Use TodoWrite to track progress
2. Keep mental note of time spent (CW+)

### At End of Work (CRITICAL)
1. **BEFORE** saying "done" or acknowledging completion:
   - Create task record with EHH and CW+
   - Verify database totals updated
   - Confirm with user

## Database Commands

Check current totals:
```bash
node scripts/test-dashboard-api.js
```

Check specific tasks:
```bash
node scripts/check-dashboard-tasks.js
```

Create missing tasks:
```bash
node scripts/create-missing-tasks.js
```
