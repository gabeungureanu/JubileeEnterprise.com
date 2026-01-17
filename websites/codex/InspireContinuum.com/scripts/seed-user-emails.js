#!/usr/bin/env node
/**
 * Seed emails for user: sandeep.agarwal@logixshapers.com
 */

const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'jubilee_continuum',
    user: 'jubilee',
    password: 'Pass@123'
});

const userId = '03c30e74-3fd5-4b91-9fea-07d0b424e350';

async function seedEmails() {
    // Get folder IDs
    const folders = await pool.query(
        'SELECT id, folder_type FROM outlook_email_folders WHERE user_id = $1',
        [userId]
    );

    const folderMap = {};
    folders.rows.forEach(f => { folderMap[f.folder_type] = f.id; });

    console.log('Folder IDs:', folderMap);

    // Inbox emails (6)
    const inboxEmails = [
        {
            subject: 'Q1 2026 Financial Report Ready',
            sender_name: 'Finance Team',
            sender_email: 'finance@jubileeenterprise.com',
            body_preview: 'The Q1 2026 financial report has been finalized and is ready for your review.',
            body_html: '<p>Dear Sandeep,</p><p>The Q1 2026 financial report has been finalized and is ready for your review. Please find the key highlights below:</p><ul><li>Revenue: $2.4M (+15% YoY)</li><li>Operating Margin: 22%</li><li>New Customers: 847</li></ul><p>Best regards,<br/>Finance Team</p>',
            is_read: false
        },
        {
            subject: 'Meeting Reminder: Project Kickoff Tomorrow',
            sender_name: 'Sarah Johnson',
            sender_email: 'sarah.johnson@logixshapers.com',
            body_preview: 'This is a reminder about our project kickoff meeting scheduled for tomorrow at 10 AM.',
            body_html: '<p>Hi Sandeep,</p><p>This is a reminder about our project kickoff meeting scheduled for tomorrow at 10 AM in Conference Room A.</p><p>Agenda:</p><ol><li>Project Overview</li><li>Timeline Discussion</li><li>Resource Allocation</li><li>Q&A</li></ol><p>See you there!</p><p>Sarah</p>',
            is_read: false
        },
        {
            subject: 'New Feature Request: Dashboard Analytics',
            sender_name: 'Product Team',
            sender_email: 'product@jubileeenterprise.com',
            body_preview: 'We have received a new feature request from our enterprise clients for enhanced dashboard analytics.',
            body_html: '<p>Hello Sandeep,</p><p>We have received a new feature request from our enterprise clients for enhanced dashboard analytics. The request includes:</p><ul><li>Real-time data visualization</li><li>Custom report generation</li><li>Export to PDF/Excel</li></ul><p>Please review and provide your feedback.</p><p>Product Team</p>',
            is_read: true
        },
        {
            subject: 'Your Weekly Summary',
            sender_name: 'Jubilee Assistant',
            sender_email: 'assistant@jubileeenterprise.com',
            body_preview: 'Here is your weekly summary for the week of January 13-17, 2026.',
            body_html: '<h2>Weekly Summary</h2><p>Week of January 13-17, 2026</p><ul><li><strong>Emails Received:</strong> 47</li><li><strong>Meetings Attended:</strong> 8</li><li><strong>Tasks Completed:</strong> 12</li><li><strong>Documents Reviewed:</strong> 5</li></ul><p>Keep up the great work!</p>',
            is_read: true
        },
        {
            subject: 'Server Maintenance Notification',
            sender_name: 'IT Operations',
            sender_email: 'it-ops@jubileeenterprise.com',
            body_preview: 'Scheduled maintenance will occur this Saturday from 2 AM to 6 AM EST.',
            body_html: '<p>Dear Team,</p><p>Please be advised that scheduled maintenance will occur this Saturday from 2 AM to 6 AM EST.</p><p><strong>Affected Services:</strong></p><ul><li>Email Server</li><li>File Storage</li><li>VPN Access</li></ul><p>We apologize for any inconvenience.</p><p>IT Operations</p>',
            is_read: false
        },
        {
            subject: 'Invitation: Annual Company Retreat',
            sender_name: 'HR Department',
            sender_email: 'hr@jubileeenterprise.com',
            body_preview: 'You are invited to our annual company retreat on February 15-17, 2026.',
            body_html: '<p>Dear Sandeep,</p><p>You are cordially invited to our annual company retreat!</p><p><strong>Date:</strong> February 15-17, 2026<br/><strong>Location:</strong> Mountain View Resort<br/><strong>Theme:</strong> Innovation & Collaboration</p><p>Please RSVP by January 31st.</p><p>Best,<br/>HR Department</p>',
            is_read: false
        }
    ];

    // Sent emails (3)
    const sentEmails = [
        {
            subject: 'Re: Project Timeline Update',
            sender_name: 'Sandeep Agarwal',
            sender_email: 'sandeep.agarwal@logixshapers.com',
            body_preview: 'I have reviewed the updated timeline and it looks good. Let us proceed with the implementation.',
            body_html: '<p>Hi Team,</p><p>I have reviewed the updated timeline and it looks good. Let us proceed with the implementation as planned.</p><p>Please ensure all milestones are tracked in our project management tool.</p><p>Best regards,<br/>Sandeep</p>',
            is_read: true,
            is_sent: true
        },
        {
            subject: 'Quarterly Review Feedback',
            sender_name: 'Sandeep Agarwal',
            sender_email: 'sandeep.agarwal@logixshapers.com',
            body_preview: 'Thank you for the comprehensive quarterly review presentation. Here are my thoughts...',
            body_html: '<p>Dear Finance Team,</p><p>Thank you for the comprehensive quarterly review presentation. Here are my thoughts:</p><ul><li>Great improvement in revenue metrics</li><li>Cost optimization efforts are showing results</li><li>Customer retention rate needs attention</li></ul><p>Let us schedule a follow-up meeting next week.</p><p>Sandeep</p>',
            is_read: true,
            is_sent: true
        },
        {
            subject: 'Resource Allocation Request',
            sender_name: 'Sandeep Agarwal',
            sender_email: 'sandeep.agarwal@logixshapers.com',
            body_preview: 'I would like to request additional resources for the upcoming sprint.',
            body_html: '<p>Hi Sarah,</p><p>I would like to request additional resources for the upcoming sprint. We need:</p><ul><li>2 Senior Developers</li><li>1 QA Engineer</li><li>1 DevOps Specialist</li></ul><p>Please let me know the availability.</p><p>Thanks,<br/>Sandeep</p>',
            is_read: true,
            is_sent: true
        }
    ];

    // Draft emails (2)
    const draftEmails = [
        {
            subject: 'Proposal: New Client Onboarding Process',
            sender_name: 'Sandeep Agarwal',
            sender_email: 'sandeep.agarwal@logixshapers.com',
            body_preview: 'I am writing to propose a new streamlined client onboarding process...',
            body_html: '<p>Dear Leadership Team,</p><p>I am writing to propose a new streamlined client onboarding process that will reduce time-to-value by 40%.</p><p><strong>Key Components:</strong></p><ul><li>Automated welcome emails</li><li>Self-service portal</li><li>Interactive tutorials</li></ul><p>[Draft - More details to be added]</p>',
            is_read: true,
            is_draft: true
        },
        {
            subject: 'Team Building Event Ideas',
            sender_name: 'Sandeep Agarwal',
            sender_email: 'sandeep.agarwal@logixshapers.com',
            body_preview: 'Here are some ideas for our next team building event...',
            body_html: '<p>Hi HR,</p><p>Here are some ideas for our next team building event:</p><ol><li>Escape Room Challenge</li><li>Cooking Class</li><li>Outdoor Adventure Day</li></ol><p>[Draft - Need to finalize budget]</p>',
            is_read: true,
            is_draft: true
        }
    ];

    // Insert inbox emails
    console.log('\nInserting Inbox emails...');
    for (let i = 0; i < inboxEmails.length; i++) {
        const email = inboxEmails[i];
        const receivedAt = new Date(Date.now() - (i * 3600000)); // Each email 1 hour apart
        await pool.query(`
            INSERT INTO outlook_email_messages (user_id, folder_id, subject, sender_name, sender_email, body_preview, body_html, is_read, received_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [userId, folderMap['inbox'], email.subject, email.sender_name, email.sender_email, email.body_preview, email.body_html, email.is_read, receivedAt]);
        console.log('  ✅', email.subject);
    }

    // Insert sent emails
    console.log('\nInserting Sent emails...');
    for (let i = 0; i < sentEmails.length; i++) {
        const email = sentEmails[i];
        const sentAt = new Date(Date.now() - ((i + 1) * 86400000)); // Each email 1 day apart
        await pool.query(`
            INSERT INTO outlook_email_messages (user_id, folder_id, subject, sender_name, sender_email, body_preview, body_html, is_read, is_sent, sent_at, received_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
        `, [userId, folderMap['sent'], email.subject, email.sender_name, email.sender_email, email.body_preview, email.body_html, email.is_read, email.is_sent, sentAt]);
        console.log('  ✅', email.subject);
    }

    // Insert draft emails
    console.log('\nInserting Draft emails...');
    for (let i = 0; i < draftEmails.length; i++) {
        const email = draftEmails[i];
        const createdAt = new Date(Date.now() - ((i + 1) * 7200000)); // Each draft 2 hours apart
        await pool.query(`
            INSERT INTO outlook_email_messages (user_id, folder_id, subject, sender_name, sender_email, body_preview, body_html, is_read, is_draft, received_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [userId, folderMap['drafts'], email.subject, email.sender_name, email.sender_email, email.body_preview, email.body_html, email.is_read, email.is_draft, createdAt]);
        console.log('  ✅', email.subject);
    }

    // Summary
    const counts = await pool.query(`
        SELECT f.name, f.folder_type, COUNT(m.id) as count
        FROM outlook_email_folders f
        LEFT JOIN outlook_email_messages m ON f.id = m.folder_id
        WHERE f.user_id = $1
        GROUP BY f.id, f.name, f.folder_type
        ORDER BY f.display_order
    `, [userId]);

    console.log('\n=== Summary ===');
    counts.rows.forEach(r => console.log(`  ${r.name}: ${r.count} emails`));

    await pool.end();
}

seedEmails().catch(err => {
    console.error('Error:', err.message);
    pool.end();
});
