#!/usr/bin/env node
/**
 * Seed complete email data for user: sandeep.agarwal@logixshapers.com
 * Includes proper From, To, Cc, body content and attachments
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
const userEmail = 'sandeep.agarwal@logixshapers.com';
const userName = 'Sandeep Agarwal';

async function seedEmails() {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Get folder IDs
        const folders = await client.query(
            'SELECT id, folder_type FROM outlook_email_folders WHERE user_id = $1',
            [userId]
        );

        const folderMap = {};
        folders.rows.forEach(f => { folderMap[f.folder_type] = f.id; });

        console.log('Folder IDs:', folderMap);

        // Delete existing messages and recipients for this user
        console.log('\nClearing existing data...');
        await client.query('DELETE FROM outlook_email_recipients WHERE message_id IN (SELECT id FROM outlook_email_messages WHERE user_id = $1)', [userId]);
        await client.query('DELETE FROM outlook_email_attachments WHERE message_id IN (SELECT id FROM outlook_email_messages WHERE user_id = $1)', [userId]);
        await client.query('DELETE FROM outlook_email_messages WHERE user_id = $1', [userId]);
        console.log('Existing data cleared.');

        // INBOX EMAILS (6 emails)
        const inboxEmails = [
            {
                subject: 'Q1 2026 Financial Report - Action Required',
                sender_name: 'Jennifer Martinez',
                sender_email: 'jennifer.martinez@jubileeenterprise.com',
                body_preview: 'Please review the attached Q1 2026 financial report and provide your approval by EOD Friday.',
                body_html: `<div style="font-family: Calibri, sans-serif; font-size: 14px;">
                    <p>Dear Sandeep,</p>
                    <p>Please review the attached Q1 2026 financial report and provide your approval by EOD Friday. The key highlights are:</p>
                    <ul>
                        <li><strong>Total Revenue:</strong> $2.4M (+15% YoY)</li>
                        <li><strong>Operating Margin:</strong> 22.5%</li>
                        <li><strong>New Customer Acquisitions:</strong> 847</li>
                        <li><strong>Customer Retention Rate:</strong> 94.2%</li>
                    </ul>
                    <p>Please let me know if you have any questions or need additional details.</p>
                    <p>Best regards,<br/>Jennifer Martinez<br/>Senior Financial Analyst<br/>Jubilee Enterprise</p>
                </div>`,
                body_text: 'Please review the attached Q1 2026 financial report and provide your approval by EOD Friday.',
                is_read: false,
                is_flagged: true,
                importance: 'high',
                has_attachments: true,
                recipients: [
                    { type: 'to', email: userEmail, name: userName },
                    { type: 'cc', email: 'finance.team@jubileeenterprise.com', name: 'Finance Team' }
                ],
                attachments: [
                    { file_name: 'Q1_2026_Financial_Report.xlsx', file_size: 245760, mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
                    { file_name: 'Q1_2026_Summary.pdf', file_size: 128000, mime_type: 'application/pdf' }
                ]
            },
            {
                subject: 'Meeting Invitation: Project Nexus Kickoff - January 20, 2026',
                sender_name: 'Sarah Johnson',
                sender_email: 'sarah.johnson@logixshapers.com',
                body_preview: 'You are invited to the Project Nexus kickoff meeting scheduled for Monday, January 20th at 10:00 AM.',
                body_html: `<div style="font-family: Calibri, sans-serif; font-size: 14px;">
                    <p>Hi Sandeep,</p>
                    <p>You are invited to the Project Nexus kickoff meeting scheduled for Monday, January 20th at 10:00 AM in Conference Room A.</p>
                    <p><strong>Meeting Details:</strong></p>
                    <table style="border-collapse: collapse; margin: 10px 0;">
                        <tr><td style="padding: 5px 15px 5px 0;"><strong>Date:</strong></td><td>Monday, January 20, 2026</td></tr>
                        <tr><td style="padding: 5px 15px 5px 0;"><strong>Time:</strong></td><td>10:00 AM - 11:30 AM EST</td></tr>
                        <tr><td style="padding: 5px 15px 5px 0;"><strong>Location:</strong></td><td>Conference Room A / Teams Link</td></tr>
                    </table>
                    <p><strong>Agenda:</strong></p>
                    <ol>
                        <li>Project Overview & Objectives</li>
                        <li>Timeline and Milestones Review</li>
                        <li>Resource Allocation Discussion</li>
                        <li>Risk Assessment</li>
                        <li>Q&A Session</li>
                    </ol>
                    <p>Please confirm your attendance by replying to this email.</p>
                    <p>Best,<br/>Sarah Johnson<br/>Project Manager</p>
                </div>`,
                body_text: 'You are invited to the Project Nexus kickoff meeting scheduled for Monday, January 20th at 10:00 AM.',
                is_read: false,
                is_flagged: false,
                importance: 'normal',
                has_attachments: true,
                recipients: [
                    { type: 'to', email: userEmail, name: userName },
                    { type: 'to', email: 'dev.team@logixshapers.com', name: 'Development Team' },
                    { type: 'cc', email: 'management@logixshapers.com', name: 'Management' }
                ],
                attachments: [
                    { file_name: 'Project_Nexus_Overview.pptx', file_size: 512000, mime_type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }
                ]
            },
            {
                subject: 'RE: API Integration Specifications - Updated Documentation',
                sender_name: 'Michael Chen',
                sender_email: 'michael.chen@techpartners.io',
                body_preview: 'I have updated the API integration specifications based on our discussion. Please find the revised documentation attached.',
                body_html: `<div style="font-family: Calibri, sans-serif; font-size: 14px;">
                    <p>Hi Sandeep,</p>
                    <p>I have updated the API integration specifications based on our discussion yesterday. Please find the revised documentation attached.</p>
                    <p><strong>Key Changes:</strong></p>
                    <ul>
                        <li>Added OAuth 2.0 authentication flow details</li>
                        <li>Updated rate limiting specifications (1000 req/min)</li>
                        <li>Added webhook event documentation</li>
                        <li>Included error code reference guide</li>
                    </ul>
                    <p>The staging environment has been updated with these changes. You can test using the following credentials:</p>
                    <p style="background: #f5f5f5; padding: 10px; font-family: monospace;">
                        API Key: stg_api_key_xxxxx<br/>
                        Endpoint: https://staging.api.techpartners.io/v2
                    </p>
                    <p>Let me know if you need any clarifications.</p>
                    <p>Thanks,<br/>Michael Chen<br/>Senior API Architect<br/>TechPartners.io</p>
                </div>`,
                body_text: 'I have updated the API integration specifications based on our discussion. Please find the revised documentation attached.',
                is_read: true,
                is_flagged: false,
                importance: 'normal',
                has_attachments: true,
                recipients: [
                    { type: 'to', email: userEmail, name: userName },
                    { type: 'cc', email: 'api.team@logixshapers.com', name: 'API Team' }
                ],
                attachments: [
                    { file_name: 'API_Integration_Specs_v2.1.pdf', file_size: 892000, mime_type: 'application/pdf' },
                    { file_name: 'Postman_Collection.json', file_size: 45000, mime_type: 'application/json' }
                ]
            },
            {
                subject: 'Weekly Status Report - Development Team (Week 3)',
                sender_name: 'David Park',
                sender_email: 'david.park@logixshapers.com',
                body_preview: 'Your weekly development team status report is ready. Sprint velocity: 42 story points completed.',
                body_html: `<div style="font-family: Calibri, sans-serif; font-size: 14px;">
                    <p>Hi Sandeep,</p>
                    <p>Here is the weekly status report for the Development Team (Week 3 of January 2026).</p>
                    <h3 style="color: #0078d4;">Sprint Summary</h3>
                    <table style="border-collapse: collapse; width: 100%; margin: 10px 0;">
                        <tr style="background: #0078d4; color: white;">
                            <th style="padding: 8px; text-align: left;">Metric</th>
                            <th style="padding: 8px; text-align: right;">Value</th>
                        </tr>
                        <tr style="background: #f5f5f5;">
                            <td style="padding: 8px;">Story Points Completed</td>
                            <td style="padding: 8px; text-align: right;">42</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px;">Bugs Fixed</td>
                            <td style="padding: 8px; text-align: right;">18</td>
                        </tr>
                        <tr style="background: #f5f5f5;">
                            <td style="padding: 8px;">Code Reviews Completed</td>
                            <td style="padding: 8px; text-align: right;">24</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px;">Test Coverage</td>
                            <td style="padding: 8px; text-align: right;">87%</td>
                        </tr>
                    </table>
                    <p><strong>Highlights:</strong></p>
                    <ul>
                        <li>Completed user authentication module</li>
                        <li>Deployed dashboard v2.0 to staging</li>
                        <li>Resolved critical performance issue in search functionality</li>
                    </ul>
                    <p>Full report attached.</p>
                    <p>Best,<br/>David Park<br/>Engineering Lead</p>
                </div>`,
                body_text: 'Your weekly development team status report is ready. Sprint velocity: 42 story points completed.',
                is_read: true,
                is_flagged: false,
                importance: 'normal',
                has_attachments: true,
                recipients: [
                    { type: 'to', email: userEmail, name: userName },
                    { type: 'to', email: 'management@logixshapers.com', name: 'Management Team' }
                ],
                attachments: [
                    { file_name: 'Weekly_Report_Week3.pdf', file_size: 156000, mime_type: 'application/pdf' }
                ]
            },
            {
                subject: 'URGENT: Server Maintenance Scheduled - January 18, 2026',
                sender_name: 'IT Operations',
                sender_email: 'it-ops@jubileeenterprise.com',
                body_preview: 'Critical server maintenance is scheduled for Saturday, January 18th. Expected downtime: 4 hours.',
                body_html: `<div style="font-family: Calibri, sans-serif; font-size: 14px;">
                    <div style="background: #fff4ce; border-left: 4px solid #ffc107; padding: 15px; margin-bottom: 15px;">
                        <strong>⚠️ SCHEDULED MAINTENANCE NOTICE</strong>
                    </div>
                    <p>Dear Team,</p>
                    <p>Please be advised that critical server maintenance is scheduled for this weekend.</p>
                    <p><strong>Maintenance Window:</strong></p>
                    <table style="border-collapse: collapse; margin: 10px 0;">
                        <tr><td style="padding: 5px 15px 5px 0;"><strong>Date:</strong></td><td>Saturday, January 18, 2026</td></tr>
                        <tr><td style="padding: 5px 15px 5px 0;"><strong>Time:</strong></td><td>2:00 AM - 6:00 AM EST</td></tr>
                        <tr><td style="padding: 5px 15px 5px 0;"><strong>Duration:</strong></td><td>Approximately 4 hours</td></tr>
                    </table>
                    <p><strong>Affected Services:</strong></p>
                    <ul>
                        <li>Email Server (Outlook)</li>
                        <li>File Storage (SharePoint)</li>
                        <li>VPN Access</li>
                        <li>Internal Applications</li>
                    </ul>
                    <p>Please save all work and log out of systems before the maintenance window. We apologize for any inconvenience.</p>
                    <p>IT Operations Team<br/>Jubilee Enterprise</p>
                </div>`,
                body_text: 'Critical server maintenance is scheduled for Saturday, January 18th. Expected downtime: 4 hours.',
                is_read: false,
                is_flagged: true,
                importance: 'high',
                has_attachments: false,
                recipients: [
                    { type: 'to', email: 'all-employees@jubileeenterprise.com', name: 'All Employees' }
                ],
                attachments: []
            },
            {
                subject: 'You are invited: Annual Company Retreat 2026',
                sender_name: 'HR Department',
                sender_email: 'hr@jubileeenterprise.com',
                body_preview: 'Join us for the Annual Company Retreat at Mountain View Resort, February 15-17, 2026. RSVP required.',
                body_html: `<div style="font-family: Calibri, sans-serif; font-size: 14px;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; margin-bottom: 20px;">
                        <h1 style="margin: 0; font-size: 28px;">Annual Company Retreat 2026</h1>
                        <p style="margin: 10px 0 0 0; font-size: 16px;">Innovation • Collaboration • Growth</p>
                    </div>
                    <p>Dear Sandeep,</p>
                    <p>You are cordially invited to our Annual Company Retreat!</p>
                    <p><strong>Event Details:</strong></p>
                    <table style="border-collapse: collapse; margin: 10px 0;">
                        <tr><td style="padding: 5px 15px 5px 0;"><strong>📅 Date:</strong></td><td>February 15-17, 2026</td></tr>
                        <tr><td style="padding: 5px 15px 5px 0;"><strong>📍 Location:</strong></td><td>Mountain View Resort, Colorado</td></tr>
                        <tr><td style="padding: 5px 15px 5px 0;"><strong>🎯 Theme:</strong></td><td>Innovation & Collaboration</td></tr>
                    </table>
                    <p><strong>What to Expect:</strong></p>
                    <ul>
                        <li>Keynote presentations from industry leaders</li>
                        <li>Team building activities and workshops</li>
                        <li>Networking opportunities</li>
                        <li>Recognition awards ceremony</li>
                        <li>Outdoor adventure activities</li>
                    </ul>
                    <p><strong>RSVP by January 31st</strong> to confirm your attendance.</p>
                    <p>We look forward to seeing you there!</p>
                    <p>Best regards,<br/>Human Resources Department<br/>Jubilee Enterprise</p>
                </div>`,
                body_text: 'Join us for the Annual Company Retreat at Mountain View Resort, February 15-17, 2026. RSVP required.',
                is_read: false,
                is_flagged: false,
                importance: 'normal',
                has_attachments: true,
                recipients: [
                    { type: 'to', email: userEmail, name: userName }
                ],
                attachments: [
                    { file_name: 'Retreat_Agenda_2026.pdf', file_size: 234000, mime_type: 'application/pdf' },
                    { file_name: 'RSVP_Form.docx', file_size: 45000, mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
                ]
            }
        ];

        // SENT EMAILS (3 emails)
        const sentEmails = [
            {
                subject: 'Re: Project Timeline Update - Approved',
                sender_name: userName,
                sender_email: userEmail,
                body_preview: 'I have reviewed the updated timeline and it looks good. Let\'s proceed with the implementation as planned.',
                body_html: `<div style="font-family: Calibri, sans-serif; font-size: 14px;">
                    <p>Hi Team,</p>
                    <p>I have reviewed the updated timeline and it looks good. Let's proceed with the implementation as planned.</p>
                    <p>Please ensure all milestones are tracked in our project management tool, and flag any blockers immediately.</p>
                    <p><strong>Key Milestones to Watch:</strong></p>
                    <ul>
                        <li>Phase 1 completion: January 25</li>
                        <li>UAT begins: February 1</li>
                        <li>Go-live: February 15</li>
                    </ul>
                    <p>Let me know if you need any resources or support.</p>
                    <p>Best regards,<br/>Sandeep Agarwal</p>
                </div>`,
                body_text: 'I have reviewed the updated timeline and it looks good. Let\'s proceed with the implementation as planned.',
                is_read: true,
                is_flagged: false,
                importance: 'normal',
                has_attachments: false,
                recipients: [
                    { type: 'to', email: 'project.team@logixshapers.com', name: 'Project Team' },
                    { type: 'cc', email: 'sarah.johnson@logixshapers.com', name: 'Sarah Johnson' }
                ],
                attachments: []
            },
            {
                subject: 'Quarterly Review Feedback - Great Progress',
                sender_name: userName,
                sender_email: userEmail,
                body_preview: 'Thank you for the comprehensive quarterly review presentation. Here are my detailed thoughts and feedback.',
                body_html: `<div style="font-family: Calibri, sans-serif; font-size: 14px;">
                    <p>Dear Finance Team,</p>
                    <p>Thank you for the comprehensive quarterly review presentation. Here are my detailed thoughts:</p>
                    <p><strong>Positive Highlights:</strong></p>
                    <ul>
                        <li>Revenue growth of 15% YoY is excellent</li>
                        <li>Cost optimization efforts showing tangible results</li>
                        <li>New customer acquisition exceeded targets</li>
                    </ul>
                    <p><strong>Areas for Improvement:</strong></p>
                    <ul>
                        <li>Customer retention rate needs attention - down 2% from last quarter</li>
                        <li>Marketing spend efficiency could be optimized</li>
                    </ul>
                    <p>Let's schedule a follow-up meeting next week to discuss action items.</p>
                    <p>Best regards,<br/>Sandeep Agarwal</p>
                </div>`,
                body_text: 'Thank you for the comprehensive quarterly review presentation. Here are my detailed thoughts and feedback.',
                is_read: true,
                is_flagged: false,
                importance: 'normal',
                has_attachments: false,
                recipients: [
                    { type: 'to', email: 'jennifer.martinez@jubileeenterprise.com', name: 'Jennifer Martinez' },
                    { type: 'to', email: 'finance.team@jubileeenterprise.com', name: 'Finance Team' }
                ],
                attachments: []
            },
            {
                subject: 'Resource Allocation Request - Q1 Sprint',
                sender_name: userName,
                sender_email: userEmail,
                body_preview: 'I would like to request additional resources for the upcoming Q1 sprint. We need 2 senior developers and 1 QA engineer.',
                body_html: `<div style="font-family: Calibri, sans-serif; font-size: 14px;">
                    <p>Hi Sarah,</p>
                    <p>I would like to request additional resources for the upcoming Q1 sprint. Based on our current workload analysis, we need:</p>
                    <table style="border-collapse: collapse; width: 100%; margin: 10px 0;">
                        <tr style="background: #f5f5f5;">
                            <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Role</th>
                            <th style="padding: 8px; text-align: center; border: 1px solid #ddd;">Count</th>
                            <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Skills Required</th>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border: 1px solid #ddd;">Senior Developer</td>
                            <td style="padding: 8px; text-align: center; border: 1px solid #ddd;">2</td>
                            <td style="padding: 8px; border: 1px solid #ddd;">.NET Core, React, Azure</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border: 1px solid #ddd;">QA Engineer</td>
                            <td style="padding: 8px; text-align: center; border: 1px solid #ddd;">1</td>
                            <td style="padding: 8px; border: 1px solid #ddd;">Selenium, API Testing</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; border: 1px solid #ddd;">DevOps Specialist</td>
                            <td style="padding: 8px; text-align: center; border: 1px solid #ddd;">1</td>
                            <td style="padding: 8px; border: 1px solid #ddd;">CI/CD, Kubernetes</td>
                        </tr>
                    </table>
                    <p>Please let me know the availability and we can discuss further.</p>
                    <p>Thanks,<br/>Sandeep Agarwal</p>
                </div>`,
                body_text: 'I would like to request additional resources for the upcoming Q1 sprint. We need 2 senior developers and 1 QA engineer.',
                is_read: true,
                is_flagged: false,
                importance: 'normal',
                has_attachments: true,
                recipients: [
                    { type: 'to', email: 'sarah.johnson@logixshapers.com', name: 'Sarah Johnson' },
                    { type: 'cc', email: 'hr@logixshapers.com', name: 'HR Department' }
                ],
                attachments: [
                    { file_name: 'Resource_Request_Form.xlsx', file_size: 34000, mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
                ]
            }
        ];

        // DRAFT EMAILS (2 emails)
        const draftEmails = [
            {
                subject: 'Proposal: New Client Onboarding Process',
                sender_name: userName,
                sender_email: userEmail,
                body_preview: 'I am writing to propose a new streamlined client onboarding process that will reduce time-to-value by 40%.',
                body_html: `<div style="font-family: Calibri, sans-serif; font-size: 14px;">
                    <p>Dear Leadership Team,</p>
                    <p>I am writing to propose a new streamlined client onboarding process that will significantly improve our customer experience and reduce time-to-value by 40%.</p>
                    <p><strong>Proposed Changes:</strong></p>
                    <ul>
                        <li>Automated welcome email sequence</li>
                        <li>Self-service onboarding portal</li>
                        <li>Interactive video tutorials</li>
                        <li>Dedicated success manager assignment</li>
                    </ul>
                    <p><strong>Expected Benefits:</strong></p>
                    <ul>
                        <li>40% reduction in onboarding time</li>
                        <li>25% improvement in customer satisfaction scores</li>
                        <li>30% reduction in support tickets</li>
                    </ul>
                    <p>[DRAFT - Need to add implementation timeline and budget estimates]</p>
                </div>`,
                body_text: 'I am writing to propose a new streamlined client onboarding process that will reduce time-to-value by 40%.',
                is_read: true,
                is_flagged: false,
                importance: 'normal',
                has_attachments: false,
                recipients: [
                    { type: 'to', email: 'leadership@jubileeenterprise.com', name: 'Leadership Team' }
                ],
                attachments: []
            },
            {
                subject: 'Team Building Event Ideas - February',
                sender_name: userName,
                sender_email: userEmail,
                body_preview: 'Here are some ideas for our next team building event in February. I have researched several options.',
                body_html: `<div style="font-family: Calibri, sans-serif; font-size: 14px;">
                    <p>Hi HR Team,</p>
                    <p>Here are some ideas for our next team building event in February:</p>
                    <p><strong>Option 1: Escape Room Challenge</strong></p>
                    <ul>
                        <li>Estimated cost: $500-800</li>
                        <li>Duration: 2-3 hours</li>
                        <li>Capacity: Up to 20 people</li>
                    </ul>
                    <p><strong>Option 2: Cooking Class</strong></p>
                    <ul>
                        <li>Estimated cost: $1000-1500</li>
                        <li>Duration: 3-4 hours</li>
                        <li>Includes dinner</li>
                    </ul>
                    <p><strong>Option 3: Outdoor Adventure Day</strong></p>
                    <ul>
                        <li>Estimated cost: $800-1200</li>
                        <li>Duration: Full day</li>
                        <li>Activities: Hiking, team challenges</li>
                    </ul>
                    <p>[DRAFT - Need to finalize budget and get team preferences]</p>
                </div>`,
                body_text: 'Here are some ideas for our next team building event in February. I have researched several options.',
                is_read: true,
                is_flagged: false,
                importance: 'normal',
                has_attachments: false,
                recipients: [
                    { type: 'to', email: 'hr@jubileeenterprise.com', name: 'HR Department' }
                ],
                attachments: []
            }
        ];

        // Insert inbox emails
        console.log('\nInserting Inbox emails...');
        for (let i = 0; i < inboxEmails.length; i++) {
            const email = inboxEmails[i];
            const receivedAt = new Date(Date.now() - (i * 3600000)); // Each email 1 hour apart

            const msgResult = await client.query(`
                INSERT INTO outlook_email_messages (
                    user_id, folder_id, subject, sender_name, sender_email,
                    body_preview, body_html, body_text,
                    is_read, is_flagged, importance, has_attachments, received_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                RETURNING id
            `, [
                userId, folderMap['inbox'], email.subject, email.sender_name, email.sender_email,
                email.body_preview, email.body_html, email.body_text,
                email.is_read, email.is_flagged, email.importance, email.has_attachments, receivedAt
            ]);

            const messageId = msgResult.rows[0].id;

            // Insert recipients
            for (const recipient of email.recipients) {
                await client.query(`
                    INSERT INTO outlook_email_recipients (message_id, recipient_type, email, name)
                    VALUES ($1, $2, $3, $4)
                `, [messageId, recipient.type, recipient.email, recipient.name]);
            }

            // Insert attachments
            for (const attachment of email.attachments) {
                await client.query(`
                    INSERT INTO outlook_email_attachments (message_id, file_name, file_size, mime_type, file_path)
                    VALUES ($1, $2, $3, $4, $5)
                `, [messageId, attachment.file_name, attachment.file_size, attachment.mime_type, `/attachments/${messageId}/${attachment.file_name}`]);
            }

            console.log(`  ✅ ${email.subject}`);
        }

        // Insert sent emails
        console.log('\nInserting Sent emails...');
        for (let i = 0; i < sentEmails.length; i++) {
            const email = sentEmails[i];
            const sentAt = new Date(Date.now() - ((i + 1) * 86400000)); // Each email 1 day apart

            const msgResult = await client.query(`
                INSERT INTO outlook_email_messages (
                    user_id, folder_id, subject, sender_name, sender_email,
                    body_preview, body_html, body_text,
                    is_read, is_sent, is_flagged, importance, has_attachments, sent_at, received_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10, $11, $12, $13, $13)
                RETURNING id
            `, [
                userId, folderMap['sent'], email.subject, email.sender_name, email.sender_email,
                email.body_preview, email.body_html, email.body_text,
                email.is_read, email.is_flagged, email.importance, email.has_attachments, sentAt
            ]);

            const messageId = msgResult.rows[0].id;

            // Insert recipients
            for (const recipient of email.recipients) {
                await client.query(`
                    INSERT INTO outlook_email_recipients (message_id, recipient_type, email, name)
                    VALUES ($1, $2, $3, $4)
                `, [messageId, recipient.type, recipient.email, recipient.name]);
            }

            // Insert attachments
            for (const attachment of email.attachments) {
                await client.query(`
                    INSERT INTO outlook_email_attachments (message_id, file_name, file_size, mime_type, file_path)
                    VALUES ($1, $2, $3, $4, $5)
                `, [messageId, attachment.file_name, attachment.file_size, attachment.mime_type, `/attachments/${messageId}/${attachment.file_name}`]);
            }

            console.log(`  ✅ ${email.subject}`);
        }

        // Insert draft emails
        console.log('\nInserting Draft emails...');
        for (let i = 0; i < draftEmails.length; i++) {
            const email = draftEmails[i];
            const createdAt = new Date(Date.now() - ((i + 1) * 7200000)); // Each draft 2 hours apart

            const msgResult = await client.query(`
                INSERT INTO outlook_email_messages (
                    user_id, folder_id, subject, sender_name, sender_email,
                    body_preview, body_html, body_text,
                    is_read, is_draft, is_flagged, importance, has_attachments, received_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10, $11, $12, $13)
                RETURNING id
            `, [
                userId, folderMap['drafts'], email.subject, email.sender_name, email.sender_email,
                email.body_preview, email.body_html, email.body_text,
                email.is_read, email.is_flagged, email.importance, email.has_attachments, createdAt
            ]);

            const messageId = msgResult.rows[0].id;

            // Insert recipients
            for (const recipient of email.recipients) {
                await client.query(`
                    INSERT INTO outlook_email_recipients (message_id, recipient_type, email, name)
                    VALUES ($1, $2, $3, $4)
                `, [messageId, recipient.type, recipient.email, recipient.name]);
            }

            console.log(`  ✅ ${email.subject}`);
        }

        await client.query('COMMIT');

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

    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }

    await pool.end();
}

seedEmails().catch(err => {
    console.error('Error:', err.message);
    pool.end();
    process.exit(1);
});
