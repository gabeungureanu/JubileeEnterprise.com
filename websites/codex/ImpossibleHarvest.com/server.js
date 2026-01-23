/**
 * ImpossibleHarvest.com - Enterprise Email Client
 * Full Outlook.com-style email application
 * Port: 3139
 */

require('dotenv').config({ override: true });
const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.IMPOSSIBLEHARVEST_PORT || process.env.PORT || 3139;
const SITE_NAME = 'ImpossibleHarvest.com';

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// CORS headers
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }
    next();
});

// API Configuration
const CODEX_API_BASE = process.env.CODEX_API_BASE || 'https://inspirecodex.com';

// In-memory store for demo (in production, this goes through InspireCodex API)
const emailStore = {
    folders: [
        { id: 'inbox', name: 'Inbox', icon: 'inbox', count: 0, system: true },
        { id: 'drafts', name: 'Drafts', icon: 'file-earmark', count: 0, system: true },
        { id: 'sent', name: 'Sent Items', icon: 'send', count: 0, system: true },
        { id: 'archive', name: 'Archive', icon: 'archive', count: 0, system: true },
        { id: 'spam', name: 'Junk Email', icon: 'slash-circle', count: 0, system: true },
        { id: 'trash', name: 'Deleted Items', icon: 'trash', count: 0, system: true }
    ],
    emails: [],
    contacts: []
};

// Generate sample emails for demo
function generateSampleEmails() {
    const sampleEmails = [
        {
            id: uuidv4(),
            folder: 'inbox',
            from: { name: 'John Smith', email: 'john.smith@example.com' },
            to: [{ name: 'You', email: 'user@impossibleharvest.com' }],
            subject: 'Q4 Financial Report - Action Required',
            body: `<p>Hi,</p>
                   <p>Please review the attached Q4 financial report and provide your feedback by Friday.</p>
                   <p>Key highlights:</p>
                   <ul>
                       <li>Revenue up 15% YoY</li>
                       <li>Operating costs reduced by 8%</li>
                       <li>New market expansion on track</li>
                   </ul>
                   <p>Let me know if you have any questions.</p>
                   <p>Best regards,<br>John</p>`,
            date: new Date(Date.now() - 3600000).toISOString(),
            read: false,
            starred: true,
            hasAttachment: true,
            importance: 'high'
        },
        {
            id: uuidv4(),
            folder: 'inbox',
            from: { name: 'Sarah Johnson', email: 'sarah.j@company.org' },
            to: [{ name: 'You', email: 'user@impossibleharvest.com' }],
            subject: 'Meeting Tomorrow at 2 PM',
            body: `<p>Hi there,</p>
                   <p>Just a reminder about our meeting tomorrow at 2 PM in Conference Room B.</p>
                   <p>We'll be discussing:</p>
                   <ol>
                       <li>Project timeline updates</li>
                       <li>Resource allocation</li>
                       <li>Next steps</li>
                   </ol>
                   <p>See you then!</p>
                   <p>Sarah</p>`,
            date: new Date(Date.now() - 7200000).toISOString(),
            read: false,
            starred: false,
            hasAttachment: false,
            importance: 'normal'
        },
        {
            id: uuidv4(),
            folder: 'inbox',
            from: { name: 'Newsletter', email: 'news@techdigest.com' },
            to: [{ name: 'You', email: 'user@impossibleharvest.com' }],
            subject: 'Your Weekly Tech Digest',
            body: `<p>This week in tech:</p>
                   <p><strong>AI Developments</strong></p>
                   <p>Major breakthroughs in natural language processing continue to reshape the industry...</p>
                   <p><strong>Cloud Computing</strong></p>
                   <p>New hybrid solutions offer better flexibility for enterprise clients...</p>`,
            date: new Date(Date.now() - 86400000).toISOString(),
            read: true,
            starred: false,
            hasAttachment: false,
            importance: 'low'
        },
        {
            id: uuidv4(),
            folder: 'inbox',
            from: { name: 'Mike Chen', email: 'mike.chen@partners.net' },
            to: [{ name: 'You', email: 'user@impossibleharvest.com' }],
            subject: 'Partnership Proposal',
            body: `<p>Dear Partner,</p>
                   <p>I hope this email finds you well. I wanted to reach out regarding a potential partnership opportunity.</p>
                   <p>Our company specializes in cloud infrastructure and we believe there could be significant synergies between our organizations.</p>
                   <p>Would you be available for a call next week to discuss further?</p>
                   <p>Best,<br>Mike Chen<br>VP of Business Development</p>`,
            date: new Date(Date.now() - 172800000).toISOString(),
            read: true,
            starred: true,
            hasAttachment: true,
            importance: 'normal'
        },
        {
            id: uuidv4(),
            folder: 'sent',
            from: { name: 'You', email: 'user@impossibleharvest.com' },
            to: [{ name: 'Team', email: 'team@company.com' }],
            subject: 'Project Update - Week 3',
            body: `<p>Team,</p>
                   <p>Here's our weekly project update:</p>
                   <p>- Completed phase 2 development<br>- Testing scheduled for next week<br>- On track for delivery</p>
                   <p>Great work everyone!</p>`,
            date: new Date(Date.now() - 259200000).toISOString(),
            read: true,
            starred: false,
            hasAttachment: false,
            importance: 'normal'
        },
        {
            id: uuidv4(),
            folder: 'drafts',
            from: { name: 'You', email: 'user@impossibleharvest.com' },
            to: [{ name: '', email: '' }],
            subject: 'Draft: Proposal Outline',
            body: `<p>Working on proposal outline...</p><p>TODO: Add budget section</p>`,
            date: new Date(Date.now() - 3600000).toISOString(),
            read: true,
            starred: false,
            hasAttachment: false,
            importance: 'normal'
        }
    ];

    emailStore.emails = sampleEmails;
    updateFolderCounts();
}

function updateFolderCounts() {
    emailStore.folders.forEach(folder => {
        const emails = emailStore.emails.filter(e => e.folder === folder.id);
        folder.count = folder.id === 'inbox'
            ? emails.filter(e => !e.read).length
            : emails.length;
    });
}

// Initialize sample data
generateSampleEmails();

// ============== API Routes ==============

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: SITE_NAME,
        timestamp: new Date().toISOString(),
        port: PORT
    });
});

// Get all folders
app.get('/api/folders', (req, res) => {
    res.json(emailStore.folders);
});

// Get emails by folder
app.get('/api/emails/:folder', (req, res) => {
    const { folder } = req.params;
    const { search, starred, unread } = req.query;

    let emails = emailStore.emails.filter(e => e.folder === folder);

    if (search) {
        const searchLower = search.toLowerCase();
        emails = emails.filter(e =>
            e.subject.toLowerCase().includes(searchLower) ||
            e.from.name.toLowerCase().includes(searchLower) ||
            e.from.email.toLowerCase().includes(searchLower) ||
            e.body.toLowerCase().includes(searchLower)
        );
    }

    if (starred === 'true') {
        emails = emails.filter(e => e.starred);
    }

    if (unread === 'true') {
        emails = emails.filter(e => !e.read);
    }

    // Sort by date descending
    emails.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json(emails);
});

// Get single email
app.get('/api/email/:id', (req, res) => {
    const email = emailStore.emails.find(e => e.id === req.params.id);
    if (!email) {
        return res.status(404).json({ error: 'Email not found' });
    }
    res.json(email);
});

// Mark email as read
app.put('/api/email/:id/read', (req, res) => {
    const email = emailStore.emails.find(e => e.id === req.params.id);
    if (!email) {
        return res.status(404).json({ error: 'Email not found' });
    }
    email.read = true;
    updateFolderCounts();
    res.json(email);
});

// Toggle starred
app.put('/api/email/:id/star', (req, res) => {
    const email = emailStore.emails.find(e => e.id === req.params.id);
    if (!email) {
        return res.status(404).json({ error: 'Email not found' });
    }
    email.starred = !email.starred;
    res.json(email);
});

// Move email to folder
app.put('/api/email/:id/move', (req, res) => {
    const { folder } = req.body;
    const email = emailStore.emails.find(e => e.id === req.params.id);
    if (!email) {
        return res.status(404).json({ error: 'Email not found' });
    }
    email.folder = folder;
    updateFolderCounts();
    res.json(email);
});

// Delete email (move to trash or permanent delete)
app.delete('/api/email/:id', (req, res) => {
    const email = emailStore.emails.find(e => e.id === req.params.id);
    if (!email) {
        return res.status(404).json({ error: 'Email not found' });
    }

    if (email.folder === 'trash') {
        // Permanent delete
        emailStore.emails = emailStore.emails.filter(e => e.id !== req.params.id);
    } else {
        // Move to trash
        email.folder = 'trash';
    }
    updateFolderCounts();
    res.json({ success: true });
});

// Send/Save email
app.post('/api/email', (req, res) => {
    const { to, subject, body, isDraft, replyTo, forwardFrom, importance } = req.body;

    const newEmail = {
        id: uuidv4(),
        folder: isDraft ? 'drafts' : 'sent',
        from: { name: 'You', email: 'user@impossibleharvest.com' },
        to: Array.isArray(to) ? to : [{ name: '', email: to }],
        subject: subject || '(No subject)',
        body: body || '',
        date: new Date().toISOString(),
        read: true,
        starred: false,
        hasAttachment: false,
        importance: importance || 'normal',
        replyTo: replyTo || null,
        forwardFrom: forwardFrom || null
    };

    emailStore.emails.push(newEmail);
    updateFolderCounts();

    res.json({ success: true, email: newEmail });
});

// Update draft
app.put('/api/email/:id', (req, res) => {
    const email = emailStore.emails.find(e => e.id === req.params.id);
    if (!email) {
        return res.status(404).json({ error: 'Email not found' });
    }

    const { to, subject, body, isDraft } = req.body;

    if (to) email.to = Array.isArray(to) ? to : [{ name: '', email: to }];
    if (subject !== undefined) email.subject = subject;
    if (body !== undefined) email.body = body;
    if (!isDraft) email.folder = 'sent';

    email.date = new Date().toISOString();
    updateFolderCounts();

    res.json({ success: true, email });
});

// Bulk actions
app.post('/api/emails/bulk', (req, res) => {
    const { ids, action, folder } = req.body;

    ids.forEach(id => {
        const email = emailStore.emails.find(e => e.id === id);
        if (email) {
            switch (action) {
                case 'read':
                    email.read = true;
                    break;
                case 'unread':
                    email.read = false;
                    break;
                case 'star':
                    email.starred = true;
                    break;
                case 'unstar':
                    email.starred = false;
                    break;
                case 'move':
                    email.folder = folder;
                    break;
                case 'delete':
                    if (email.folder === 'trash') {
                        emailStore.emails = emailStore.emails.filter(e => e.id !== id);
                    } else {
                        email.folder = 'trash';
                    }
                    break;
            }
        }
    });

    updateFolderCounts();
    res.json({ success: true });
});

// Search across all folders
app.get('/api/search', (req, res) => {
    const { q } = req.query;
    if (!q) {
        return res.json([]);
    }

    const searchLower = q.toLowerCase();
    const results = emailStore.emails.filter(e =>
        e.subject.toLowerCase().includes(searchLower) ||
        e.from.name.toLowerCase().includes(searchLower) ||
        e.from.email.toLowerCase().includes(searchLower) ||
        e.body.toLowerCase().includes(searchLower)
    );

    results.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(results);
});

// Get contacts
app.get('/api/contacts', (req, res) => {
    // Extract contacts from emails
    const contactMap = new Map();
    emailStore.emails.forEach(email => {
        if (email.from.email && email.from.email !== 'user@impossibleharvest.com') {
            contactMap.set(email.from.email, email.from);
        }
        email.to.forEach(recipient => {
            if (recipient.email && recipient.email !== 'user@impossibleharvest.com') {
                contactMap.set(recipient.email, recipient);
            }
        });
    });
    res.json(Array.from(contactMap.values()));
});

// ============== Main App Route ==============
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Catch-all for SPA routing
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log('');
    console.log('='.repeat(50));
    console.log(`  ${SITE_NAME} - Email Client Server`);
    console.log('='.repeat(50));
    console.log(`  Status:  Running`);
    console.log(`  Port:    ${PORT}`);
    console.log(`  URL:     http://localhost:${PORT}`);
    console.log('='.repeat(50));
    console.log('');
});

process.on('SIGINT', () => {
    console.log('\nShutting down...');
    process.exit(0);
});
