// Seed script for JubileeOutlook database
// Run with: node seed_outlook_data.js

const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'jubilee_continuum',
  user: 'jubilee',
  password: 'Pass@123'
});

async function seedDatabase() {
  await client.connect();
  console.log('Connected to database');

  // Default user ID for testing
  const userId = '00000000-0000-0000-0000-000000000001';

  // 1. Create email folders
  console.log('\n=== Creating Email Folders ===');

  const folders = [
    { name: 'Inbox', folder_type: 'inbox', icon: 'inbox', display_order: 1, is_system: true },
    { name: 'Sent Items', folder_type: 'sent', icon: 'send', display_order: 2, is_system: true },
    { name: 'Drafts', folder_type: 'drafts', icon: 'drafts', display_order: 3, is_system: true },
    { name: 'Deleted Items', folder_type: 'trash', icon: 'delete', display_order: 4, is_system: true },
    { name: 'Junk Email', folder_type: 'junk', icon: 'report', display_order: 5, is_system: true },
    { name: 'Archive', folder_type: 'archive', icon: 'archive', display_order: 6, is_system: true }
  ];

  const folderIds = {};

  for (const folder of folders) {
    const res = await client.query(
      `INSERT INTO outlook_email_folders (user_id, name, folder_type, icon, display_order, is_system)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING
       RETURNING id, name`,
      [userId, folder.name, folder.folder_type, folder.icon, folder.display_order, folder.is_system]
    );
    if (res.rows.length > 0) {
      folderIds[folder.folder_type] = res.rows[0].id;
      console.log('Created folder:', folder.name, '-', res.rows[0].id);
    }
  }

  // Get folder IDs if they already exist
  const existingFolders = await client.query(
    'SELECT id, folder_type FROM outlook_email_folders WHERE user_id = $1',
    [userId]
  );
  existingFolders.rows.forEach(f => { folderIds[f.folder_type] = f.id; });

  console.log('Folder IDs:', folderIds);

  // 2. Create test emails
  console.log('\n=== Creating Test Emails ===');

  const testEmails = [
    {
      folder_type: 'inbox',
      subject: 'Welcome to JubileeOutlook!',
      body_text: 'Welcome to JubileeOutlook, your new email client. This is a test message to verify that the email system is working correctly. Enjoy using JubileeOutlook!',
      body_preview: 'Welcome to JubileeOutlook, your new email client...',
      sender_email: 'support@jubileeverse.com',
      sender_name: 'Jubilee Support Team',
      is_read: false,
      importance: 'high'
    },
    {
      folder_type: 'inbox',
      subject: 'Meeting Tomorrow at 10 AM',
      body_text: 'Hi there,\n\nJust a reminder that we have a team meeting scheduled for tomorrow at 10 AM. Please come prepared with your weekly updates.\n\nBest regards,\nProject Manager',
      body_preview: 'Just a reminder that we have a team meeting scheduled...',
      sender_email: 'manager@company.com',
      sender_name: 'Project Manager',
      is_read: false,
      importance: 'normal'
    },
    {
      folder_type: 'inbox',
      subject: 'Your Order Has Been Shipped',
      body_text: 'Great news! Your order #12345 has been shipped and is on its way. You can track your package using the tracking number: ABC123XYZ. Expected delivery: 3-5 business days.',
      body_preview: 'Great news! Your order #12345 has been shipped...',
      sender_email: 'orders@store.com',
      sender_name: 'Online Store',
      is_read: true,
      importance: 'normal'
    },
    {
      folder_type: 'inbox',
      subject: 'Weekly Newsletter - Tech Updates',
      body_text: 'This week in tech: New developments in AI, cloud computing trends, and software engineering best practices. Read more inside!',
      body_preview: 'This week in tech: New developments in AI...',
      sender_email: 'newsletter@techweekly.com',
      sender_name: 'Tech Weekly',
      is_read: true,
      importance: 'low'
    },
    {
      folder_type: 'inbox',
      subject: 'Invoice #INV-2026-001',
      body_text: 'Please find attached the invoice for services rendered in January 2026. Payment is due within 30 days. Thank you for your business!',
      body_preview: 'Please find attached the invoice for services...',
      sender_email: 'billing@services.com',
      sender_name: 'Billing Department',
      is_read: false,
      is_flagged: true,
      importance: 'high'
    },
    {
      folder_type: 'inbox',
      subject: 'Collaboration Request',
      body_text: 'Hello,\n\nI would like to discuss a potential collaboration opportunity with your team. Please let me know when you are available for a call.\n\nBest,\nJohn Smith',
      body_preview: 'I would like to discuss a potential collaboration...',
      sender_email: 'john.smith@partner.com',
      sender_name: 'John Smith',
      is_read: false,
      importance: 'normal'
    },
    {
      folder_type: 'sent',
      subject: 'Re: Project Update',
      body_text: 'Thanks for the update. I will review the documents and get back to you by end of day.',
      body_preview: 'Thanks for the update. I will review the documents...',
      sender_email: 'user@jubileeverse.com',
      sender_name: 'Me',
      is_read: true,
      is_sent: true,
      importance: 'normal'
    },
    {
      folder_type: 'sent',
      subject: 'Meeting Confirmation',
      body_text: 'Hi Team,\n\nThis is to confirm our meeting scheduled for next Monday at 2 PM. Please review the agenda attached.\n\nRegards',
      body_preview: 'This is to confirm our meeting scheduled for next Monday...',
      sender_email: 'user@jubileeverse.com',
      sender_name: 'Me',
      is_read: true,
      is_sent: true,
      importance: 'normal'
    },
    {
      folder_type: 'drafts',
      subject: 'Draft: Proposal for New Feature',
      body_text: 'I would like to propose a new feature for the application that will improve user experience significantly...',
      body_preview: 'I would like to propose a new feature...',
      sender_email: 'user@jubileeverse.com',
      sender_name: 'Me',
      is_read: true,
      is_draft: true,
      importance: 'normal'
    }
  ];

  for (const email of testEmails) {
    const folderId = folderIds[email.folder_type];
    if (!folderId) {
      console.log('Skipping email - folder not found:', email.folder_type);
      continue;
    }

    const receivedAt = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);

    const res = await client.query(
      `INSERT INTO outlook_email_messages
       (folder_id, user_id, subject, body_text, body_preview, sender_email, sender_name,
        is_read, is_flagged, is_draft, is_sent, importance, received_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id, subject`,
      [folderId, userId, email.subject, email.body_text, email.body_preview,
       email.sender_email, email.sender_name, email.is_read || false,
       email.is_flagged || false, email.is_draft || false, email.is_sent || false,
       email.importance, receivedAt]
    );
    console.log('Created email:', res.rows[0].subject);
  }

  // 3. Create a default calendar
  console.log('\n=== Creating Default Calendar ===');
  const calRes = await client.query(
    `INSERT INTO outlook_calendars (user_id, name, description, is_default, color)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT DO NOTHING
     RETURNING id, name`,
    [userId, 'My Calendar', 'Default calendar', true, '#0078D4']
  );
  if (calRes.rows.length > 0) {
    console.log('Created calendar:', calRes.rows[0].name);
  }

  // 4. Verify counts
  console.log('\n=== Verification ===');
  const folderCounts = await client.query(
    'SELECT name, unread_count, total_count FROM outlook_email_folders WHERE user_id = $1 ORDER BY display_order',
    [userId]
  );
  console.log('Folder counts:');
  folderCounts.rows.forEach(f => console.log(`  ${f.name}: ${f.total_count} total, ${f.unread_count} unread`));

  const emailCount = await client.query('SELECT COUNT(*) FROM outlook_email_messages');
  console.log('\nTotal emails in database:', emailCount.rows[0].count);

  await client.end();
  console.log('\nDatabase seeding completed!');
}

seedDatabase().catch(err => {
  console.error('Error:', err.message);
  console.error(err.stack);
  client.end();
});
