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
  let calendarId;
  if (calRes.rows.length > 0) {
    calendarId = calRes.rows[0].id;
    console.log('Created calendar:', calRes.rows[0].name);
  } else {
    // Get existing calendar
    const existingCal = await client.query(
      'SELECT id FROM outlook_calendars WHERE user_id = $1 AND is_default = true',
      [userId]
    );
    if (existingCal.rows.length > 0) {
      calendarId = existingCal.rows[0].id;
    }
  }

  // 4. Create sample calendar events with rich text descriptions
  if (calendarId) {
    console.log('\n=== Creating Sample Calendar Events ===');

    const sampleEvents = [
      {
        subject: 'Team Standup Meeting',
        location: 'Conference Room A',
        description: '<FlowDocument xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"><Paragraph><Bold>Daily Standup Agenda</Bold></Paragraph><List MarkerStyle="Disc"><ListItem><Paragraph>Review yesterday\'s progress</Paragraph></ListItem><ListItem><Paragraph>Discuss blockers</Paragraph></ListItem><ListItem><Paragraph>Plan for today</Paragraph></ListItem></List><Paragraph><Italic>Please come prepared with updates!</Italic></Paragraph></FlowDocument>',
        description_format: 'xaml',
        start_time: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        end_time: new Date(Date.now() + 24 * 60 * 60 * 1000 + 30 * 60 * 1000), // +30 min
        is_all_day: false,
        is_in_person: true,
        status: 'busy',
        category: 'Business',
        event_color: '#0078D4',
        is_private: false,
        reminder_minutes: 15
      },
      {
        subject: 'Project Planning Session',
        location: 'Virtual - Teams',
        description: '<FlowDocument xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"><Paragraph><Bold>Q1 2026 Project Planning</Bold></Paragraph><Paragraph>We will be discussing the following topics:</Paragraph><List MarkerStyle="Decimal"><ListItem><Paragraph>Budget allocation</Paragraph></ListItem><ListItem><Paragraph>Resource planning</Paragraph></ListItem><ListItem><Paragraph>Timeline milestones</Paragraph></ListItem><ListItem><Paragraph>Risk assessment</Paragraph></ListItem></List><Paragraph/><Paragraph><Underline>Required attendees:</Underline> All team leads</Paragraph></FlowDocument>',
        description_format: 'xaml',
        start_time: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000), // Day after tomorrow 10 AM
        end_time: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000), // +2 hours
        is_all_day: false,
        is_in_person: false,
        status: 'busy',
        category: 'Business',
        event_color: '#5B9BD5',
        is_private: false,
        reminder_minutes: 30
      },
      {
        subject: 'Birthday Celebration - Sarah',
        location: 'Break Room',
        description: 'Celebrating Sarah\'s birthday! Cake and refreshments will be served.',
        description_format: 'plain',
        start_time: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 15 * 60 * 60 * 1000), // 3 days 3 PM
        end_time: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 16 * 60 * 60 * 1000), // +1 hour
        is_all_day: false,
        is_in_person: true,
        status: 'free',
        category: 'Birthday',
        event_color: '#FFBD59',
        is_private: false,
        reminder_minutes: 60
      },
      {
        subject: 'Annual Review',
        location: 'HR Office',
        description: '<FlowDocument xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"><Paragraph><Bold>Annual Performance Review</Bold></Paragraph><Paragraph>Please prepare the following documents:</Paragraph><List MarkerStyle="Disc"><ListItem><Paragraph>Self-assessment form</Paragraph></ListItem><ListItem><Paragraph>Goals achieved this year</Paragraph></ListItem><ListItem><Paragraph>Professional development activities</Paragraph></ListItem></List></FlowDocument>',
        description_format: 'xaml',
        start_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000), // 1 week 2 PM
        end_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 15 * 60 * 60 * 1000), // +1 hour
        is_all_day: false,
        is_in_person: true,
        status: 'busy',
        category: 'Personal',
        event_color: '#107C10',
        is_private: true,
        reminder_minutes: 1440 // 1 day
      },
      {
        subject: 'Company Holiday',
        location: '',
        description: 'Office closed for holiday observance.',
        description_format: 'plain',
        start_time: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 2 weeks
        end_time: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000 + 24 * 60 * 60 * 1000), // All day
        is_all_day: true,
        is_in_person: false,
        status: 'outOfOffice',
        category: 'Holiday',
        event_color: '#D13438',
        is_private: false,
        reminder_minutes: null
      }
    ];

    for (const event of sampleEvents) {
      try {
        const eventRes = await client.query(
          `INSERT INTO outlook_calendar_events
           (calendar_id, user_id, subject, location, description, description_format,
            start_time, end_time, is_all_day, is_in_person, status, category,
            event_color, is_private, reminder_minutes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           ON CONFLICT DO NOTHING
           RETURNING id, subject`,
          [calendarId, userId, event.subject, event.location, event.description,
           event.description_format, event.start_time, event.end_time, event.is_all_day,
           event.is_in_person, event.status, event.category, event.event_color,
           event.is_private, event.reminder_minutes]
        );
        if (eventRes.rows.length > 0) {
          console.log('Created event:', eventRes.rows[0].subject);
        }
      } catch (err) {
        console.log('Skipping event (may already exist or column missing):', event.subject, '-', err.message);
      }
    }
  }

  // 5. Verify counts
  console.log('\n=== Verification ===');
  const folderCounts = await client.query(
    'SELECT name, unread_count, total_count FROM outlook_email_folders WHERE user_id = $1 ORDER BY display_order',
    [userId]
  );
  console.log('Folder counts:');
  folderCounts.rows.forEach(f => console.log(`  ${f.name}: ${f.total_count} total, ${f.unread_count} unread`));

  const emailCount = await client.query('SELECT COUNT(*) FROM outlook_email_messages');
  console.log('\nTotal emails in database:', emailCount.rows[0].count);

  // Calendar event counts
  try {
    const eventCount = await client.query('SELECT COUNT(*) FROM outlook_calendar_events');
    console.log('Total calendar events:', eventCount.rows[0].count);

    const richTextEvents = await client.query(
      "SELECT COUNT(*) FROM outlook_calendar_events WHERE description_format = 'xaml'"
    );
    console.log('Events with rich text (XAML) descriptions:', richTextEvents.rows[0].count);
  } catch (err) {
    console.log('Could not count events (table or column may not exist):', err.message);
  }

  await client.end();
  console.log('\nDatabase seeding completed!');
}

seedDatabase().catch(err => {
  console.error('Error:', err.message);
  console.error(err.stack);
  client.end();
});
