#!/usr/bin/env node
/**
 * Seed detailed emails with attachments for user: sandeep.agarwal@logixshapers.com
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

async function clearExistingEmails() {
    await pool.query('DELETE FROM outlook_email_messages WHERE user_id = $1', [userId]);
    console.log('✅ Cleared existing emails');
}

async function seedEmails() {
    // Get folder IDs
    const folders = await pool.query(
        'SELECT id, folder_type FROM outlook_email_folders WHERE user_id = $1',
        [userId]
    );

    const folderMap = {};
    folders.rows.forEach(f => { folderMap[f.folder_type] = f.id; });

    console.log('Folder IDs:', Object.keys(folderMap).join(', '));

    // ========== INBOX EMAILS (6) ==========
    const inboxEmails = [
        {
            subject: 'Q1 2026 Financial Report - Action Required',
            sender_name: 'Michael Chen',
            sender_email: 'michael.chen@jubileeenterprise.com',
            reply_to_email: 'finance-team@jubileeenterprise.com',
            reply_to_name: 'Finance Team',
            body_preview: 'Please review the attached Q1 2026 financial report and provide your approval by EOD Friday.',
            body_html: `<div style="font-family: Arial, sans-serif;">
                <p>Dear Sandeep,</p>
                <p>I hope this email finds you well. Please find attached the <strong>Q1 2026 Financial Report</strong> for your review and approval.</p>
                <h3>Key Highlights:</h3>
                <table style="border-collapse: collapse; width: 100%; margin: 15px 0;">
                    <tr style="background: #f5f5f5;">
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Total Revenue</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">$2,847,500 (+18% YoY)</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Operating Margin</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">24.5%</td>
                    </tr>
                    <tr style="background: #f5f5f5;">
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>New Enterprise Clients</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">47</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Customer Retention Rate</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">94.2%</td>
                    </tr>
                </table>
                <p>Please review the attached documents and provide your approval by <strong>EOD Friday, January 24th</strong>.</p>
                <p>Best regards,<br/><strong>Michael Chen</strong><br/>Senior Financial Analyst<br/>Finance Department</p>
            </div>`,
            body_text: 'Dear Sandeep, Please find attached the Q1 2026 Financial Report for your review. Key Highlights: Total Revenue: $2,847,500 (+18% YoY), Operating Margin: 24.5%, New Enterprise Clients: 47, Customer Retention Rate: 94.2%. Please provide approval by EOD Friday.',
            is_read: false,
            is_flagged: true,
            importance: 'high',
            has_attachments: true
        },
        {
            subject: 'Meeting Invitation: Project Nexus Kickoff - January 20, 2026',
            sender_name: 'Sarah Johnson',
            sender_email: 'sarah.johnson@logixshapers.com',
            reply_to_email: 'sarah.johnson@logixshapers.com',
            reply_to_name: 'Sarah Johnson',
            body_preview: 'You are invited to the Project Nexus kickoff meeting scheduled for Monday, January 20th at 10:00 AM.',
            body_html: `<div style="font-family: Arial, sans-serif;">
                <div style="background: #0066cc; color: white; padding: 20px; border-radius: 5px 5px 0 0;">
                    <h2 style="margin: 0;">📅 Meeting Invitation</h2>
                </div>
                <div style="border: 1px solid #ddd; padding: 20px;">
                    <h3>Project Nexus - Kickoff Meeting</h3>
                    <p><strong>📆 Date:</strong> Monday, January 20, 2026</p>
                    <p><strong>🕙 Time:</strong> 10:00 AM - 11:30 AM (EST)</p>
                    <p><strong>📍 Location:</strong> Conference Room A / Microsoft Teams</p>
                    <p><strong>👥 Attendees:</strong></p>
                    <ul>
                        <li>Sandeep Agarwal (Project Lead)</li>
                        <li>Sarah Johnson (Product Manager)</li>
                        <li>David Park (Tech Lead)</li>
                        <li>Emily Rodriguez (UX Designer)</li>
                        <li>James Wilson (QA Lead)</li>
                    </ul>
                    <h4>Agenda:</h4>
                    <ol>
                        <li>Project Overview & Objectives (15 min)</li>
                        <li>Timeline & Milestones Review (20 min)</li>
                        <li>Resource Allocation Discussion (15 min)</li>
                        <li>Risk Assessment (15 min)</li>
                        <li>Q&A and Next Steps (25 min)</li>
                    </ol>
                    <p>Please confirm your attendance by replying to this email.</p>
                    <p>Looking forward to seeing you there!</p>
                    <p>Best,<br/><strong>Sarah Johnson</strong><br/>Product Manager</p>
                </div>
            </div>`,
            body_text: 'Project Nexus Kickoff Meeting - Monday, January 20, 2026 at 10:00 AM EST. Location: Conference Room A / Microsoft Teams. Please confirm your attendance.',
            is_read: false,
            is_flagged: false,
            importance: 'normal',
            has_attachments: true
        },
        {
            subject: 'RE: API Integration Specifications - Updated Documentation',
            sender_name: 'David Park',
            sender_email: 'david.park@logixshapers.com',
            reply_to_email: 'david.park@logixshapers.com',
            reply_to_name: 'David Park',
            body_preview: 'I have updated the API integration specifications based on our discussion. Please find the revised documentation attached.',
            body_html: `<div style="font-family: Arial, sans-serif;">
                <p>Hi Sandeep,</p>
                <p>As discussed in our call yesterday, I have updated the API integration specifications. The key changes include:</p>
                <ul>
                    <li>✅ Added OAuth 2.0 authentication flow documentation</li>
                    <li>✅ Updated rate limiting parameters (100 requests/minute → 200 requests/minute)</li>
                    <li>✅ New webhook endpoints for real-time notifications</li>
                    <li>✅ Revised error response format with detailed error codes</li>
                </ul>
                <h4>Attached Documents:</h4>
                <ul>
                    <li>📄 API_Integration_Spec_v2.1.pdf</li>
                    <li>📄 Authentication_Flow_Diagram.png</li>
                    <li>📄 Sample_Code_Snippets.zip</li>
                </ul>
                <p>Let me know if you have any questions or need further clarification.</p>
                <p>Thanks,<br/><strong>David Park</strong><br/>Senior Software Engineer</p>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;"/>
                <p style="color: #666; font-size: 12px;"><strong>From:</strong> Sandeep Agarwal<br/>
                <strong>Sent:</strong> Wednesday, January 15, 2026 3:45 PM<br/>
                <strong>Subject:</strong> RE: API Integration Specifications</p>
                <p style="color: #666; font-size: 12px;">David, can you update the rate limiting and add the webhook documentation? Thanks.</p>
            </div>`,
            body_text: 'Hi Sandeep, I have updated the API integration specifications. Changes include OAuth 2.0 documentation, updated rate limiting, new webhook endpoints, and revised error format. See attached documents.',
            is_read: true,
            is_flagged: false,
            importance: 'normal',
            has_attachments: true
        },
        {
            subject: 'Weekly Status Report - Development Team (Week 3)',
            sender_name: 'Jubilee Project Bot',
            sender_email: 'noreply@jubileeenterprise.com',
            reply_to_email: 'project-management@jubileeenterprise.com',
            reply_to_name: 'Project Management',
            body_preview: 'Your weekly development team status report is ready. Sprint velocity: 42 story points completed.',
            body_html: `<div style="font-family: Arial, sans-serif; max-width: 600px;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center;">
                    <h2 style="margin: 0;">📊 Weekly Status Report</h2>
                    <p style="margin: 5px 0 0 0;">Week 3 | January 13-17, 2026</p>
                </div>
                <div style="padding: 20px; background: #f9f9f9;">
                    <h3>Sprint Progress</h3>
                    <div style="background: white; padding: 15px; border-radius: 5px; margin: 10px 0;">
                        <div style="display: flex; justify-content: space-between;">
                            <span>Completed</span>
                            <strong>42 / 50 story points</strong>
                        </div>
                        <div style="background: #e0e0e0; height: 20px; border-radius: 10px; margin-top: 10px;">
                            <div style="background: #4CAF50; height: 20px; width: 84%; border-radius: 10px;"></div>
                        </div>
                    </div>
                    <h3>Team Highlights</h3>
                    <ul>
                        <li>🚀 User authentication module deployed to staging</li>
                        <li>✅ 15 bug fixes merged to main branch</li>
                        <li>📝 API documentation updated for v2.1</li>
                        <li>🔧 Performance optimization: 40% faster page loads</li>
                    </ul>
                    <h3>Blockers</h3>
                    <ul>
                        <li>⚠️ Waiting for design approval on dashboard redesign</li>
                        <li>⚠️ Third-party API rate limit issues (under investigation)</li>
                    </ul>
                    <h3>Next Week Focus</h3>
                    <ul>
                        <li>Complete payment integration module</li>
                        <li>Start user onboarding flow development</li>
                        <li>Security audit preparation</li>
                    </ul>
                </div>
                <div style="text-align: center; padding: 15px; color: #666; font-size: 12px;">
                    This is an automated report. Do not reply directly to this email.
                </div>
            </div>`,
            body_text: 'Weekly Status Report - Week 3. Sprint Progress: 42/50 story points (84%). Highlights: Auth module deployed, 15 bug fixes, API docs updated, 40% faster page loads. Blockers: Design approval pending, API rate limits.',
            is_read: true,
            is_flagged: false,
            importance: 'normal',
            has_attachments: false
        },
        {
            subject: 'URGENT: Server Maintenance Scheduled - January 18, 2026',
            sender_name: 'IT Operations Center',
            sender_email: 'it-operations@jubileeenterprise.com',
            reply_to_email: 'it-support@jubileeenterprise.com',
            reply_to_name: 'IT Support',
            body_preview: 'Critical server maintenance is scheduled for Saturday, January 18th. Expected downtime: 4 hours.',
            body_html: `<div style="font-family: Arial, sans-serif;">
                <div style="background: #ff5722; color: white; padding: 15px; text-align: center;">
                    <h2 style="margin: 0;">⚠️ SCHEDULED MAINTENANCE NOTICE</h2>
                </div>
                <div style="padding: 20px; border: 2px solid #ff5722;">
                    <p>Dear Team,</p>
                    <p>Please be advised that <strong>critical server maintenance</strong> has been scheduled for this weekend.</p>
                    <table style="width: 100%; margin: 15px 0;">
                        <tr>
                            <td style="padding: 10px; background: #fff3e0;"><strong>📅 Date:</strong></td>
                            <td style="padding: 10px;">Saturday, January 18, 2026</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; background: #fff3e0;"><strong>🕐 Time:</strong></td>
                            <td style="padding: 10px;">2:00 AM - 6:00 AM EST</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; background: #fff3e0;"><strong>⏱️ Expected Duration:</strong></td>
                            <td style="padding: 10px;">4 hours</td>
                        </tr>
                    </table>
                    <h4>Affected Services:</h4>
                    <ul>
                        <li>❌ Email Server (Outlook Web & Desktop)</li>
                        <li>❌ File Storage & SharePoint</li>
                        <li>❌ VPN Access</li>
                        <li>❌ Internal Applications Portal</li>
                    </ul>
                    <h4>Services NOT Affected:</h4>
                    <ul>
                        <li>✅ Microsoft Teams (Cloud-hosted)</li>
                        <li>✅ External Website</li>
                    </ul>
                    <p style="color: #ff5722;"><strong>Please save all work and log off before the maintenance window.</strong></p>
                    <p>For urgent issues during maintenance, contact the IT Emergency Hotline: <strong>+1-800-555-HELP</strong></p>
                    <p>Thank you for your understanding.</p>
                    <p>IT Operations Center</p>
                </div>
            </div>`,
            body_text: 'URGENT: Server maintenance scheduled for Saturday, January 18, 2026 from 2:00 AM - 6:00 AM EST. Affected: Email, File Storage, VPN, Internal Apps. Please save work before maintenance.',
            is_read: false,
            is_flagged: true,
            importance: 'high',
            has_attachments: false
        },
        {
            subject: 'You are invited: Annual Company Retreat 2026',
            sender_name: 'Lisa Thompson',
            sender_email: 'lisa.thompson@jubileeenterprise.com',
            reply_to_email: 'hr-events@jubileeenterprise.com',
            reply_to_name: 'HR Events Team',
            body_preview: 'Join us for the Annual Company Retreat at Mountain View Resort, February 15-17, 2026. RSVP required.',
            body_html: `<div style="font-family: Arial, sans-serif;">
                <div style="background: url('mountain-banner.jpg') center/cover; height: 150px; display: flex; align-items: center; justify-content: center; background-color: #2196F3;">
                    <h1 style="color: white; text-shadow: 2px 2px 4px rgba(0,0,0,0.5); margin: 0;">🏔️ Annual Company Retreat 2026</h1>
                </div>
                <div style="padding: 20px;">
                    <p>Dear Sandeep,</p>
                    <p>You are cordially invited to our <strong>Annual Company Retreat</strong>! This year's theme is <em>"Innovation & Collaboration"</em>.</p>
                    <div style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 15px 0;">
                        <p style="margin: 5px 0;"><strong>📅 Dates:</strong> February 15-17, 2026 (Saturday - Monday)</p>
                        <p style="margin: 5px 0;"><strong>📍 Location:</strong> Mountain View Resort & Spa, Colorado</p>
                        <p style="margin: 5px 0;"><strong>🚗 Transportation:</strong> Chartered buses from office (departure 6:00 AM)</p>
                        <p style="margin: 5px 0;"><strong>🏨 Accommodation:</strong> Private rooms included</p>
                    </div>
                    <h4>Retreat Highlights:</h4>
                    <ul>
                        <li>🎤 Keynote by CEO on 2026 Vision</li>
                        <li>🤝 Team Building Activities & Games</li>
                        <li>🍽️ Gourmet Dining Experiences</li>
                        <li>🎿 Optional Skiing & Snowboarding</li>
                        <li>💆 Spa & Wellness Sessions</li>
                        <li>🎉 Gala Dinner & Awards Night</li>
                    </ul>
                    <div style="background: #fff3e0; padding: 15px; border-left: 4px solid #ff9800; margin: 15px 0;">
                        <strong>⏰ RSVP Deadline:</strong> January 31, 2026<br/>
                        <a href="#" style="color: #1976D2;">Click here to confirm your attendance</a>
                    </div>
                    <p>Please review the attached information packet for detailed schedule and what to bring.</p>
                    <p>Looking forward to seeing you there!</p>
                    <p>Warm regards,<br/><strong>Lisa Thompson</strong><br/>HR Director</p>
                </div>
            </div>`,
            body_text: 'Annual Company Retreat 2026 - February 15-17 at Mountain View Resort, Colorado. Theme: Innovation & Collaboration. RSVP by January 31st. Activities include keynote, team building, skiing, spa, and gala dinner.',
            is_read: false,
            is_flagged: false,
            importance: 'normal',
            has_attachments: true
        }
    ];

    // ========== SENT EMAILS (3) ==========
    const sentEmails = [
        {
            subject: 'RE: Project Timeline Update - Approved with Comments',
            sender_name: 'Sandeep Agarwal',
            sender_email: userEmail,
            reply_to_email: userEmail,
            reply_to_name: 'Sandeep Agarwal',
            body_preview: 'I have reviewed the updated timeline and approved it with some minor adjustments. Please see my comments below.',
            body_html: `<div style="font-family: Arial, sans-serif;">
                <p>Hi Sarah,</p>
                <p>I have reviewed the updated project timeline and I'm happy to approve it with the following adjustments:</p>
                <h4>Approved Changes:</h4>
                <ul>
                    <li>✅ Phase 1 completion extended to February 28th</li>
                    <li>✅ Additional QA sprint added before UAT</li>
                    <li>✅ Buffer week included before go-live</li>
                </ul>
                <h4>Requested Modifications:</h4>
                <ol>
                    <li><strong>Milestone 3:</strong> Please add a checkpoint review meeting mid-phase</li>
                    <li><strong>Resource allocation:</strong> Consider adding a backup developer for critical path items</li>
                    <li><strong>Documentation:</strong> Include technical documentation tasks in each sprint</li>
                </ol>
                <p>Please update the project plan with these changes and share with the team by EOD tomorrow.</p>
                <p>Great work on the detailed planning!</p>
                <p>Best regards,<br/><strong>Sandeep Agarwal</strong><br/>Project Lead</p>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;"/>
                <p style="color: #666; font-size: 12px;"><strong>From:</strong> Sarah Johnson<br/>
                <strong>Sent:</strong> Tuesday, January 14, 2026 2:30 PM<br/>
                <strong>To:</strong> Sandeep Agarwal<br/>
                <strong>Subject:</strong> Project Timeline Update</p>
            </div>`,
            body_text: 'Hi Sarah, I have reviewed and approved the timeline with adjustments: Phase 1 extended to Feb 28, QA sprint added, buffer week before go-live. Please add checkpoint review, backup developer consideration, and documentation tasks.',
            is_read: true,
            is_sent: true,
            is_flagged: false,
            importance: 'normal',
            has_attachments: false
        },
        {
            subject: 'Budget Proposal Q2 2026 - For Your Review',
            sender_name: 'Sandeep Agarwal',
            sender_email: userEmail,
            reply_to_email: userEmail,
            reply_to_name: 'Sandeep Agarwal',
            body_preview: 'Please find attached the Q2 2026 budget proposal for the development team. Requesting approval by January 25th.',
            body_html: `<div style="font-family: Arial, sans-serif;">
                <p>Dear Finance Team,</p>
                <p>Please find attached the <strong>Q2 2026 Budget Proposal</strong> for the Development Department.</p>
                <h4>Budget Summary:</h4>
                <table style="border-collapse: collapse; width: 100%; margin: 15px 0;">
                    <tr style="background: #f5f5f5;">
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Category</th>
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Amount</th>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;">Personnel (Salaries & Benefits)</td>
                        <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">$485,000</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;">Software & Licenses</td>
                        <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">$75,000</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;">Cloud Infrastructure</td>
                        <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">$120,000</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;">Training & Development</td>
                        <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">$25,000</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;">Contingency (10%)</td>
                        <td style="padding: 10px; border: 1px solid #ddd; text-align: right;">$70,500</td>
                    </tr>
                    <tr style="background: #e8f5e9;">
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>TOTAL</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd; text-align: right;"><strong>$775,500</strong></td>
                    </tr>
                </table>
                <p>This represents a <strong>12% increase</strong> from Q1 due to planned team expansion and infrastructure upgrades.</p>
                <p><strong>Attachments:</strong></p>
                <ul>
                    <li>📄 Q2_2026_Budget_Proposal.xlsx</li>
                    <li>📄 Budget_Justification_Document.pdf</li>
                </ul>
                <p>Please review and provide approval by <strong>January 25, 2026</strong>.</p>
                <p>Happy to discuss any questions in our scheduled budget review meeting.</p>
                <p>Thank you,<br/><strong>Sandeep Agarwal</strong><br/>Development Lead</p>
            </div>`,
            body_text: 'Q2 2026 Budget Proposal - Total: $775,500. Categories: Personnel $485K, Software $75K, Cloud $120K, Training $25K, Contingency $70.5K. 12% increase from Q1. Approval needed by January 25.',
            is_read: true,
            is_sent: true,
            is_flagged: false,
            importance: 'high',
            has_attachments: true
        },
        {
            subject: 'Team Performance Reviews - Schedule Confirmation',
            sender_name: 'Sandeep Agarwal',
            sender_email: userEmail,
            reply_to_email: userEmail,
            reply_to_name: 'Sandeep Agarwal',
            body_preview: 'Confirming the performance review schedule for the development team members. Please block your calendars accordingly.',
            body_html: `<div style="font-family: Arial, sans-serif;">
                <p>Hi Team,</p>
                <p>As discussed, I am confirming the schedule for our <strong>Q4 2025 Performance Reviews</strong>. Please ensure you have completed your self-assessments before your scheduled slot.</p>
                <h4>Review Schedule:</h4>
                <table style="border-collapse: collapse; width: 100%; margin: 15px 0;">
                    <tr style="background: #e3f2fd;">
                        <th style="padding: 10px; border: 1px solid #ddd;">Team Member</th>
                        <th style="padding: 10px; border: 1px solid #ddd;">Date</th>
                        <th style="padding: 10px; border: 1px solid #ddd;">Time</th>
                        <th style="padding: 10px; border: 1px solid #ddd;">Location</th>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;">David Park</td>
                        <td style="padding: 10px; border: 1px solid #ddd;">Jan 22</td>
                        <td style="padding: 10px; border: 1px solid #ddd;">10:00 AM</td>
                        <td style="padding: 10px; border: 1px solid #ddd;">Room 301</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;">Emily Rodriguez</td>
                        <td style="padding: 10px; border: 1px solid #ddd;">Jan 22</td>
                        <td style="padding: 10px; border: 1px solid #ddd;">2:00 PM</td>
                        <td style="padding: 10px; border: 1px solid #ddd;">Room 301</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;">James Wilson</td>
                        <td style="padding: 10px; border: 1px solid #ddd;">Jan 23</td>
                        <td style="padding: 10px; border: 1px solid #ddd;">10:00 AM</td>
                        <td style="padding: 10px; border: 1px solid #ddd;">Room 301</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;">Anna Martinez</td>
                        <td style="padding: 10px; border: 1px solid #ddd;">Jan 23</td>
                        <td style="padding: 10px; border: 1px solid #ddd;">2:00 PM</td>
                        <td style="padding: 10px; border: 1px solid #ddd;">Room 301</td>
                    </tr>
                </table>
                <p><strong>Preparation Required:</strong></p>
                <ol>
                    <li>Complete self-assessment form (attached)</li>
                    <li>Prepare list of key accomplishments</li>
                    <li>Think about career development goals for 2026</li>
                </ol>
                <p>Calendar invites will be sent separately. Let me know if you need to reschedule.</p>
                <p>Best,<br/><strong>Sandeep</strong></p>
            </div>`,
            body_text: 'Performance Review Schedule: David Park - Jan 22 10AM, Emily Rodriguez - Jan 22 2PM, James Wilson - Jan 23 10AM, Anna Martinez - Jan 23 2PM. Please complete self-assessments before your slot.',
            is_read: true,
            is_sent: true,
            is_flagged: false,
            importance: 'normal',
            has_attachments: true
        }
    ];

    // ========== DRAFT EMAILS (2) ==========
    const draftEmails = [
        {
            subject: 'Proposal: Microservices Architecture Migration',
            sender_name: 'Sandeep Agarwal',
            sender_email: userEmail,
            reply_to_email: userEmail,
            reply_to_name: 'Sandeep Agarwal',
            body_preview: 'I am proposing a phased migration to microservices architecture to improve scalability and maintainability.',
            body_html: `<div style="font-family: Arial, sans-serif;">
                <p>Dear Leadership Team,</p>
                <p>I am writing to propose a <strong>phased migration to microservices architecture</strong> for our core platform.</p>
                <h3>Executive Summary</h3>
                <p>Our current monolithic architecture is reaching its scalability limits. A migration to microservices will provide:</p>
                <ul>
                    <li>🚀 <strong>Improved Scalability:</strong> Independent scaling of services based on demand</li>
                    <li>⚡ <strong>Faster Deployment:</strong> Reduce deployment time from 4 hours to 15 minutes</li>
                    <li>🛡️ <strong>Better Fault Isolation:</strong> Service failures won't bring down the entire system</li>
                    <li>👥 <strong>Team Autonomy:</strong> Teams can work independently on their services</li>
                </ul>
                <h3>Proposed Timeline</h3>
                <p><em>[DRAFT - Need to finalize with Tech Lead]</em></p>
                <ul>
                    <li>Phase 1 (Q2 2026): Authentication & User Management</li>
                    <li>Phase 2 (Q3 2026): Payment Processing</li>
                    <li>Phase 3 (Q4 2026): Reporting & Analytics</li>
                </ul>
                <h3>Resource Requirements</h3>
                <p><em>[DRAFT - Pending budget approval]</em></p>
                <ul>
                    <li>2 Additional Senior Engineers</li>
                    <li>Cloud infrastructure upgrade: ~$50,000/month</li>
                    <li>Training budget: $30,000</li>
                </ul>
                <p style="color: #ff9800;"><strong>[DRAFT - More sections to be added: Risk Assessment, Success Metrics, Rollback Plan]</strong></p>
            </div>`,
            body_text: 'DRAFT - Microservices Migration Proposal. Benefits: Scalability, faster deployment, fault isolation, team autonomy. Timeline: 3 phases over Q2-Q4 2026. Resources needed: 2 engineers, infrastructure upgrade, training.',
            is_read: true,
            is_draft: true,
            is_flagged: false,
            importance: 'normal',
            has_attachments: false
        },
        {
            subject: 'RE: Team Offsite Suggestions',
            sender_name: 'Sandeep Agarwal',
            sender_email: userEmail,
            reply_to_email: userEmail,
            reply_to_name: 'Sandeep Agarwal',
            body_preview: 'Thanks for collecting the team suggestions. Here are my top picks for the Q2 team offsite location.',
            body_html: `<div style="font-family: Arial, sans-serif;">
                <p>Hi Lisa,</p>
                <p>Thanks for collecting the team's suggestions for the Q2 offsite. After reviewing the options, here are my top picks:</p>
                <h4>🥇 Top Choice: Lake Tahoe Retreat Center</h4>
                <ul>
                    <li>Pros: Beautiful scenery, good meeting facilities, team activities available</li>
                    <li>Cons: 4-hour drive from office</li>
                    <li>Estimated cost: $450/person for 2 days</li>
                </ul>
                <h4>🥈 Alternative: San Francisco Innovation Hub</h4>
                <ul>
                    <li>Pros: Easy to reach, modern facilities, nearby restaurants</li>
                    <li>Cons: Less "getaway" feeling</li>
                    <li>Estimated cost: $300/person for 2 days</li>
                </ul>
                <p><em>[DRAFT - Need to confirm dates with team and check availability]</em></p>
                <p>Questions to resolve:</p>
                <ol>
                    <li>Preferred dates: April 15-16 or April 22-23?</li>
                    <li>Include spouses/partners?</li>
                    <li>Budget approval status?</li>
                </ol>
                <p style="color: #666;"><em>[Save as draft - waiting for budget confirmation from Finance]</em></p>
            </div>`,
            body_text: 'DRAFT - Team Offsite Picks: #1 Lake Tahoe ($450/person), #2 SF Innovation Hub ($300/person). Need to confirm dates and budget approval.',
            is_read: true,
            is_draft: true,
            is_flagged: false,
            importance: 'normal',
            has_attachments: false
        }
    ];

    // Clear existing and insert new emails
    await clearExistingEmails();

    // Insert inbox emails
    console.log('\nInserting Inbox emails (6)...');
    for (let i = 0; i < inboxEmails.length; i++) {
        const email = inboxEmails[i];
        const receivedAt = new Date(Date.now() - (i * 7200000)); // 2 hours apart
        await pool.query(`
            INSERT INTO outlook_email_messages (
                user_id, folder_id, subject, sender_name, sender_email,
                reply_to_email, reply_to_name, body_preview, body_html, body_text,
                is_read, is_flagged, importance, has_attachments, received_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        `, [
            userId, folderMap['inbox'], email.subject, email.sender_name, email.sender_email,
            email.reply_to_email, email.reply_to_name, email.body_preview, email.body_html, email.body_text,
            email.is_read, email.is_flagged, email.importance, email.has_attachments, receivedAt
        ]);
        console.log('  ✅', email.subject.substring(0, 50) + '...');
    }

    // Insert sent emails
    console.log('\nInserting Sent emails (3)...');
    for (let i = 0; i < sentEmails.length; i++) {
        const email = sentEmails[i];
        const sentAt = new Date(Date.now() - ((i + 1) * 86400000)); // 1 day apart
        await pool.query(`
            INSERT INTO outlook_email_messages (
                user_id, folder_id, subject, sender_name, sender_email,
                reply_to_email, reply_to_name, body_preview, body_html, body_text,
                is_read, is_sent, is_flagged, importance, has_attachments, sent_at, received_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $16)
        `, [
            userId, folderMap['sent'], email.subject, email.sender_name, email.sender_email,
            email.reply_to_email, email.reply_to_name, email.body_preview, email.body_html, email.body_text,
            email.is_read, email.is_sent, email.is_flagged, email.importance, email.has_attachments, sentAt
        ]);
        console.log('  ✅', email.subject.substring(0, 50) + '...');
    }

    // Insert draft emails
    console.log('\nInserting Draft emails (2)...');
    for (let i = 0; i < draftEmails.length; i++) {
        const email = draftEmails[i];
        const createdAt = new Date(Date.now() - ((i + 1) * 14400000)); // 4 hours apart
        await pool.query(`
            INSERT INTO outlook_email_messages (
                user_id, folder_id, subject, sender_name, sender_email,
                reply_to_email, reply_to_name, body_preview, body_html, body_text,
                is_read, is_draft, is_flagged, importance, has_attachments, received_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        `, [
            userId, folderMap['drafts'], email.subject, email.sender_name, email.sender_email,
            email.reply_to_email, email.reply_to_name, email.body_preview, email.body_html, email.body_text,
            email.is_read, email.is_draft, email.is_flagged, email.importance, email.has_attachments, createdAt
        ]);
        console.log('  ✅', email.subject.substring(0, 50) + '...');
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

    console.log('\n════════════════════════════════════');
    console.log('       EMAIL SEEDING COMPLETE');
    console.log('════════════════════════════════════');
    counts.rows.forEach(r => console.log(`  ${r.name}: ${r.count} emails`));
    console.log('════════════════════════════════════\n');

    await pool.end();
}

seedEmails().catch(err => {
    console.error('Error:', err.message);
    pool.end();
});
