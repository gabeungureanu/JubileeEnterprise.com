/**
 * JubileeDonations.com Server
 *
 * Static website server for Jubilee Ministries donation platform.
 * Serves HTML, CSS, JS, images, and video content.
 *
 * Port: 3402
 */

'use strict';

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3402;

// Middleware
app.use(cors());
app.use(morgan('combined'));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1d',
    etag: true
}));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'JubileeDonations.com',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Route handlers for clean URLs
const pages = ['about', 'projects', 'partner-with-us', 'contact', 'terms-of-use', 'privacypolicy', 'anti-spam-policy'];

pages.forEach(page => {
    app.get(`/${page}`, (req, res) => {
        res.sendFile(path.join(__dirname, 'public', `${page}.html`));
    });
});

// Fallback to index.html for SPA-like behavior
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log('');
    console.log('='.repeat(50));
    console.log('  JubileeDonations.com Server');
    console.log('='.repeat(50));
    console.log(`  Port: ${PORT}`);
    console.log(`  URL: http://localhost:${PORT}`);
    console.log('='.repeat(50));
    console.log('');
});
